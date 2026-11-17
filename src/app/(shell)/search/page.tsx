import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/feedback";

export const metadata: Metadata = { title: "Search" };

export default function SearchPage() {
  return (
    <div className="px-3">
      <header className="pb-3 pt-5">
        <h1 className="text-h1 text-fg">Search</h1>
        <p className="mt-1 text-small text-fg-muted">Find people, communities and posts across your university.</p>
      </header>
      <div className="rounded-card border border-border bg-surface">
        <EmptyState
          illustration="search"
          title="Search opens with Pulse"
          description="There is nothing to search yet — Pulse, communities and events arrive in the next release. Your profile is already searchable by username once they do."
        />
      </div>
    </div>
  );
}
