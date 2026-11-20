import type { Metadata } from "next";
import Link from "next/link";
import { Download, Smartphone, WifiOff } from "lucide-react";

export const metadata: Metadata = { title: "Install Konnekt" };

export default function InstallPage() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-lg bg-surface px-5 pb-10 pt-6 text-fg">
      <Link href="/" className="inline-flex items-center gap-2" aria-label="Konnekt home">
        <span className="flex size-9 items-center justify-center rounded-[10px] bg-accent text-base font-bold text-accent-fg">K</span>
        <span className="font-display text-xl font-bold tracking-tight">Konnekt</span>
      </Link>
      <h1 className="mt-8 text-h1">Keep your campus in your pocket</h1>
      <p className="mt-2 text-body text-fg-muted">
        Konnekt installs from the browser. It opens full-screen, keeps your last Pulse page for offline moments, and sends
        queued posts when you reconnect.
      </p>
      <div className="mt-6 space-y-3">
        <div className="rounded-card border border-border p-4">
          <h2 className="flex items-center gap-2 text-h3"><Smartphone aria-hidden="true" className="size-4 text-accent-ink" /> On your phone</h2>
          <p className="mt-1 text-small text-fg-muted">
            Open Konnekt in Chrome or Safari, then choose <strong className="text-fg">Add to Home Screen</strong> from the browser menu.
          </p>
        </div>
        <div className="rounded-card border border-border p-4">
          <h2 className="flex items-center gap-2 text-h3"><Download aria-hidden="true" className="size-4 text-accent-ink" /> On your computer</h2>
          <p className="mt-1 text-small text-fg-muted">
            Look for the install icon in the address bar, or choose <strong className="text-fg">Install Konnekt</strong> from the browser menu.
          </p>
        </div>
        <div className="rounded-card border border-border p-4">
          <h2 className="flex items-center gap-2 text-h3"><WifiOff aria-hidden="true" className="size-4 text-accent-ink" /> Works on weak networks</h2>
          <p className="mt-1 text-small text-fg-muted">
            Your last feed is saved privately on this device. Logging out wipes it completely, so shared phones stay private.
          </p>
        </div>
      </div>
      <Link href="/login" className="mt-6 flex h-11 items-center justify-center rounded-button bg-accent px-6 text-small font-semibold text-accent-fg">
        Log in to Konnekt
      </Link>
    </main>
  );
}
