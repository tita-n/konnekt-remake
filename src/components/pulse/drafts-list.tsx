"use client";

import Link from "next/link";
import { useState } from "react";
import { FilePenLine, Trash2 } from "lucide-react";
import type { DraftView } from "@/lib/posts/types";
import { apiDelete } from "@/lib/posts/client";
import { useToast } from "@/components/providers/toast-provider";
import { EmptyState } from "@/components/ui/feedback";
import { timeAgo } from "@/lib/utils";

export function DraftsList({ initialDrafts }: { initialDrafts: DraftView[] }) {
  const [drafts, setDrafts] = useState(initialDrafts);
  const [deleting, setDeleting] = useState<string | null>(null);
  const { toast } = useToast();

  async function remove(id: string) {
    setDeleting(id);
    try {
      await apiDelete(`/api/drafts/${id}`);
      setDrafts((current) => current.filter((draft) => draft.id !== id));
      toast({ title: "Draft deleted" });
    } catch (err) {
      toast({ title: "Couldn't delete that draft", description: err instanceof Error ? err.message : undefined, variant: "error" });
    } finally {
      setDeleting(null);
    }
  }

  if (drafts.length === 0) {
    return (
      <div className="rounded-card border border-border bg-surface">
        <EmptyState illustration="default" title="No drafts yet" description="Start a post and step away — your words will be waiting here." />
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {drafts.map((draft) => (
        <li key={draft.id} className="rounded-card border border-border bg-surface p-4 shadow-card">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 rounded-chip bg-accent-soft px-2 py-0.5 text-tiny font-semibold text-accent-soft-fg">
                <FilePenLine aria-hidden="true" className="size-3.5" />
                {draft.type === "QUESTION" ? "Question" : draft.type === "POLL" ? "Poll" : "Post"}
              </span>
              <p className="mt-1.5 text-tiny text-fg-subtle">{draft.audience.label ?? "Audience not chosen"}</p>
            </div>
            <button
              type="button"
              aria-label="Delete draft"
              disabled={deleting === draft.id}
              onClick={() => void remove(draft.id)}
              className="flex size-9 items-center justify-center rounded-full text-fg-subtle hover:bg-danger-soft hover:text-danger disabled:opacity-50"
            >
              <Trash2 aria-hidden="true" className="size-4" />
            </button>
          </div>
          <p className="mt-2 line-clamp-3 whitespace-pre-line text-body text-fg">
            {draft.payload.questionTitle || draft.payload.body || "Untitled draft"}
          </p>
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-tiny text-fg-subtle">Saved {timeAgo(draft.updatedAt)}</p>
            <Link
              href={`/compose?type=${draft.type.toLowerCase()}&draft=${draft.id}`}
              className="inline-flex h-9 items-center rounded-button border border-border px-3 text-small font-semibold text-accent hover:bg-accent-soft"
            >
              Continue editing
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}
