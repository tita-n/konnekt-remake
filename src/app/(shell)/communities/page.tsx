import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";

export const metadata: Metadata = { title: "Communities" };

export default function CommunitiesPage() {
  return (
    <div className="px-1 pt-2">
      <header className="px-3 pb-3 pt-4">
        <h1 className="text-h1 text-fg">Communities</h1>
        <p className="mt-1 text-small text-fg-muted">Course groups, halls, teams and societies — inside your university.</p>
      </header>
      <div className="rounded-card border border-border bg-surface">
        <EmptyState
          illustration="communities"
          title="No communities yet"
          description="Communities open with the next release. Every one will belong to a single university and be visible only to verified students there."
          action={
            <ButtonLink href="/settings/profile" variant="secondary">
              Polish your profile first
            </ButtonLink>
          }
        />
      </div>
      <p className="mt-4 px-3 text-center text-tiny leading-relaxed text-fg-subtle">
        No cross-campus groups. No public groups. Your department and level decide where you can join.
      </p>
    </div>
  );
}
