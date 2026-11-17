import { notFound } from "next/navigation";
import { DesignGallery } from "./design-gallery";

export const metadata = { title: "Design system" };

export default function DesignPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main id="main" className="mx-auto max-w-7xl px-4 py-8">
      <header className="mb-8">
        <p className="text-tiny font-bold uppercase tracking-[0.14em] text-accent">Konnekt design system</p>
        <h1 className="mt-1 font-display text-display text-fg">Every component, every state</h1>
        <p className="mt-2 max-w-xl text-body text-fg-muted">
          Development-only gallery. Light and dark are rendered side by side; the accent, glass fallback and reduced-motion
          behaviour come from the same tokens the app uses.
        </p>
      </header>
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
    </main>
  );
}
