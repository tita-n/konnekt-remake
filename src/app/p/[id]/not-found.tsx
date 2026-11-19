import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ClayIllustration } from "@/components/ui/clay-illustrations";
import { buttonStyles } from "@/components/ui/button-styles";

export default function PostNotFound() {
  return (
    <main className="min-h-dvh bg-bg text-fg">
      <header className="glass sticky top-0 z-20 border-b border-border/80 border-x-0 border-t-0">
        <div className="mx-auto flex h-14 max-w-feed items-center gap-2 px-2">
          <Link
            href="/pulse"
            aria-label="Back to Pulse"
            className="flex size-11 items-center justify-center rounded-full text-fg hover:bg-surface-2"
          >
            <ArrowLeft aria-hidden="true" className="size-6" />
          </Link>
          <p className="flex-1 text-center font-display text-h2 font-bold">Post</p>
          <span className="size-11" aria-hidden="true" />
        </div>
      </header>
      <section className="mx-auto mt-14 flex max-w-md flex-col items-center px-5 text-center">
        <ClayIllustration kind="unavailableEnvelope" />
        <h1 className="mt-5 font-display text-h1 font-bold text-fg">
          This post isn&apos;t available
        </h1>
        <p className="mt-2 text-body text-fg-muted">
          It may have been deleted, or it isn&apos;t shared with you.
        </p>
        <Link
          href="/pulse"
          className={buttonStyles({ variant: "primary", size: "lg", className: "mt-7 min-w-[200px] rounded-full px-8" })}
        >
          Back to Pulse
        </Link>
      </section>
    </main>
  );
}
