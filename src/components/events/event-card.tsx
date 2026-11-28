import Link from "next/link";
import { CalendarDays, Check, Clock3, MapPin, ShieldCheck, Ticket } from "lucide-react";
import { Avatar } from "@/components/ui/display";
import { cn } from "@/lib/utils";
import { eventDateParts, formatEventTime } from "@/lib/domain/event-display";
import { eventAudienceLabel, EVENT_CATEGORY_LABELS, type EventCategory } from "@/lib/domain/events";
import type { SerializedEvent } from "@/lib/services/events";
import type { EventRsvpStatus } from "@/lib/domain/events";

/**
 * The ticket-shaped event card (docs/UI-CONVENTIONS.md, "Phase 3 event surfaces").
 * Cover, body, then a dashed perforation above the RSVP stub with the notches cut
 * out of the card edge by `.event-ticket` in globals.css.
 */
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
  const { month, day } = eventDateParts(event.startsAt, event.timezone);
  const organiserName =
    event.organiserKind === "COMMUNITY"
      ? event.community?.name ?? "Community"
      : event.organiserKind === "OFFICIAL"
        ? event.officialAccount?.name ?? "Official account"
        : (event.organisers?.fullName ?? "Student organiser");
  const badgeLabel =
    event.organiserKind === "OFFICIAL" ? "Official account" : event.organiserKind === "COMMUNITY" ? "Community" : "Student organiser";
  const cancelled = event.status === "CANCELLED";
  const ended = Boolean(event.ended);
  const isFull = event.capacity != null && event.goingCount >= event.capacity;
  const monthLabel = new Intl.DateTimeFormat("en-NG", { timeZone: event.timezone, month: "short" })
    .format(new Date(event.startsAt))
    .toUpperCase();
  const going = (event.attendeePreview ?? []).slice(0, 3);

  return (
    <article
      className={cn(
        "event-ticket flex flex-col overflow-hidden rounded-card border border-border bg-surface",
        (cancelled || ended) && "bg-surface-2",
        className,
      )}
      aria-labelledby={`event-${event.id}-title`}
    >
      {cancelled ? (
        <p className="flex items-center justify-center gap-1.5 bg-danger-soft py-1.5 text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-danger">
          <span className="size-1.5 rounded-full bg-danger" aria-hidden="true" />
          Cancelled
        </p>
      ) : null}

      <Link href={`/events/${event.id}`} aria-label={event.title} className="group block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-surface-3">
          {event.coverUrl ? (
            // Covers are re-encoded by the upload pipeline.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={event.coverUrl} alt="" className="size-full object-cover" loading="lazy" decoding="async" />
          ) : (
            <div
              className="flex size-full items-end p-4"
              style={{ backgroundColor: event.categoryColor }}
            >
              <span className="rounded-chip bg-black/30 px-2 py-1 text-tiny font-semibold text-white">
                {EVENT_CATEGORY_LABELS[event.category as EventCategory] ?? "Event"}
              </span>
            </div>
          )}
          <div className="absolute right-3 top-3 flex items-center gap-1.5">
            {event.live ? (
              <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-chip bg-highlight px-2 py-1 text-[0.6875rem] font-extrabold uppercase tracking-[0.04em] text-highlight-fg">
                <span className="size-1.5 rounded-full bg-highlight-fg" aria-hidden="true" />
                Live
              </span>
            ) : null}
          </div>
          {!cancelled && event.lastMaterialChangeAt ? (
            <span className="absolute left-3 top-3 rounded-chip border border-border bg-surface px-2 py-1 text-[0.6875rem] font-semibold text-fg-muted">
              Updated
            </span>
          ) : null}
          {ended && !cancelled ? (
            <span className="absolute left-3 top-3 rounded-chip border border-border bg-surface px-2 py-1 text-[0.6875rem] font-semibold text-fg-muted">
              Ended
            </span>
          ) : null}
        </div>
      </Link>

      <div className={cn("flex flex-1 gap-3 p-4", (cancelled || ended) && "opacity-80")}>
        <div
          className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-button bg-surface-2 border border-border"
          aria-hidden="true"
        >
          <span className="nums text-[0.6875rem] font-semibold uppercase leading-[1.14] tracking-[0.03em] text-accent-ink">{monthLabel}</span>
          <span className="nums font-display text-[1.375rem] font-bold leading-[1.19] text-fg">{day}</span>
        </div>
        <div className="min-w-0 flex-1">
          <Link href={`/events/${event.id}`} className="block min-h-11 -my-2 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
            <h2 id={`event-${event.id}-title`} className="line-clamp-2 font-display text-[1.0625rem] font-semibold leading-6 text-fg">
              {event.title}
            </h2>
          </Link>
          <p className="mt-1 flex items-center gap-1.5 text-small leading-5 text-fg-muted">
            <MapPin aria-hidden="true" className="size-4 shrink-0" />
            <span className="line-clamp-2">{event.venueName}</span>
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-small leading-5 text-fg-muted">
            <CalendarDays aria-hidden="true" className="size-4 shrink-0" />
            <span className="nums line-clamp-2">
              {formatEventTime(event.startsAt, event.timezone)}
              {event.endsAt ? ` – ${formatEventTime(event.endsAt, event.timezone)}` : ""}
            </span>
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

      <div className="event-ticket-perforation flex h-14 items-center justify-between gap-2 px-4">
        <div className="flex min-w-0 items-center gap-2">
          {going.length > 0 ? (
            <span className="flex shrink-0 -space-x-2" aria-hidden="true">
              {going.map((attendee) => (
                <Avatar key={attendee.id} name={attendee.fullName} seed={attendee.username} src={attendee.photoUrl} size="2xs" className="ring-2 ring-surface" />
              ))}
            </span>
          ) : (
            <Ticket aria-hidden="true" className="size-4 shrink-0 text-fg-subtle" />
          )}
          <span className="truncate text-[0.8125rem] leading-[1.375rem] nums text-fg-muted">
            {event.goingCount > 0 ? `${event.goingCount} going` : "Be the first to go"}
            {event.waitlistCount > 0 ? ` · ${event.waitlistCount} waitlisted` : ""}
          </span>
        </div>
        <EventCardState event={event} rsvpStatus={rsvpStatus} isFull={isFull} />
      </div>
      {!compact ? (
        <p className="sr-only">
          Audience: {eventAudienceLabel(event.audienceKind)}. {event.live ? "Happening now." : ""}
        </p>
      ) : null}
    </article>
  );
}

