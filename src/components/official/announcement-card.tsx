import Link from "next/link";
import { AlertTriangle, Check, Paperclip, Pencil } from "lucide-react";
import { Avatar } from "@/components/ui/display";
import { formatEventDate } from "@/lib/domain/event-display";
import { ANNOUNCEMENT_CATEGORY_LABELS, type AnnouncementCategory } from "@/lib/domain/announcements";
import type { SerializedAnnouncement } from "@/lib/services/announcements";

export function AnnouncementCard({
  announcement,
  acknowledged,
  timezone,
}: {
  announcement: SerializedAnnouncement;
  acknowledged: boolean;
  timezone: string;
}) {
  return (
    <article
      className={`rounded-card border p-4 ${
        announcement.critical ? "border-danger/45 bg-danger-soft" : "border-border bg-surface"
      }`}
      aria-labelledby={`announcement-${announcement.id}`}
    >
      <div className="flex items-center gap-2">
        <Avatar
          name={announcement.officialAccount.name}
          src={null}
          size="sm"
          official
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-small font-semibold text-fg">{announcement.officialAccount.name}</p>
          <p className="text-tiny text-fg-subtle">
            {ANNOUNCEMENT_CATEGORY_LABELS[announcement.category as AnnouncementCategory] ?? "Notice"} ·{" "}
            {formatEventDate(announcement.publishedAt ?? announcement.createdAt, timezone)}
          </p>
        </div>
        {announcement.critical ? (
          <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-chip bg-danger-btn px-1.5 py-0.5 text-[0.625rem] font-extrabold uppercase tracking-[0.04em] text-danger-fg">
            <AlertTriangle aria-hidden="true" className="size-3" />
            Critical
          </span>
        ) : null}
      </div>
      <Link href={`/official/a/${announcement.id}`} className="mt-3 block">
        <h2 id={`announcement-${announcement.id}`} className="font-display text-[1.125rem] font-bold leading-[1.34] text-fg">
          {announcement.title}
        </h2>
        <p className="mt-1 line-clamp-3 text-small leading-[1.43] text-fg-muted">{announcement.excerpt}</p>
      </Link>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-tiny text-fg-subtle">
        {announcement.editedAt ? (
          <span className="inline-flex items-center gap-1 font-semibold text-fg-muted">
            <Pencil aria-hidden="true" className="size-3" />
            Edited
          </span>
        ) : null}
        {announcement.attachments.length > 0 ? (
          <span className="inline-flex items-center gap-1">
            <Paperclip aria-hidden="true" className="size-3" />
            {announcement.attachments.length} PDF{announcement.attachments.length === 1 ? "" : "s"}
          </span>
        ) : null}
        {acknowledged ? (
          <span className="inline-flex items-center gap-1 font-semibold text-success">
            <Check aria-hidden="true" className="size-3" />
            Acknowledged
          </span>
        ) : announcement.critical ? (
          <span className="inline-flex items-center gap-1 rounded-chip border border-danger/40 px-2 py-0.5 font-semibold text-danger">
            Needs acknowledgement
          </span>
        ) : null}
      </div>
    </article>
  );
}
