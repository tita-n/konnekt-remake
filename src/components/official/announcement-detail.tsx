"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Check, Download, FileText, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/auth/auth-shell";
import { apiPost } from "@/lib/posts/client";
import { formatEventDate, formatEventTime } from "@/lib/domain/event-display";
import { ANNOUNCEMENT_CATEGORY_LABELS, type AnnouncementCategory } from "@/lib/domain/announcements";
import type { SerializedAnnouncement } from "@/lib/services/announcements";

export function AnnouncementDetail({
  announcement,
  acknowledged,
  timezone,
}: {
  announcement: SerializedAnnouncement;
  acknowledged: boolean;
  timezone: string;
}) {
  const router = useRouter();
  const [acked, setAcked] = useState(acknowledged);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ack = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiPost(`/api/announcements/${announcement.id}/ack`);
      setAcked(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save your acknowledgement.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="space-y-4 pb-12">
      <Link href="/official" className="inline-flex min-h-9 items-center gap-1 text-small font-semibold text-fg-muted">
        <ArrowLeft aria-hidden="true" className="size-4" />
        Official channel
      </Link>

      <header
        className={`rounded-card border p-4 ${
          announcement.critical ? "border-highlight bg-highlight-soft/50" : "border-border bg-surface"
        }`}
      >
        {announcement.critical ? (
          <p className="mb-2 inline-flex items-center gap-1 rounded-chip bg-highlight px-2 py-0.5 text-[0.625rem] font-extrabold uppercase tracking-widest text-[#3a2500]">
            <AlertTriangle aria-hidden="true" className="size-3" />
            Critical notice
          </p>
        ) : null}
        <p className="text-tiny font-semibold text-fg-muted">
          {announcement.officialAccount.name} ·{" "}
          {ANNOUNCEMENT_CATEGORY_LABELS[announcement.category as AnnouncementCategory] ?? "Notice"}
        </p>
        <h1 className="mt-1 font-display text-h1 font-extrabold leading-tight text-fg">{announcement.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-tiny text-fg-subtle">
          <span>
            {formatEventDate(announcement.publishedAt ?? announcement.createdAt, timezone)} ·{" "}
            {formatEventTime(announcement.publishedAt ?? announcement.createdAt, timezone)}
          </span>
          {announcement.editedAt ? (
            <span className="inline-flex items-center gap-1 font-semibold text-fg-muted">
              <Pencil aria-hidden="true" className="size-3" />
              Edited {formatEventDate(announcement.editedAt, timezone)}
            </span>
          ) : null}
        </div>
      </header>

      <div className="whitespace-pre-line px-1 text-[0.9375rem] leading-relaxed text-fg">{announcement.body}</div>

      {announcement.attachments.length > 0 ? (
        <section aria-labelledby="announcement-attachments">
          <h2 id="announcement-attachments" className="text-h3 text-fg">
            Attachments
          </h2>
          <ul className="mt-2 space-y-2">
            {announcement.attachments.map((attachment) => (
              <li key={attachment.id}>
                <a
                  href={`/api/announcements/${announcement.id}/attachments/${attachment.id}`}
                  className="flex min-h-12 items-center gap-3 rounded-card border border-border bg-surface p-3 hover:bg-surface-2"
                >
                  <FileText aria-hidden="true" className="size-5 shrink-0 text-accent-ink" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-small font-semibold text-fg">{attachment.name}</span>
                    <span className="block text-tiny text-fg-subtle">
                      PDF · {(attachment.sizeBytes / (1024 * 1024)).toFixed(1)} MB
                    </span>
                  </span>
                  <Download aria-hidden="true" className="size-4 shrink-0 text-fg-muted" />
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="rounded-card border border-border bg-surface p-4">
        {acked ? (
          <p className="inline-flex items-center gap-2 text-small font-semibold text-success">
            <Check aria-hidden="true" className="size-4" />
            You acknowledged this announcement.
          </p>
        ) : (
          <>
            <p className="text-small text-fg-muted">
              {announcement.critical
                ? "Acknowledge this notice so it stops appearing on your Pulse."
                : "Mark this announcement as read."}
            </p>
            <Button className="mt-2" onClick={() => void ack()} loading={busy}>
              <Check aria-hidden="true" className="size-4" />
              {announcement.critical ? "I understand" : "Mark as read"}
            </Button>
          </>
        )}
        <FormMessage error={error} message={null} />
      </div>
    </article>
  );
}
