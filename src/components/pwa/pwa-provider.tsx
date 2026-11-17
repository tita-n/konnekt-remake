"use client";

import { useEffect, useRef, useState } from "react";
import { Download, RefreshCw, WifiOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** Registers the service worker and surfaces "new version ready". */
export function PwaProvider() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const reloading = useRef(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;
    let cancelled = false;

    const watch = (registration: ServiceWorkerRegistration) => {
      if (registration.waiting) setWaiting(registration.waiting);
      registration.addEventListener("updatefound", () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (installing.state === "installed" && navigator.serviceWorker.controller) {
            setWaiting(installing);
          }
        });
      });
    };

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        if (cancelled) return;
        watch(registration);
        // Check for an updated worker when the app regains focus.
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") registration.update().catch(() => undefined);
        });
      })
      .catch(() => undefined);

    const onControllerChange = () => {
      if (reloading.current) window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  if (!waiting) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-md items-center gap-3 rounded-card border border-border bg-surface p-3 shadow-floating"
    >
      <RefreshCw aria-hidden="true" className="size-5 shrink-0 text-accent" />
      <p className="min-w-0 flex-1 text-small font-semibold text-fg">
        A new version of Konnekt is ready.
      </p>
      <Button
        size="sm"
        onClick={() => {
          reloading.current = true;
          waiting.postMessage({ type: "SKIP_WAITING" });
        }}
      >
        Reload
      </Button>
      <button
        type="button"
        onClick={() => setWaiting(null)}
        className="flex size-8 items-center justify-center rounded-full text-fg-muted hover:bg-surface-2"
        aria-label="Dismiss update"
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}

/** Slim, honest offline state. Rendered above the shell. */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;
  return (
    <div role="status" className="sticky top-0 z-40 flex items-center justify-center gap-2 bg-warning-soft px-3 py-1.5 text-[0.75rem] font-semibold text-warning">
      <WifiOff aria-hidden="true" className="size-3.5" />
      You&apos;re offline. Some things won&apos;t refresh until you reconnect.
    </div>
  );
}

const VISITS_KEY = "konnekt.visits";
const DISMISS_KEY = "konnekt.install-dismissed";

/**
 * Install prompt shown only after genuine engagement (second visit), and never
 * again once dismissed. The browser's own prompt is used where available.
 */
export function InstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;

    const visits = Number.parseInt(localStorage.getItem(VISITS_KEY) ?? "0", 10) + 1;
    localStorage.setItem(VISITS_KEY, String(visits));

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
      if (visits >= 2) setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-md items-center gap-3 rounded-card border border-border bg-surface p-3 shadow-floating sm:bottom-6">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-[11px] bg-accent text-accent-fg">
        <Download aria-hidden="true" className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-small font-semibold text-fg">Keep Konnekt on your home screen</p>
        <p className="text-[0.6875rem] text-fg-muted">One tap, full screen, works with a weak connection.</p>
      </div>
      <Button
        size="sm"
        loading={installing}
        onClick={async () => {
          if (!promptEvent) {
            dismiss();
            return;
          }
          setInstalling(true);
          await promptEvent.prompt();
          const choice = await promptEvent.userChoice;
          setInstalling(false);
          if (choice.outcome === "accepted") setVisible(false);
          else dismiss();
        }}
      >
        Install
      </Button>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Not now"
        className="flex size-8 shrink-0 items-center justify-center rounded-full text-fg-muted hover:bg-surface-2"
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}
