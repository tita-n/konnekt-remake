"use client";

import Link from "next/link";
import { useState } from "react";
import { FilePenLine, MoreHorizontal, Trash2, Users } from "lucide-react";
import type { DraftView } from "@/lib/posts/types";
import { apiDelete } from "@/lib/posts/client";
import { useToast } from "@/components/providers/toast-provider";
import { EmptyState } from "@/components/ui/feedback";
import { timeAgo } from "@/lib/utils";

export function DraftsList({ initialDrafts }: { initialDrafts: DraftView[] }) {
  const [drafts, setDrafts] = useState(initialDrafts);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const { toast } = useToast();

  async function remove(id: string) {
    setDeleting(id);
    try {
      await apiDelete(`/api/drafts/${id}`);
      setDrafts((current) => current.filter((draft) => draft.id !== id));
      setMenuId(null);
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
    <ul className="space-y-2.5">
      {drafts.map((draft) => {
        const preview = draft.payload.media?.[0];
        const text = draft.payload.questionTitle || draft.payload.body || "Untitled draft";
        return (
          <li key={draft.id} className="relative rounded-[16px] border border-border bg-surface p-3.5">
            <div className="flex items-start justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-chip bg-accent-soft px-2.5 py-1 text-tiny font-medium text-accent-soft-fg">
                <Users aria-hidden="true" className="size-3.5" />
                {draft.audience.label ?? "Choose audience"}
              </span>
              <div className="relative">
                <button
                  type="button"
                  aria-label="Draft options"
                  aria-expanded={menuId === draft.id}
                  onClick={() => setMenuId((current) => (current === draft.id ? null : draft.id))}
                  className="flex size-8 items-center justify-center rounded-full text-fg-muted hover:bg-surface-2"
                >
                  <MoreHorizontal aria-hidden="true" className="size-5" />
                </button>
                {menuId === draft.id ? (
                  <div role="menu" className="absolute right-0 top-9 z-20 w-44 rounded-[12px] border border-border bg-surface p-1 shadow-floating">
                    <Link
                      href={`/compose?type=${draft.type.toLowerCase()}&draft=${draft.id}`}
                      role="menuitem"
                      className="block rounded-[9px] px-3 py-2 text-small font-medium text-fg hover:bg-surface-2"
                    >
                      Continue editing
                    </Link>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => void remove(draft.id)}
                      className="block w-full rounded-[9px] px-3 py-2 text-left text-small font-medium text-danger hover:bg-danger-soft"
                    >
                      Delete draft
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            <div className={preview ? "mt-2 flex items-start gap-3" : "mt-2"}>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-3 whitespace-pre-line text-small leading-relaxed text-fg">{text}</p>
                <p className="mt-3 text-tiny text-fg-subtle">Saved {timeAgo(draft.updatedAt)}</p>
              </div>
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview.url}
                  alt={preview.alt ?? "Draft attachment"}
                  width={preview.width}
                  height={preview.height}
                  className="h-[74px] w-[100px] shrink-0 rounded-[10px] border border-border object-cover"
                />
              ) : null}
            </div>

            <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
              <span className="inline-flex items-center gap-1.5 text-tiny text-fg-subtle">
                <FilePenLine aria-hidden="true" className="size-3.5" />
                {draft.type === "QUESTION" ? "Question draft" : draft.type === "POLL" ? "Poll draft" : "Post draft"}
              </span>
              <button
                type="button"
                aria-label="Delete draft"
                disabled={deleting === draft.id}
                onClick={() => void remove(draft.id)}
                className="flex size-8 items-center justify-center rounded-full text-fg-subtle hover:bg-danger-soft hover:text-danger disabled:opacity-50"
              >
                <Trash2 aria-hidden="true" className="size-4" />
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
