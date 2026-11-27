"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, CheckCircle2, CloudOff, RefreshCw, Search, ShieldAlert } from "lucide-react";
import { Avatar } from "@/components/ui/display";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/navigation";
import { FormMessage } from "@/components/auth/auth-shell";
import { ApiError, apiGet, apiPost } from "@/lib/posts/client";
import {
  enqueueCheckIn,
  listQueuedCheckIns,
  removeQueuedCheckIn,
  updateQueuedCheckIn,
  type QueuedCheckIn,
} from "@/lib/offline/store";
import { formatEventTime } from "@/lib/domain/event-display";
import type { SerializedEvent } from "@/lib/services/events";

interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}
type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

interface Candidate {
  id: string;
  username: string;
  fullName: string;
  photoUrl: string | null;
  level: number | null;
  department: string | null;
  checkedInAt: string | null;
}

type ScanResult = {
  duplicate: boolean;
  checkedInAt: string;
  method: "QR" | "MANUAL";
  attendee: { id: string; fullName: string; username: string; photoUrl: string | null };
};

type ScanInput = { method: "QR" | "MANUAL"; code?: string; userId?: string };

function scanId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Couldn't check that ticket in.";
}

export function CheckinScanner({ event, initialCheckedIn }: { event: SerializedEvent; initialCheckedIn: number }) {
  const [mode, setMode] = useState<"QR" | "MANUAL">("QR");
  const [checkedIn, setCheckedIn] = useState(initialCheckedIn);
  const [code, setCode] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [replaying, setReplaying] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraSupported, setCameraSupported] = useState(true);
  const [scanHint, setScanHint] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [queue, setQueue] = useState<QueuedCheckIn[]>([]);
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [searching, setSearching] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const lastCode = useRef<string | null>(null);
  const emptyFrames = useRef(0);
  const replayingRef = useRef(false);

  const refreshQueue = useCallback(async () => {
    setQueue(await listQueuedCheckIns(event.id));
  }, [event.id]);

  const stopCamera = useCallback(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOn(false);
    setScanHint(null);
  }, []);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const applyResult = useCallback((response: ScanResult) => {
    setResult(response);
    if (!response.duplicate) setCheckedIn((count) => count + 1);
  }, []);

  const send = useCallback(
    (input: ScanInput, clientScanId: string) =>
      apiPost<ScanResult>(`/api/events/${event.id}/checkin`, {
        ...input,
        clientScanId,
        deviceLabel: "scanner",
      }),
    [event.id],
  );

  const queueScan = useCallback(
    async (input: ScanInput, clientScanId: string) => {
      await enqueueCheckIn({
        id: clientScanId,
        eventId: event.id,
        method: input.method,
        code: input.code,
        userId: input.userId,
        createdAt: new Date().toISOString(),
        attempts: 0,
        status: "pending",
      });
      await refreshQueue();
      setNotice("Saved on this device. It will check in automatically when the connection returns.");
      setCode("");
    },
    [event.id, refreshQueue],
  );

  const checkIn = useCallback(
    async (input: ScanInput) => {
      setBusy(true);
      setError(null);
      setNotice(null);
      const clientScanId = scanId();
      try {
        if (!navigator.onLine) {
          await queueScan(input, clientScanId);
          return;
        }
        try {
          applyResult(await send(input, clientScanId));
          setCode("");
        } catch (requestError) {
          // A lost response can still mean the server committed. The same
          // clientScanId makes the replay a duplicate rather than a second scan.
          if (requestError instanceof ApiError && requestError.status < 500) throw requestError;
          await queueScan(input, clientScanId);
        }
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setBusy(false);
      }
    },
    [applyResult, queueScan, send],
  );

  const replayOne = useCallback(
    async (item: QueuedCheckIn, manual: boolean) => {
      try {
        const response = await send(
          { method: item.method, code: item.code, userId: item.userId },
          item.id,
        );
        await removeQueuedCheckIn(item.id);
        applyResult(response);
        setNotice(
          response.duplicate
            ? "That student was already checked in. The queued scan was cleared."
            : "Queued scan checked in.",
        );
        return true;
      } catch (err) {
        if (err instanceof ApiError && err.status < 500) {
          await updateQueuedCheckIn({
            ...item,
            attempts: item.attempts + 1,
            status: "failed",
            error: err.message,
          });
          if (manual) setError(err.message);
          return false;
        }
        if (manual) setError("Still offline. The scan is safe on this device; retry when connected.");
        return false;
      }
    },
    [applyResult, send],
  );

  const replayQueue = useCallback(async () => {
    if (replayingRef.current || !navigator.onLine) return;
    replayingRef.current = true;
    setReplaying(true);
    try {
      const rows = await listQueuedCheckIns(event.id);
      for (const item of rows) {
        if (item.status !== "pending") continue;
        const sent = await replayOne(item, false);
        if (!sent) break;
      }
      await refreshQueue();
    } finally {
      replayingRef.current = false;
      setReplaying(false);
    }
  }, [event.id, refreshQueue, replayOne]);

  useEffect(() => {
    setOnline(navigator.onLine);
    void refreshQueue().then(() => {
      if (navigator.onLine) void replayQueue();
    });
    const handleOnline = () => {
      setOnline(true);
      void replayQueue();
    };
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [refreshQueue, replayQueue]);

  const startCamera = async () => {
    setError(null);
    setScanHint(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraSupported(false);
      setError("This browser can't open a camera. Type the ticket code below instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
      setCameraSupported(true);

      const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
      const detector = Detector ? new Detector({ formats: ["qr_code"] }) : null;
      // Safari and several desktop browsers have no BarcodeDetector. Load the
      // decoder only when the camera is actually used on this route.
      const fallback = detector ? null : (await import("qr/decode.js")).decodeQR;
      const canvas = fallback ? document.createElement("canvas") : null;

      const readFrame = async (): Promise<string | null> => {
        const video = videoRef.current;
        if (!video || video.readyState < 2) return null;
        if (detector) {
          const barcodes = await detector.detect(video);
          return barcodes[0]?.rawValue?.trim() ?? null;
        }
        if (!fallback || !canvas) return null;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context || canvas.width === 0 || canvas.height === 0) return null;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const image = context.getImageData(0, 0, canvas.width, canvas.height);
        try {
          return fallback({ data: image.data, width: image.width, height: image.height })?.trim() ?? null;
        } catch {
          return null;
        }
      };

      timerRef.current = window.setInterval(async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) return;
        try {
          const value = await readFrame();
          if (value && value !== lastCode.current) {
            lastCode.current = value;
            stopCamera();
            await checkIn({ method: "QR", code: value });
            return;
          }
          emptyFrames.current += 1;
          if (emptyFrames.current === 20) {
            setScanHint("No code yet. Move closer, hold steady, or add more light.");
          }
        } catch {
          // A single unreadable frame is normal; keep scanning.
        }
      }, 500);
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      setCameraOn(false);
      if (name === "NotAllowedError" || name === "SecurityError") {
        setError("Camera access was blocked. Allow it in your browser or type the ticket code below.");
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        setError("No camera was found on this device. Type the ticket code below.");
      } else {
        setError("The camera couldn't start. Type the ticket code below instead.");
      }
    }
  };

  useEffect(() => {
    if (mode !== "MANUAL") return;
    const handle = window.setTimeout(async () => {
      if (query.trim().length < 2) {
        setCandidates([]);
        return;
      }
      if (!navigator.onLine) {
        setCandidates([]);
        return;
      }
      setSearching(true);
      try {
        const { data } = await apiGet<{ candidates: Candidate[] }>(
          `/api/events/${event.id}/checkin/search?q=${encodeURIComponent(query)}`,
        );
        setCandidates(data.candidates);
      } catch {
        setCandidates([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => window.clearTimeout(handle);
  }, [query, mode, event.id]);

  const pending = queue.filter((item) => item.status === "pending");
  const failed = queue.filter((item) => item.status === "failed");

  return (
    <div className="space-y-4">
      <header>
        <p className="text-tiny font-bold uppercase tracking-widest text-accent-ink">Check-in</p>
        <h1 className="mt-1 font-display text-h2 font-extrabold text-fg">{event.title}</h1>
        <p className="mt-1 text-small text-fg-muted">
          {checkedIn} checked in · starts {formatEventTime(event.startsAt, event.timezone)}
        </p>
        {!online ? (
          <p className="mt-2 flex items-center gap-1 text-tiny font-semibold text-warning" role="status">
            <CloudOff aria-hidden="true" className="size-4" />
            Offline — scans are saved on this device and sent when you reconnect.
          </p>
        ) : null}
      </header>

      {queue.length > 0 ? (
        <div className="rounded-card border border-warning/40 bg-warning-soft p-4" role="status" aria-live="polite">
          <p className="text-small font-bold text-fg">
            {pending.length} queued scan{pending.length === 1 ? "" : "s"} waiting
            {failed.length > 0 ? ` · ${failed.length} need attention` : ""}
          </p>
          <p className="mt-1 text-tiny text-fg-muted">
            Queued scans are kept on this device. Replaying uses the original scan id, so a student is never checked in
            twice.
          </p>
          {failed.length > 0 ? (
            <ul className="mt-2 space-y-2">
              {failed.map((item) => (
                <li key={item.id} className="flex items-center gap-2 text-tiny text-fg-muted">
                  <span className="min-w-0 flex-1 truncate">
                    {item.method === "QR" ? "Ticket scan" : "Name check-in"}: {item.error ?? "Failed"}
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="min-h-11"
                    onClick={() => void replayOne(item, true).then(refreshQueue)}
                  >
                    Retry
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
          <Button
            size="sm"
            variant="secondary"
            className="mt-3 min-h-11"
            loading={replaying}
            disabled={!online || pending.length === 0}
            onClick={() => void replayQueue()}
          >
            <RefreshCw aria-hidden="true" className="size-4" />
            Retry queued scans
          </Button>
        </div>
      ) : null}

      {result ? (
        <div
          className={`rounded-card border p-4 ${result.duplicate ? "border-warning/50 bg-warning-soft" : "border-success/40 bg-success-soft"}`}
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-2">
            {result.duplicate ? (
              <ShieldAlert aria-hidden="true" className="size-5 text-warning" />
            ) : (
              <CheckCircle2 aria-hidden="true" className="size-5 text-success" />
            )}
            <p className="text-h3 text-fg">{result.duplicate ? "Already checked in" : "Checked in"}</p>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Avatar name={result.attendee.fullName} src={result.attendee.photoUrl} size="sm" />
            <div>
              <p className="text-small font-semibold text-fg">{result.attendee.fullName}</p>
              <p className="text-tiny text-fg-muted">
                {result.duplicate ? "First scanned" : "Scanned"} at{" "}
                {formatEventTime(result.checkedInAt, event.timezone)} · {result.method.toLowerCase()}
              </p>
            </div>
          </div>
          <Button size="sm" variant="secondary" className="mt-3 min-h-11" onClick={() => setResult(null)}>
            Scan next
          </Button>
        </div>
      ) : null}

      {notice ? (
        <p className="rounded-card border border-border bg-surface-2 px-3 py-2 text-small text-fg" role="status">
          {notice}
        </p>
      ) : null}

      <SegmentedControl
        label="Check-in method"
        value={mode}
        onChange={(next) => {
          setMode(next);
          setError(null);
        }}
        options={[
          { value: "QR", label: "Scan QR" },
          { value: "MANUAL", label: "Find student" },
        ]}
      />

      {mode === "QR" ? (
        <div className="rounded-card border border-border bg-surface p-4">
          <div className="scan-frame relative overflow-hidden rounded-button bg-black">
            <video
              ref={videoRef}
              muted
              playsInline
              className="aspect-[4/3] w-full object-cover"
              aria-label="Camera preview"
            />
            {/* Viewfinder brackets: where to aim the ticket. */}
            <span className="scan-corners" aria-hidden="true">
              <i className="scan-corner scan-corner-tl" />
              <i className="scan-corner scan-corner-tr" />
              <i className="scan-corner scan-corner-br" />
              <i className="scan-corner scan-corner-bl" />
            </span>
            {!cameraOn ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 p-4 text-center text-white">
                <Camera aria-hidden="true" className="size-8" />
                <p className="text-small">
                  {cameraSupported
                    ? "Point the camera at the student's ticket"
                    : "Camera scanning unavailable"}
                </p>
              </div>
            ) : scanHint ? (
              <div className="absolute inset-x-3 bottom-3 rounded-button bg-black/75 p-2 text-center text-tiny text-white">
                {scanHint}
              </div>
            ) : null}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {cameraOn ? (
              <Button size="lg" variant="secondary" onClick={stopCamera}>
                <CameraOff aria-hidden="true" className="size-4" />
                Stop camera
              </Button>
            ) : (
              <Button size="lg" onClick={() => void startCamera()} disabled={busy}>
                <Camera aria-hidden="true" className="size-4" />
                Start camera
              </Button>
            )}
          </div>
          <form
            className="mt-3 flex items-stretch gap-2"
            onSubmit={(submitEvent) => {
              submitEvent.preventDefault();
              if (code.trim()) void checkIn({ method: "QR", code: code.trim() });
            }}
          >
            <label htmlFor="ticket-code" className="sr-only">
              Ticket code
            </label>
            <input
              id="ticket-code"
              value={code}
              onChange={(change) => setCode(change.target.value)}
              placeholder="Or type the ticket code"
              autoComplete="off"
              className="min-h-12 min-w-0 flex-1 rounded-button border border-border bg-bg px-3 font-mono text-small text-fg transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            />
            <Button size="lg" type="submit" className="shrink-0" loading={busy} disabled={!code.trim()}>
              Check in
            </Button>
          </form>
        </div>
      ) : (
        <div className="rounded-card border border-border bg-surface p-4">
          <label htmlFor="checkin-search" className="text-small font-semibold text-fg">
            Find a student who RSVP&apos;d
          </label>
          <div className="mt-1 flex items-center gap-2 rounded-button border border-border bg-bg px-3">
            <Search aria-hidden="true" className="size-4 text-fg-subtle" />
            <input
              id="checkin-search"
              value={query}
              onChange={(change) => setQuery(change.target.value)}
              placeholder="Name or username"
              className="min-h-12 flex-1 bg-transparent text-small text-fg focus:outline-none"
            />
          </div>
          {searching ? <p className="mt-2 text-tiny text-fg-muted">Searching…</p> : null}
          {!online ? (
            <p className="mt-2 text-tiny text-fg-muted">
              Name search needs a connection. Ticket codes can still be queued offline.
            </p>
          ) : null}
          <ul className="mt-3 divide-y divide-border">
            {candidates.map((candidate) => (
              <li key={candidate.id} className="flex items-center gap-2 py-2">
                <Avatar name={candidate.fullName} src={candidate.photoUrl} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-small font-semibold text-fg">{candidate.fullName}</p>
                  <p className="truncate text-tiny text-fg-muted">
                    @{candidate.username}
                    {candidate.department ? ` · ${candidate.department}` : ""}
                    {candidate.level ? ` · ${candidate.level} level` : ""}
                  </p>
                </div>
                {candidate.checkedInAt ? (
                  <span className="text-tiny font-semibold text-success">Checked in</span>
                ) : (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="min-h-11"
                    onClick={() => void checkIn({ method: "MANUAL", userId: candidate.id })}
                    loading={busy}
                  >
                    Check in
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {query.trim().length >= 2 && !searching && candidates.length === 0 && online ? (
            <p className="mt-3 text-small text-fg-muted">No going attendees match that search.</p>
          ) : null}
        </div>
      )}

      <FormMessage error={error} message={null} />
    </div>
  );
}
