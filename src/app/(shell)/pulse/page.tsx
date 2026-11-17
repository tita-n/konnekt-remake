import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";

export const metadata: Metadata = { title: "Pulse" };

export default function PulsePage() {
  return (
    <div className="px-1 pt-2">
      <header className="px-3 pb-3 pt-4">
        <h1 className="text-h1 text-fg">Pulse</h1>
        <p className="mt-1 text-small text-fg-muted">What&apos;s happening around your campus, soon.</p>
      </header>
      <div className="rounded-card border border-border bg-surface">
        <EmptyState
          illustration="pulse"
          title="Your campus pulse starts here"
          description="Posts from your department, your level and your university will land here. Pulse opens with the next release — nothing is faked in the meantime."
          action={
            <ButtonLink href="/profile/me" variant="secondary">
              Get your profile ready
            </ButtonLink>
          }
        />
      </div>
      <p className="mt-4 px-3 text-center text-tiny leading-relaxed text-fg-subtle">
        Verified students only. What you share will be visible exactly where you choose — never across universities.
      </p>
    </div>
  );
}
