"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Archive, CalendarClock, Megaphone, PenLine } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Badge } from "./status-badge";
import { FormMessage } from "@/components/auth/auth-shell";
import { apiPatch } from "@/lib/posts/client";
import { formatEventDate, formatEventTime } from "@/lib/domain/event-display";
import { ANNOUNCEMENT_CATEGORY_LABELS, ANNOUNCEMENT_STATUS_LABELS, type AnnouncementCategory, type AnnouncementStatus } from "@/lib/domain/announcements";
import type { SerializedAnnouncement } from "@/lib/services/announcements";

type AdminAnnouncement = SerializedAnnouncement & { ackCount: number };

export function AnnouncementConsole({
  initialAnnouncements,
  timezone,
  canCompose,
}: {
  initialAnnouncements: AdminAnnouncement[];
  timezone: string;
  canCompose: boolean;
}) {
  const [announcements, setAnnouncements] = useState(initialAnnouncements);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const archive = async (announcement: AdminAnnouncement) => {
    setBusyId(announcement.id);
    setError(null);
    try {
      await apiPatch(`/api/announcements/${announcement.id}`, { archive: true });
      setAnnouncements((current) =>
        current.map((entry) =>
          entry.id === announcement.id ? { ...entry, status: "ARCHIVED", archivedAt: new Date().toISOString() } : entry,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't archive that announcement.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-h1 text-fg">Announcements</h1>
          <p className="mt-1 text-small text-fg-muted">
            Everything official accounts published or scheduled. Archive keeps the notice visible to staff only.
          </p>
        </div>
        {canCompose ? (
          <ButtonLink href="/official/compose" size="sm" className="mt-1 min-h-11">
            <PenLine aria-hidden="true" className="size-4" />
            Compose
          </ButtonLink>
        ) : null}
      </header>

      <FormMessage error={error} message={null} />

      <ul className="space-y-3">
        {announcements.length === 0 ? (
          <li className="rounded-card border border-border bg-surface p-4 text-small text-fg-muted">No announcements yet.</li>
        ) : (
          announcements.map((announcement) => (
            <li key={announcement.id} className="rounded-card border border-border bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="accent">
                  <Megaphone aria-hidden="true" className="size-3" />
                  {announcement.officialAccount.name}
                </Badge>
                <Badge tone={announcement.status === "SCHEDULED" ? "warning" : announcement.status === "ARCHIVED" ? "neutral" : "success"}>
                  {ANNOUNCEMENT_STATUS_LABELS[announcement.status as AnnouncementStatus] ?? announcement.status}
                </Badge>
                {announcement.critical ? (
                  <Badge tone="danger">
                    <AlertTriangle aria-hidden="true" className="size-3" />
                    Critical
                  </Badge>
                ) : null}
              </div>
              <h2 className="mt-2 text-h3 font-bold text-fg">{announcement.title}</h2>
              <p className="mt-1 line-clamp-2 text-small text-fg-muted">{announcement.excerpt}</p>
              <p className="mt-2 flex flex-wrap items-center gap-3 text-tiny text-fg-subtle">
                <span>{ANNOUNCEMENT_CATEGORY_LABELS[announcement.category as AnnouncementCategory] ?? "Notice"}</span>
                {announcement.status === "SCHEDULED" ? (
                  <span className="inline-flex items-center gap-1">
                    <CalendarClock aria-hidden="true" className="size-3" />
                    {formatEventDate(announcement.publishAt, timezone)} · {formatEventTime(announcement.publishAt, timezone)}
                  </span>
                ) : (
                  <span>
                    {formatEventDate(announcement.publishedAt ?? announcement.createdAt, timezone)}
                  </span>
                )}
                <span className="nums">{announcement.ackCount ?? 0} acknowledgements</span>
                {announcement.editedAt ? <span>Edited</span> : null}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={`/official/a/${announcement.id}`}
                  className="inline-flex min-h-11 items-center rounded-button border border-border px-3 text-tiny font-semibold text-fg transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  View
                </Link>
                <Link
                  href={`/official/a/${announcement.id}/edit`}
                  className="inline-flex min-h-11 items-center rounded-button border border-border px-3 text-tiny font-semibold text-fg transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  Edit
                </Link>
                {announcement.status !== "ARCHIVED" ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="min-h-11"
                    loading={busyId === announcement.id}
                    onClick={() => void archive(announcement)}
                  >
                    <Archive aria-hidden="true" className="size-4" />
                    Archive
                  </Button>
                ) : null}
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
