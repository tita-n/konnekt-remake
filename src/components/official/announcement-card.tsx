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
        announcement.critical ? "border-highlight/70 bg-highlight-soft/40" : "border-border bg-surface"
      }`}
      aria-labelledby={`announcement-${announcement.id}`}
    >
      <div className="flex items-center gap-2">
        <Avatar
          name={announcement.officialAccount.name}
          src={null}
          size="2xs"
          official
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-tiny font-semibold text-fg">{announcement.officialAccount.name}</p>
          <p className="text-[0.6875rem] text-fg-subtle">
            {ANNOUNCEMENT_CATEGORY_LABELS[announcement.category as AnnouncementCategory] ?? "Notice"} ·{" "}
            {formatEventDate(announcement.publishedAt ?? announcement.createdAt, timezone)}
          </p>
        </div>
        {announcement.critical ? (
          <span className="inline-flex items-center gap-1 rounded-chip bg-highlight px-1.5 py-0.5 text-[0.625rem] font-extrabold uppercase tracking-wide text-[#3a2500]">
            <AlertTriangle aria-hidden="true" className="size-3" />
            Critical
          </span>
        ) : null}
      </div>
      <Link href={`/official/a/${announcement.id}`} className="mt-3 block">
        <h2 id={`announcement-${announcement.id}`} className="text-h3 font-bold leading-snug text-fg">
          {announcement.title}
        </h2>
        <p className="mt-1 line-clamp-3 text-small text-fg-muted">{announcement.excerpt}</p>
      </Link>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-tiny text-fg-subtle">
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
          <span className="font-semibold text-highlight-fg">Needs acknowledgement</span>
        ) : null}
      </div>
    </article>
  );
}
