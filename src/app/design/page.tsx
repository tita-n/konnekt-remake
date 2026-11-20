import Link from "next/link";
import { notFound } from "next/navigation";
import { DesignGallery } from "./design-gallery";
import { Phase1Showcase } from "@/components/design/phase1-showcase";

export const metadata = { title: "Design system" };

export default async function DesignPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const params = await searchParams;
  const view = params.view === "tokens" ? "tokens" : "screens";

  return (
    <main id="main" className="mx-auto max-w-7xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-tiny font-bold uppercase tracking-[0.14em] text-accent-ink">Konnekt design system</p>
          <h1 className="mt-1 font-display text-display text-fg">Every screen, every state</h1>
          <p className="mt-2 max-w-xl text-body text-fg-muted">
            Development-only gallery rendering the real components and tokens used across the application.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/design?view=screens"
            className={`inline-flex h-10 items-center rounded-full px-4 text-small font-semibold transition ${
              view === "screens" ? "bg-accent text-accent-fg" : "border border-border bg-surface text-fg-muted hover:bg-surface-2"
            }`}
          >
            Screens showcase
          </Link>
          <Link
            href="/design?view=tokens"
            className={`inline-flex h-10 items-center rounded-full px-4 text-small font-semibold transition ${
              view === "tokens" ? "bg-accent text-accent-fg" : "border border-border bg-surface text-fg-muted hover:bg-surface-2"
            }`}
          >
            Tokens & controls
          </Link>
        </div>
      </header>

      {view === "screens" ? (
        <Phase1Showcase />
      ) : (
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="overflow-hidden rounded-card border border-border">
            <div className="border-b border-border bg-surface-2 px-4 py-2 text-small font-semibold">Light</div>
            <DesignGallery theme="light" />
          </div>
          <div className="overflow-hidden rounded-card border border-border">
            <div className="border-b border-border bg-surface-2 px-4 py-2 text-small font-semibold">Dark</div>
            <DesignGallery theme="dark" />
          </div>
        </div>
      )}
    </main>
  );
}
