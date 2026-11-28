"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FilePenLine, Undo2, X } from "lucide-react";
import type { DraftView } from "@/lib/posts/types";
import { apiDelete } from "@/lib/posts/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Pulse's one-line nudge back into an unsent draft. Discard is delayed five
 * seconds so the student can undo without a second confirmation dialog.
 */
export function ContinueDraftCard({ draft }: { draft: DraftView }) {
  const [visible, setVisible] = useState(true);
  const [discarding, setDiscarding] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  if (!visible) return null;

  const snippet = (draft.payload.questionTitle || draft.payload.body || "Untitled draft").slice(0, 140);
  const href = `/compose?type=${draft.type.toLowerCase()}&draft=${draft.id}`;

  function discard() {
    setDiscarding(true);
    timer.current = window.setTimeout(() => {
      void apiDelete(`/api/drafts/${draft.id}`).catch(() => undefined);
      setVisible(false);
    }, 5000);
  }

  function undo() {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    setDiscarding(false);
  }

  return (
    <section
      aria-label="Continue your draft"
      data-testid="continue-draft"
      className={cn(
        "rounded-[16px] border border-accent/25 bg-accent-soft px-3.5 py-3",
        discarding && "opacity-70",
      )}
    >
      <div className="flex items-start gap-2.5">
        <FilePenLine aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-accent-ink" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-small font-semibold text-accent-soft-fg">Continue your draft</p>
            <button
              type="button"
              aria-label="Dismiss draft reminder"
              onClick={() => setVisible(false)}
              className="-mr-3 -mt-2.5 flex size-11 shrink-0 items-center justify-center rounded-full text-accent-ink hover:bg-surface/60"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>
          <p className="mt-1 line-clamp-2 whitespace-pre-line text-small leading-relaxed text-fg">{snippet}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-surface/80 px-2.5 py-1 text-tiny font-semibold text-accent-soft-fg">
              {draft.audience.label ?? "Choose audience"}
            </span>
            {discarding ? (
              <button
                type="button"
                onClick={undo}
                className="inline-flex items-center gap-1 text-small font-semibold text-accent-ink underline underline-offset-2"
              >
                <Undo2 aria-hidden="true" className="size-3.5" /> Undo discard
              </button>
            ) : (
              <>
                <Link
                  href={href}
                  className="inline-flex -my-1.5 min-h-11 items-center rounded-full bg-accent px-3.5 text-small font-semibold text-accent-fg"
                >
                  Continue
                </Link>
                <button
                  type="button"
                  onClick={discard}
                  className="inline-flex -my-1.5 min-h-11 items-center rounded-full px-3 text-small font-semibold text-accent-ink hover:bg-surface/60"
                >
                  Discard
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
