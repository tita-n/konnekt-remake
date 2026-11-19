"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import type { RestrictedStudentView } from "@/lib/services/moderation";
import { Avatar } from "@/components/ui/display";
import { EmptyState } from "@/components/ui/feedback";
import { apiPost } from "@/lib/posts/client";
import { useToast } from "@/components/providers/toast-provider";
import { cn } from "@/lib/utils";

export function RestrictedPeople({
  initialBlocked,
  initialMuted,
}: {
  initialBlocked: RestrictedStudentView[];
  initialMuted: RestrictedStudentView[];
}) {
  const [tab, setTab] = useState<"blocked" | "muted">("blocked");
  const [blocked, setBlocked] = useState(initialBlocked);
  const [muted, setMuted] = useState(initialMuted);
  const [busy, setBusy] = useState<string | null>(null);
  const { toast } = useToast();
  const list = tab === "blocked" ? blocked : muted;

  async function release(student: RestrictedStudentView) {
    setBusy(student.id);
    try {
      await apiPost("/api/relationships", { action: tab === "blocked" ? "block" : "mute", username: student.username });
      if (tab === "blocked") setBlocked((current) => current.filter((item) => item.id !== student.id));
      else setMuted((current) => current.filter((item) => item.id !== student.id));
      toast({ title: tab === "blocked" ? `Unblocked @${student.username}` : `Unmuted @${student.username}` });
    } catch (err) {
      toast({ title: "Couldn't update that", description: err instanceof Error ? err.message : undefined, variant: "error" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="flex overflow-hidden rounded-full border border-border bg-surface p-0.5" role="tablist" aria-label="Blocked and muted">
        {(["blocked", "muted"] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={cn(
              "h-9 flex-1 rounded-full text-small font-semibold capitalize transition-colors",
              tab === value ? "bg-accent text-accent-fg" : "text-fg-muted hover:bg-surface-2",
            )}
          >
            {value}
          </button>
        ))}
      </div>

      <div className="mt-3">
        {list.length === 0 ? (
          <div className="rounded-card border border-border bg-surface">
            <EmptyState
              illustration="padlock"
              title={tab === "blocked" ? "No one blocked.\nThat's the way we like it." : "No one muted."}
              description={
                tab === "blocked"
                  ? "Blocking is mutual: neither of you will see the other's posts, comments or mentions."
                  : "Muting hides someone's posts from your feed and hashtag results, without telling them."
              }
            />
          </div>
        ) : (
          <div className="space-y-2.5">
            <p className="px-1 font-display text-[1rem] font-bold text-fg">
              {tab === "blocked" ? "Blocked" : "Muted"} people ({list.length})
            </p>
            <ul className="space-y-2">
              {list.map((student) => (
                <li key={student.id} className="flex items-center gap-3 rounded-[16px] border border-border bg-surface p-3">
                  <Avatar name={student.fullName} src={student.photoUrl} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-small font-bold text-fg">{student.fullName}</p>
                    <p className="truncate text-tiny text-fg-muted">
                      {student.departmentName ?? "Department hidden"}
                      {student.level ? ` · ${student.level}L` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy === student.id}
                    onClick={() => void release(student)}
                    className="h-9 shrink-0 rounded-full border border-accent px-4 text-small font-semibold text-accent transition hover:bg-accent-soft disabled:opacity-50"
                  >
                    {tab === "blocked" ? "Unblock" : "Unmute"}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <p className="mt-4 flex items-start gap-2.5 rounded-[12px] bg-accent-soft px-3.5 py-3 text-small leading-relaxed text-accent-soft-fg">
        <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-accent" />
        {tab === "blocked" ? "Blocked people can't see your posts or interact with you." : "Muted people are hidden only from your feed — they can still see yours."}
      </p>
    </div>
  );
}

