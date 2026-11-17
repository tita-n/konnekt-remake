import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/feedback";

export const metadata: Metadata = { title: "Notifications" };

export default function NotificationsPage() {
  return (
    <div className="px-3">
      <header className="pb-3 pt-5">
        <h1 className="text-h1 text-fg">Notifications</h1>
        <p className="mt-1 text-small text-fg-muted">Verification updates and campus activity, in one place.</p>
      </header>
      <div className="rounded-card border border-border bg-surface">
        <EmptyState
          illustration="notifications"
          title="You're all caught up"
          description="When your verification is decided, or when campus activity starts, you'll see it here."
        />
      </div>
    </div>
  );
}
