import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";

export const metadata: Metadata = { title: "Events" };

export default function EventsPage() {
  return (
    <div className="px-1 pt-2">
      <header className="px-3 pb-3 pt-4">
        <h1 className="text-h1 text-fg">Events</h1>
        <p className="mt-1 text-small text-fg-muted">Lectures, meetups, parties and revision sessions on your campus.</p>
      </header>
      <div className="rounded-card border border-border bg-surface">
        <EmptyState
          illustration="events"
          title="No events on the calendar"
          description="Events arrive with the next release. Only students of your university will be able to see and join them."
          action={
            <ButtonLink href="/settings/profile" variant="secondary">
              Set up your profile
            </ButtonLink>
          }
        />
      </div>
    </div>
  );
}
