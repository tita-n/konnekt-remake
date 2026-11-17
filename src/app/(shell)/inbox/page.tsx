import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";

export const metadata: Metadata = { title: "Inbox" };

export default function InboxPage() {
  return (
    <div className="px-1 pt-2">
      <header className="px-3 pb-3 pt-4">
        <h1 className="text-h1 text-fg">Inbox</h1>
        <p className="mt-1 text-small text-fg-muted">Direct messages with verified students at your university.</p>
      </header>
      <div className="rounded-card border border-border bg-surface">
        <EmptyState
          illustration="inbox"
          title="Your inbox is quiet"
          description="Messaging arrives with the next release. When it does, only students from your university can reach you."
          action={
            <ButtonLink href="/settings/privacy" variant="secondary">
              Review your privacy
            </ButtonLink>
          }
        />
      </div>
    </div>
  );
}