/** One compact control that carries every RSVP state, with text and an icon. */
function EventCardState({
  event,
  rsvpStatus,
  isFull,
}: {
  event: SerializedEvent;
  rsvpStatus?: EventRsvpStatus | null;
  isFull: boolean;
}) {
  const base =
    "inline-flex min-h-11 -my-1 shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-button px-3 text-tiny font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";
  const cancelled = event.status === "CANCELLED";
  const ended = Boolean(event.ended);

  if (cancelled) {
    return (
      <span className={cn(base, "border border-border bg-surface text-fg-muted")}>
        <Clock3 aria-hidden="true" className="size-3.5" />
        Cancelled
      </span>
    );
  }
  if (ended) {
    return (
      <span className={cn(base, "border border-border bg-surface text-fg-muted")}>
        Ended
      </span>
    );
  }
  if (rsvpStatus === "GOING") {
    return (
      <Link href={`/events/${event.id}`} className={cn(base, "border border-transparent bg-success-soft text-success")}>
        <Check aria-hidden="true" className="size-3.5" strokeWidth={3} />
        Going
      </Link>
    );
  }
  if (rsvpStatus === "WAITLISTED") {
    return (
      <Link href={`/events/${event.id}`} className={cn(base, "border border-border bg-surface text-fg-muted")}>
        <Clock3 aria-hidden="true" className="size-3.5" />
        Waitlisted
      </Link>
    );
  }
  if (rsvpStatus === "INTERESTED") {
    return (
      <Link href={`/events/${event.id}`} className={cn(base, "accent-tile border border-transparent")}>
        Interested
      </Link>
    );
  }
  if (isFull) {
    return (
      <Link href={`/events/${event.id}`} className={cn(base, "border border-border-strong bg-surface text-fg hover:bg-surface-2")}>
        Join waitlist
      </Link>
    );
  }
  return (
    <Link href={`/events/${event.id}`} className={cn(base, "bg-accent text-accent-fg hover:bg-accent-hover")}>
      RSVP
    </Link>
  );
}
