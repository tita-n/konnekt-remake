import Link from "next/link";
import { ArrowLeft, Ban } from "lucide-react";

export default function PostNotFound() {
  return (
    <main className="min-h-dvh bg-bg px-4 py-6 text-fg">
      <header className="mx-auto flex h-14 max-w-2xl items-center gap-2">
        <Link href="/pulse" aria-label="Back to Pulse" className="flex size-11 items-center justify-center rounded-full hover:bg-surface-2">
          <ArrowLeft aria-hidden="true" className="size-5" />
        </Link>
        <p className="flex-1 text-center text-[0.9375rem] font-semibold">Post</p>
        <span className="size-11" aria-hidden="true" />
      </header>
      <section className="mx-auto mt-10 max-w-md text-center">
        <div className="mx-auto flex size-24 items-center justify-center rounded-[28px] bg-accent-soft text-accent" aria-hidden="true">
          <Ban className="size-10" />
        </div>
        <h1 className="mt-6 text-h1 text-fg">This post isn&apos;t available</h1>
        <p className="mt-2 text-body text-fg-muted">It may have been deleted, or it isn&apos;t shared with you.</p>
        <Link href="/pulse" className="mt-6 inline-flex h-11 items-center justify-center rounded-button bg-accent px-6 text-small font-semibold text-accent-fg">
          Back to Pulse
        </Link>
      </section>
    </main>
  );
}
