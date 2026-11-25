import Link from "next/link";
import { CalendarDays, MapPin, ShieldCheck, Users } from "lucide-react";
import { Avatar } from "@/components/ui/display";
import { cn } from "@/lib/utils";
import { eventDateParts, formatEventDayShort, formatEventTime } from "@/lib/domain/event-display";
import { eventAudienceLabel, EVENT_CATEGORY_LABELS, type EventCategory } from "@/lib/domain/events";
import type { SerializedEvent } from "@/lib/services/events";
import type { EventRsvpStatus } from "@/lib/domain/events";

const RSVP_LABEL: Record<EventRsvpStatus, string> = {
  GOING: "Going",
  INTERESTED: "Interested",
  WAITLISTED: "Waitlisted",
  CANCELLED: "RSVP",
};

export function EventCard({
  event,
  rsvpStatus,
  compact = false,
  className,
}: {
  event: SerializedEvent;
  rsvpStatus?: EventRsvpStatus | null;
  compact?: boolean;
  className?: string;
}) {
  const month = eventDateParts(event.startsAt, event.timezone).month;
  const day = eventDateParts(event.startsAt, event.timezone).day;
  const monthLabel = new Intl.DateTimeFormat("en-NG", { timeZone: event.timezone, month: "short" })
    .format(new Date(event.startsAt))
    .toUpperCase();
  const organiserName =
    event.organiserKind === "COMMUNITY"
      ? event.community?.name
      : event.organiserKind === "OFFICIAL"
        ? event.officialAccount?.name
        : event.organisers.fullName;
  const badgeLabel =
    event.organiserKind === "OFFICIAL" ? "Official account" : event.organiserKind === "COMMUNITY" ? "Community" : "Student organiser";

  return (
    <article
      className={cn(
        "event-ticket flex flex-col overflow-hidden rounded-card border border-border bg-surface shadow-card",
        event.status === "CANCELLED" && "opacity-90",
        className,
      )}
      aria-labelledby={`event-${event.id}-title`}
    >
      <Link href={`/events/${event.id}`} className="group block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-surface-3">
          {event.coverUrl ? (
            // Covers are re-encoded by the upload pipeline.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={event.coverUrl} alt="" className="size-full object-cover" loading="lazy" decoding="async" />
          ) : (
            <div
              className="flex size-full items-end p-4"
              style={{ background: `linear-gradient(135deg, ${event.categoryColor} 0%, color-mix(in srgb, ${event.categoryColor} 65%, #000) 100%)` }}
            >
              <span className="rounded-chip bg-black/35 px-2 py-1 text-tiny font-semibold text-white">
                {EVENT_CATEGORY_LABELS[event.category as EventCategory] ?? "Event"}
              </span>
            </div>
          )}
          {event.live ? (
            <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-chip bg-highlight px-2 py-1 text-[0.6875rem] font-extrabold uppercase tracking-wide text-[#3a2500]">
              <span className="size-1.5 rounded-full bg-[#3a2500]" aria-hidden="true" />
              Live
            </span>
          ) : null}
          {event.status === "CANCELLED" ? (
            <span className="absolute inset-x-3 top-3 rounded-button bg-danger-btn px-2 py-1 text-center text-tiny font-bold text-white">
              Cancelled
            </span>
          ) : null}
        </div>
      </Link>

      <div className="flex flex-1 gap-3 p-4">
        <div
          className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-button border border-border bg-surface-2"
          aria-label={formatEventDayShort(event.startsAt, event.timezone)}
        >
          <span className="text-[0.625rem] font-bold uppercase tracking-wide text-fg-muted">{monthLabel}</span>
          <span className="text-h3 font-bold tabular-nums text-fg">{day}</span>
        </div>
        <div className="min-w-0 flex-1">
          <Link href={`/events/${event.id}`} className="block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
            <h2 id={`event-${event.id}-title`} className="line-clamp-2 font-display text-[1.0625rem] font-bold leading-snug text-fg">
              {event.title}
            </h2>
          </Link>
          <p className="mt-1 flex items-center gap-1 text-tiny text-fg-muted">
            <CalendarDays aria-hidden="true" className="size-3.5 shrink-0" />
            <span>{formatEventTime(event.startsAt, event.timezone)}</span>
            <span aria-hidden="true">·</span>
            <span className="truncate">{formatEventDayShort(event.startsAt, event.timezone)}</span>
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-tiny text-fg-muted">
            <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
            <span className="truncate">{event.venueName}</span>
          </p>
          {!compact ? (
            <p className="mt-1.5 flex items-center gap-1 truncate text-tiny text-fg-subtle">
              {event.organiserKind === "OFFICIAL" ? (
                <ShieldCheck aria-hidden="true" className="size-3.5 shrink-0 text-accent-ink" />
              ) : null}
              <span className="truncate">{organiserName}</span>
              <span className="sr-only">({badgeLabel})</span>
            </p>
          ) : null}
        </div>
      </div>

      <div className="event-ticket-perforation flex items-center justify-between gap-2 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          {event.attendeePreview.length > 0 ? (
            <span className="flex -space-x-2" aria-hidden="true">
              {event.attendeePreview.slice(0, 4).map((attendee) => (
                <Avatar key={attendee.id} name={attendee.fullName} src={attendee.photoUrl} size="2xs" className="ring-2 ring-surface" />
              ))}
            </span>
          ) : (
            <Users aria-hidden="true" className="size-4 text-fg-subtle" />
          )}
          <span className="truncate text-tiny text-fg-muted">
            {event.goingCount > 0 ? `${event.goingCount} going` : "Be the first to RSVP"}
            {event.waitlistCount > 0 ? ` · ${event.waitlistCount} waitlisted` : ""}
          </span>
        </div>
        <Link
          href={`/events/${event.id}`}
          className={cn(
            "inline-flex min-h-9 shrink-0 items-center justify-center rounded-button border px-3 text-tiny font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
            rsvpStatus === "GOING" || rsvpStatus === "WAITLISTED" || rsvpStatus === "INTERESTED"
              ? "border-accent bg-accent-soft text-accent-soft-fg"
              : "border-border-strong bg-surface text-fg hover:bg-surface-2",
          )}
        >
          {rsvpStatus ? RSVP_LABEL[rsvpStatus] : "RSVP"}
        </Link>
      </div>
      {!compact ? (
        <p className="sr-only">
          Audience: {eventAudienceLabel(event.audienceKind)}. {event.live ? "Happening now." : ""}
        </p>
      ) : null}
    </article>
  );
}
