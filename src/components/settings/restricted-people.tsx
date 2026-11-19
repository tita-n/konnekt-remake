"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import type { RestrictedStudentView } from "@/lib/services/moderation";
import { Avatar } from "@/components/ui/display";
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
          <div className="rounded-card border border-border bg-surface px-5 py-8 text-center">
            <LockIllustration />
            <h2 className="mt-4 text-h2 leading-snug text-fg">
              {tab === "blocked" ? (
                <>No one blocked.<br />That&apos;s the way we like it.</>
              ) : (
                "No one muted."
              )}
            </h2>
            <p className="mx-auto mt-2 max-w-xs text-small leading-relaxed text-fg-muted">
              {tab === "blocked"
                ? "Blocking is mutual: neither of you will see the other's posts, comments or mentions."
                : "Muting hides someone's posts from your feed and hashtag results, without telling them."}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            <p className="px-1 text-small font-semibold text-fg">
              {tab === "blocked" ? "Blocked" : "Muted"} people ({list.length})
            </p>
            {list.map((student) => (
              <li key={student.id} className="flex items-center gap-3 rounded-[16px] border border-border bg-surface p-3">
                <Avatar name={student.fullName} src={student.photoUrl} size="md" verified className="rounded-full bg-accent-soft" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-small font-semibold text-fg">{student.fullName}</p>
                  <p className="truncate text-tiny text-fg-muted">
                    {student.departmentName ?? "Department hidden"}
                    {student.level ? ` · ${student.level}L` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy === student.id}
                  onClick={() => void release(student)}
                  className="h-9 shrink-0 rounded-full border border-accent px-3.5 text-small font-semibold text-accent hover:bg-accent-soft disabled:opacity-50"
                >
                  {tab === "blocked" ? "Unblock" : "Unmute"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-3 flex items-start gap-2 rounded-[12px] bg-accent-soft px-3.5 py-3 text-small leading-relaxed text-accent-soft-fg">
        <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        {tab === "blocked" ? "Blocked people can't see your posts or interact with you." : "Muted people are hidden only from your feed — they can still see yours."}
      </p>
    </div>
  );
}

function LockIllustration() {
  return (
    <svg viewBox="0 0 240 170" role="img" aria-label="A friendly padlock" className="mx-auto h-40 w-56">
      <defs>
        <linearGradient id="lock-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#b9a8ff" />
          <stop offset="0.55" stopColor="#8d73f2" />
          <stop offset="1" stopColor="#7157df" />
        </linearGradient>
        <linearGradient id="lock-shackle" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c9baff" />
          <stop offset="1" stopColor="#8e75ef" />
        </linearGradient>
      </defs>
      <ellipse cx="120" cy="151" rx="66" ry="12" fill="#e8e2ff" />
      <g fill="#5d9b63">
        <path d="M66 128c-18-9-28-25-14-34 12-8 27 2 33 17 3 8 2 15-1 21z" />
        <path d="M179 126c18-9 27-25 13-34-12-8-26 2-32 17-3 8-2 15 1 21z" />
        <path d="M56 141c-14-2-22-9-17-16 4-6 15-5 23 2z" />
        <path d="M187 141c14-2 21-9 17-16-5-6-15-5-23 2z" />
      </g>
      <path d="M83 72V55a37 37 0 0 1 74 0v17" fill="none" stroke="url(#lock-shackle)" strokeWidth="23" strokeLinecap="round" />
      <path d="M80 70h80c10 0 18 8 18 18v43c0 12-10 22-22 22H84c-12 0-22-10-22-22V88c0-10 8-18 18-18z" fill="url(#lock-body)" />
      <path d="M76 76h88c6 0 10 4 10 10v10H66V86c0-6 4-10 10-10z" fill="#d8cbff" opacity="0.55" />
      <path d="M101 107c4 5 10 5 14 0M139 107c4 5 10 5 14 0" fill="none" stroke="#3b247b" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M110 121c7 7 16 7 23 0" fill="none" stroke="#3b247b" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M171 44l13-11M177 58l16-3" stroke="#f5a524" strokeWidth="6" strokeLinecap="round" />
    </svg>
  );
}
