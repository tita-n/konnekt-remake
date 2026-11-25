"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, CheckCircle2, Search, ShieldAlert } from "lucide-react";
import { Avatar } from "@/components/ui/display";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/navigation";
import { FormMessage } from "@/components/auth/auth-shell";
import { apiGet, apiPost } from "@/lib/posts/client";
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

function scanId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function CheckinScanner({ event, initialCheckedIn }: { event: SerializedEvent; initialCheckedIn: number }) {
  const [mode, setMode] = useState<"QR" | "MANUAL">("QR");
  const [checkedIn, setCheckedIn] = useState(initialCheckedIn);
  const [code, setCode] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraSupported, setCameraSupported] = useState(true);
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [searching, setSearching] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const lastCode = useRef<string | null>(null);

  const stopCamera = useCallback(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOn(false);
  }, []);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const checkIn = useCallback(
    async (input: { method: "QR" | "MANUAL"; code?: string; userId?: string }) => {
      setBusy(true);
      setError(null);
      try {
        const response = await apiPost<ScanResult>(`/api/events/${event.id}/checkin`, {
          ...input,
          clientScanId: scanId(),
          deviceLabel: "scanner",
        });
        setResult(response);
        if (!response.duplicate) setCheckedIn((count) => count + 1);
        setCode("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't check that ticket in.");
      } finally {
        setBusy(false);
      }
    },
    [event.id],
  );

  const startCamera = async () => {
    setError(null);
    const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
    if (!Detector) {
      setCameraSupported(false);
      setError("This browser can't scan QR codes. Type the ticket code below instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
      const detector = new Detector({ formats: ["qr_code"] });
      timerRef.current = window.setInterval(async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) return;
        try {
          const barcodes = await detector.detect(videoRef.current);
          const value = barcodes[0]?.rawValue?.trim();
          if (value && value !== lastCode.current) {
            lastCode.current = value;
            stopCamera();
            await checkIn({ method: "QR", code: value });
          }
        } catch {
          // A single unreadable frame is normal; keep scanning.
        }
      }, 500);
    } catch {
      setError("Camera access was blocked. Type the ticket code below instead.");
    }
  };

  useEffect(() => {
    if (mode !== "MANUAL") return;
    const handle = window.setTimeout(async () => {
      if (query.trim().length < 2) {
        setCandidates([]);
        return;
      }
      setSearching(true);
      try {
        const { data } = await apiGet<{ candidates: Candidate[] }>(`/api/events/${event.id}/checkin/search?q=${encodeURIComponent(query)}`);
        setCandidates(data.candidates);
      } catch {
        setCandidates([]);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => window.clearTimeout(handle);
  }, [query, mode, event.id]);

  return (
    <div className="space-y-4">
      <header>
        <p className="text-tiny font-bold uppercase tracking-widest text-accent-ink">Check-in</p>
        <h1 className="mt-1 font-display text-h2 font-extrabold text-fg">{event.title}</h1>
        <p className="mt-1 text-small text-fg-muted">
          {checkedIn} checked in · starts {formatEventTime(event.startsAt, event.timezone)}
        </p>
      </header>

      <SegmentedControl
        label="Check-in method"
        value={mode}
        onChange={(next) => {
          setMode(next);
          setResult(null);
          setError(null);
          if (next === "MANUAL") stopCamera();
        }}
        options={[
          { value: "QR", label: "Scan QR" },
          { value: "MANUAL", label: "Search name" },
        ]}
      />

      {result ? (
        <div
          className={`rounded-card border p-4 ${result.duplicate ? "border-warning/50 bg-warning-soft" : "border-success/40 bg-success-soft"}`}
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-2">
            {result.duplicate ? <ShieldAlert aria-hidden="true" className="size-5 text-warning" /> : <CheckCircle2 aria-hidden="true" className="size-5 text-success" />}
            <p className="text-h3 text-fg">{result.duplicate ? "Already checked in" : "Checked in"}</p>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Avatar name={result.attendee.fullName} src={result.attendee.photoUrl} size="sm" />
            <div>
              <p className="text-small font-semibold text-fg">{result.attendee.fullName}</p>
              <p className="text-tiny text-fg-muted">
                {result.duplicate ? "First scanned" : "Scanned"} at {formatEventTime(result.checkedInAt, event.timezone)} · {result.method.toLowerCase()}
              </p>
            </div>
          </div>
          <Button size="sm" variant="secondary" className="mt-3" onClick={() => setResult(null)}>
            Scan next
          </Button>
        </div>
      ) : null}

      {mode === "QR" ? (
        <div className="rounded-card border border-border bg-surface p-4">
          <div className="relative overflow-hidden rounded-button bg-black">
            <video ref={videoRef} muted playsInline className="aspect-[4/3] w-full object-cover" aria-label="Camera preview" />
            {!cameraOn ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 p-4 text-center text-white">
                <Camera aria-hidden="true" className="size-8" />
                <p className="text-small">{cameraSupported ? "Point the camera at the student's ticket" : "Camera scanning unavailable"}</p>
              </div>
            ) : null}
          </div>
          <div className="mt-3 flex gap-2">
            {cameraOn ? (
              <Button variant="secondary" onClick={stopCamera}>
                <CameraOff aria-hidden="true" className="size-4" />
                Stop camera
              </Button>
            ) : (
              <Button onClick={() => void startCamera()} disabled={busy}>
                <Camera aria-hidden="true" className="size-4" />
                Start camera
              </Button>
            )}
          </div>
          <form
            className="mt-3 flex gap-2"
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
              className="min-h-11 flex-1 rounded-button border border-border bg-bg px-3 font-mono text-small text-fg"
            />
            <Button type="submit" loading={busy} disabled={!code.trim()}>
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
              className="min-h-11 flex-1 bg-transparent text-small text-fg focus:outline-none"
            />
          </div>
          {searching ? <p className="mt-2 text-tiny text-fg-muted">Searching…</p> : null}
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
                  <Button size="sm" variant="secondary" onClick={() => void checkIn({ method: "MANUAL", userId: candidate.id })} loading={busy}>
                    Check in
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {query.trim().length >= 2 && !searching && candidates.length === 0 ? (
            <p className="mt-3 text-small text-fg-muted">No going attendees match that search.</p>
          ) : null}
        </div>
      )}

      <FormMessage error={error} message={null} />
    </div>
  );
}
