import type { Metadata } from "next";
import Link from "next/link";
import { CloudOff } from "lucide-react";
import { buttonStyles } from "@/components/ui/button-styles";

export const metadata: Metadata = { title: "You're offline", robots: { index: false } };
export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center bg-bg px-6 py-16 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-accent-soft text-accent-soft-fg">
        <CloudOff aria-hidden="true" className="size-7" />
      </span>
      <h1 className="mt-5 text-h1 text-fg">You&apos;re offline</h1>
      <p className="mt-2 max-w-sm text-small text-fg-muted">
        Konnekt needs a connection for fresh campus activity. Your installed app is still here — reconnect and try
        again.
      </p>
      <Link href="/pulse" className={`${buttonStyles({ variant: "primary" })} mt-6`}>
        Try again
      </Link>
    </main>
  );
}
