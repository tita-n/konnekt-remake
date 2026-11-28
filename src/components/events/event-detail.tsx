"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Check,
  Clock,
  Download,
  Flag,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Share2,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { Avatar } from "@/components/ui/display";
import { Button, ButtonLink } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/overlays";
import { FormMessage } from "@/components/auth/auth-shell";
import { apiPost, apiDelete, apiPatch } from "@/lib/posts/client";
import { cn } from "@/lib/utils";
import { formatEventDate, formatEventTime } from "@/lib/domain/event-display";
import {
  eventAudienceLabel,
  EVENT_CATEGORY_LABELS,
} from "@/lib/domain/events";
import { REPORT_REASONS, REPORT_REASON_LABELS } from "@/lib/domain/moderation";
import type { EventDetailResult } from "@/lib/services/events";
import type { ReportReason } from "@prisma/client";

function SheetAction({
  children,
  href,
  icon,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  href?: string;
  icon: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
}) {
  const className = cn(
    "flex min-h-12 w-full items-center gap-3 rounded-button px-3 text-left text-small font-semibold transition hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
    danger ? "text-danger" : "text-fg",
  );
  if (href) {
    return (
      <Link href={href} className={className}>
        <span aria-hidden="true" className="text-fg-muted">{icon}</span>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      <span aria-hidden="true" className="text-fg-muted">{icon}</span>
      {children}
    </button>
  );
}

function storeTicketCode(eventId: string, code: string) {
  try {
    window.localStorage.setItem(`konnekt.ticket.${eventId}`, code);
  } catch {
    // Storage can be unavailable in private modes; the ticket can be regenerated.
  }
}

export function EventDetail({
  detail,
  currentUser,
}: {
  detail: EventDetailResult;
  currentUser: { id: string; fullName: string; photoUrl: string | null };
}) {
  const router = useRouter();
  const { event, permissions } = detail;
  const [rsvpStatus, setRsvpStatus] = useState(detail.viewer.status);
  const [goingCount, setGoingCount] = useState(event.goingCount);
  const [waitlistCount, setWaitlistCount] = useState(event.waitlistCount);
  const [busy, setBusy] = useState<"GOING" | "INTERESTED" | "CANCEL" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ status: "GOING" | "WAITLISTED" } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareable, setShareable] = useState(event.shareable);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<ReportReason>("SOMETHING_ELSE");
  const [reportDetails, setReportDetails] = useState("");
  const [comments, setComments] = useState(detail.comments);
  const [commentBody, setCommentBody] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);
  const [updates, setUpdates] = useState(detail.updates);
  const [updateBody, setUpdateBody] = useState("");

  const rsvpOpen = detail.rsvpOpen && event.status === "SCHEDULED";
  const ended = event.ended;
  const rsvp = async (status: "GOING" | "INTERESTED") => {
    setBusy(status);
    setError(null);
    try {
      const result = await apiPost<{ status: "GOING" | "INTERESTED" | "WAITLISTED"; ticketCode: string | null; goingCount: number; waitlistCount: number }>(
        `/api/events/${event.id}/rsvp`,
        { status },
      );
      setRsvpStatus(result.status);
      setGoingCount(result.goingCount);
      setWaitlistCount(result.waitlistCount);
      if (result.ticketCode) storeTicketCode(event.id, result.ticketCode);
      if (result.status === "GOING" || result.status === "WAITLISTED") {
        setConfirmation({ status: result.status });
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save your RSVP.");
    } finally {
      setBusy(null);
    }
  };

  const cancelRsvp = async () => {
    setBusy("CANCEL");
    setError(null);
    try {
      await apiDelete(`/api/events/${event.id}/rsvp`);
      setRsvpStatus("CANCELLED");
      setGoingCount((count) => Math.max(0, count - (rsvpStatus === "GOING" ? 1 : 0)));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't cancel your RSVP.");
    } finally {
      setBusy(null);
    }
  };

  const toggleShare = async (next: boolean) => {
    try {
      await apiPatch(`/api/events/${event.id}`, { allowOutsideSharing: next });
      setShareable(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update sharing.");
    }
  };

  const cancelEvent = async () => {
    try {
      await apiPost(`/api/events/${event.id}/cancel`, { reason: cancelReason });
      setCancelOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't cancel the event.");
    }
  };

  const submitReport = async () => {
    try {
      await apiPost("/api/reports", { targetType: "EVENT", targetId: event.id, reason: reportReason, details: reportDetails });
      setReportOpen(false);
      setError(null);
      setConfirmation(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send the report.");
    }
  };

  const postComment = async () => {
    if (!commentBody.trim()) return;
    setCommentBusy(true);
    try {
      const created = await apiPost<{ id: string; body: string; createdAt: string }>(`/api/events/${event.id}/comments`, {
        body: commentBody,
      });
      setComments((current) => [
        ...current,
                      { ...created, author: { ...currentUser, username: "" }, replies: [] },
      ]);
      setCommentBody("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't post the comment.");
    } finally {
      setCommentBusy(false);
    }
  };

  const postUpdate = async () => {
    if (!updateBody.trim()) return;
    try {
      const created = await apiPost<{ id: string; body: string; createdAt: string }>(`/api/events/${event.id}/updates`, {
        body: updateBody,
      });
      setUpdates((current) => [
        { ...created, author: { username: "", fullName: currentUser.fullName, photoUrl: currentUser.photoUrl } },
        ...current,
      ]);
      setUpdateBody("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't post the update.");
    }
  };

  const organiserName =
    event.organiserKind === "COMMUNITY"
      ? event.community?.name ?? "Community"
      : event.organiserKind === "OFFICIAL"
        ? event.officialAccount?.name ?? "Official account"
        : event.organisers.fullName;

  return (
    <div className="pb-24">
      <div className="relative">
        <div className="aspect-[16/9] w-full overflow-hidden bg-surface-3 sm:rounded-b-card">
          {event.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={event.coverUrl} alt="" className="size-full object-cover" />
          ) : (
            <div
              className="flex size-full items-end p-4"
              style={{ backgroundColor: event.categoryColor }}
            >
              <span className="rounded-chip bg-black/35 px-2 py-1 text-tiny font-semibold text-white">
                {EVENT_CATEGORY_LABELS[event.category as keyof typeof EVENT_CATEGORY_LABELS] ?? "Event"}
              </span>
            </div>
          )}
        </div>
        <div className="absolute right-3 top-3 flex gap-2">
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            aria-label="Share event"
            className="inline-flex size-11 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur hover:bg-black/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <Share2 aria-hidden="true" className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Event options"
            aria-haspopup="dialog"
            className="inline-flex size-11 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur hover:bg-black/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <MoreHorizontal aria-hidden="true" className="size-5" />
          </button>
        </div>
        {event.live ? (
          <span className="absolute left-3 top-3 inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-chip bg-highlight px-2.5 py-1 text-[0.6875rem] font-extrabold uppercase tracking-[0.04em] text-highlight-fg">
            <span className="size-1.5 rounded-full bg-highlight-fg" aria-hidden="true" />
            Live now
          </span>
        ) : null}
      </div>

      <div className="px-4">
        <div className="mt-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-tiny font-bold uppercase tracking-wide text-accent-ink">
              {EVENT_CATEGORY_LABELS[event.category as keyof typeof EVENT_CATEGORY_LABELS] ?? "Event"}
            </p>
            <h1 className="mt-1 font-display text-[1.5rem] font-extrabold leading-tight text-fg">{event.title}</h1>
          </div>
        </div>

        {event.status === "CANCELLED" ? (
          <div className="mt-4 rounded-card border border-danger/40 bg-danger-soft p-3" role="status">
            <p className="text-small font-bold text-fg">This event was cancelled.</p>
            {event.cancelReason ? <p className="mt-1 text-small text-fg-muted">{event.cancelReason}</p> : null}
          </div>
        ) : null}

        {event.lastMaterialChangeAt ? (
          <details className="mt-4 rounded-card border border-border bg-surface-2 p-3">
            <summary className="min-h-8 cursor-pointer list-none text-small font-bold text-fg marker:hidden">Updated by the organiser</summary>
            <ul className="mt-2 space-y-1 text-small text-fg-muted">
              {event.materialChanges.map((change, index) => (
                <li key={`${change.at}-${index}`}>
                  {formatEventDate(change.at, event.timezone)}: {change.fields.includes("time") ? "time changed" : ""}
                  {change.fields.length > 1 ? " and " : ""}
                  {change.fields.includes("venue") ? "venue changed" : ""}
                  {change.previous.venueName ? ` · previous venue: ${change.previous.venueName}` : ""}
                </li>
              ))}
            </ul>
          </details>
        ) : null}

        <div className="mt-4 flex items-center gap-3 rounded-card border border-border bg-surface p-3">
          <Avatar
            name={organiserName}
            src={event.organiserKind === "USER" ? event.organisers.photoUrl : null}
            size="sm"
            official={event.organiserKind === "OFFICIAL"}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-small font-semibold text-fg">{organiserName}</p>
            <p className="text-tiny text-fg-muted">
              {event.organiserKind === "COMMUNITY" ? "Community organiser" : event.organiserKind === "OFFICIAL" ? "Official account" : "Student organiser"}
            </p>
          </div>
          {event.organiserKind === "OFFICIAL" ? (
            <span className="inline-flex items-center gap-1 rounded-chip bg-accent-soft px-2 py-1 text-[0.6875rem] font-bold text-accent-soft-fg">
              <ShieldCheck aria-hidden="true" className="size-3.5" />
              Official
            </span>
          ) : null}
        </div>

        <dl className="mt-4 space-y-3 rounded-card border border-border bg-surface p-4 text-small">
          <div className="flex items-start gap-3">
            <span className="accent-tile size-9 shrink-0" aria-hidden="true">
              <CalendarDays className="size-[18px]" />
            </span>
            <div>
              <dt className="sr-only">Date</dt>
              <dd className="text-fg">{formatEventDate(event.startsAt, event.timezone)}</dd>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="accent-tile size-9 shrink-0" aria-hidden="true">
              <Clock className="size-[18px]" />
            </span>
            <div>
              <dt className="sr-only">Time</dt>
              <dd className="text-fg">
                {formatEventTime(event.startsAt, event.timezone)} – {formatEventTime(event.endsAt, event.timezone)}
              </dd>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="accent-tile size-9 shrink-0" aria-hidden="true">
              <MapPin className="size-[18px]" />
            </span>
            <div>
              <dt className="sr-only">Venue</dt>
              <dd className="text-fg">
                {event.venueName}
                {event.venueNote ? <span className="block text-tiny text-fg-muted">{event.venueNote}</span> : null}
                {event.place?.latitude && event.place?.longitude ? (
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${event.place.latitude}&mlon=${event.place.longitude}#map=17/${event.place.latitude}/${event.place.longitude}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="mt-1 flex w-fit min-h-11 items-center text-tiny font-semibold text-accent-ink underline underline-offset-4"
                  >
                    Open in Maps
                  </a>
                ) : null}
              </dd>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="accent-tile size-9 shrink-0" aria-hidden="true">
              <Users className="size-[18px]" />
            </span>
            <div>
              <dt className="sr-only">Audience</dt>
              <dd className="text-fg">{eventAudienceLabel(event.audienceKind)}</dd>
            </div>
          </div>
          {event.capacity !== null ? (
            <div className="pt-1">
              <dt className="sr-only">Capacity</dt>
              <dd>
                <div className="flex items-center justify-between text-tiny text-fg-muted">
                  <span>
                    {goingCount} of {event.capacity} spots taken
                  </span>
                  {event.capacityRemaining === 0 ? <span className="font-bold text-warning">Full</span> : null}
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-valuemin={0} aria-valuemax={event.capacity} aria-valuenow={goingCount}>
                  <div className="h-full bg-accent" style={{ width: `${Math.min(100, (goingCount / event.capacity) * 100)}%` }} />
                </div>
              </dd>
            </div>
          ) : null}
        </dl>

        <p className="mt-3 text-tiny text-fg-subtle">
          Organisers can see the name, department and level of students who RSVP. You can hide your
          attendance from other students in Settings → Privacy.
        </p>

        {rsvpStatus === "WAITLISTED" ? (
          <p className="mt-3 rounded-card border border-warning/40 bg-warning-soft p-3 text-small font-semibold text-fg">
            You&apos;re on the waitlist. We&apos;ll move you to Going automatically if a spot opens.
          </p>
        ) : null}
        {event.capacityRemaining === 0 && rsvpStatus !== "GOING" ? (
          <p className="mt-3 text-small font-semibold text-warning">This event is full.</p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {event.status === "SCHEDULED" && !ended ? (
            <>
              <Button
                onClick={() => void rsvp("GOING")}
                loading={busy === "GOING"}
                disabled={rsvpStatus === "GOING" || busy !== null || !rsvpOpen}
                variant="primary"
              >
                {rsvpStatus === "GOING" ? "You're going" : "I'm going"}
              </Button>
              <Button
                onClick={() => void rsvp("INTERESTED")}
                loading={busy === "INTERESTED"}
                disabled={rsvpStatus === "INTERESTED" || busy !== null || !rsvpOpen}
                variant="secondary"
              >
                {rsvpStatus === "INTERESTED" ? "Interested" : "Interested"}
              </Button>
              {rsvpStatus ? (
                <Button onClick={() => void cancelRsvp()} loading={busy === "CANCEL"} variant="ghost">
                  Cancel RSVP
                </Button>
              ) : null}
            </>
          ) : (
            <p className="text-small font-semibold text-fg-muted">{event.status === "CANCELLED" ? "RSVPs are closed." : "This event has ended."}</p>
          )}
          <a
            href={`/api/events/${event.id}/ics`}
            className="inline-flex min-h-12 items-center gap-2 rounded-button border border-border px-4 text-small font-semibold text-fg transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            <Download aria-hidden="true" className="size-[18px]" />
            Add to calendar
          </a>
          {rsvpStatus === "GOING" && event.checkInEnabled ? (
            <ButtonLink href={`/events/${event.id}/ticket`} variant="secondary">
              My ticket
            </ButtonLink>
          ) : null}
        </div>
        {!rsvpOpen && event.status === "SCHEDULED" && !ended ? (
          <p className="mt-2 text-tiny text-fg-muted">RSVPs are closed.</p>
        ) : null}
        <FormMessage error={error} message={null} />

        <section className="mt-6" aria-labelledby="about-event">
          <h2 id="about-event" className="text-h3 text-fg">
            About this event
          </h2>
          <p className="mt-2 whitespace-pre-line text-small leading-relaxed text-fg">{event.description}</p>
        </section>

        <section className="mt-6" aria-labelledby="attendees">
          <div className="flex items-center justify-between">
            <h2 id="attendees" className="text-h3 text-fg">
              Who&apos;s going
            </h2>
            {permissions.canViewAttendees ? (
              <Link href={`/events/${event.id}/dashboard#attendees`} className="inline-flex min-h-11 items-center text-small font-semibold text-accent-ink underline underline-offset-4">
                Attendee list
              </Link>
            ) : null}
          </div>
          <div className="mt-2 flex items-center gap-3 rounded-card border border-border bg-surface p-3">
            <span className="flex -space-x-2">
              {detail.attendees.preview.map((attendee) => (
                <Avatar key={attendee.id} name={attendee.fullName} src={attendee.photoUrl} size="sm" className="ring-2 ring-surface" />
              ))}
            </span>
            <p className="text-small text-fg-muted">
              {detail.attendees.count > 0 ? `${detail.attendees.count} going` : "No RSVPs yet"}
              {detail.attendees.hiddenCount > 0 ? ` · ${detail.attendees.hiddenCount} keeping their attendance private` : ""}
            </p>
          </div>
        </section>

        {updates.length > 0 || permissions.canPostUpdate ? (
          <section className="mt-6" aria-labelledby="event-updates">
            <h2 id="event-updates" className="text-h3 text-fg">
              Organiser updates
            </h2>
            {permissions.canPostUpdate ? (
              <div className="mt-2 rounded-card border border-border bg-surface p-3">
                <label htmlFor="event-update-body" className="text-small font-semibold text-fg">
                  Post an update to attendees
                </label>
                <textarea
                  id="event-update-body"
                  value={updateBody}
                  onChange={(event) => setUpdateBody(event.target.value)}
                  maxLength={1000}
                  rows={2}
                  className="mt-2 w-full rounded-button border border-border bg-bg px-3 py-2 text-small text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                />
                <Button size="sm" className="mt-2" onClick={() => void postUpdate()} disabled={!updateBody.trim()}>
                  Post update
                </Button>
              </div>
            ) : null}
            <ul className="mt-3 space-y-3">
              {updates.map((update) => (
                <li key={update.id} className="rounded-card border border-border bg-surface p-3">
                  <div className="flex items-center gap-2">
                    <Avatar name={update.author.fullName} src={update.author.photoUrl} size="2xs" />
                    <p className="text-tiny font-semibold text-fg">{update.author.fullName}</p>
                    <time className="text-tiny text-fg-subtle" dateTime={update.createdAt}>
                      {formatEventDate(update.createdAt, event.timezone)}
                    </time>
                  </div>
                  <p className="mt-2 whitespace-pre-line text-small text-fg">{update.body}</p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="mt-6" aria-labelledby="event-comments">
          <h2 id="event-comments" className="text-h3 text-fg">
            Comments
          </h2>
          {event.status === "SCHEDULED" && !ended ? (
            <div className="mt-2 flex items-end gap-2">
              <div className="flex-1">
                <label htmlFor="event-comment" className="sr-only">
                  Add a comment
                </label>
                <textarea
                  id="event-comment"
                  value={commentBody}
                  onChange={(value) => setCommentBody(value.target.value)}
                  maxLength={1000}
                  rows={2}
                  placeholder="Ask a question or share a plan…"
                  className="w-full rounded-button border border-border bg-surface px-3 py-2 text-small text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                />
              </div>
              <Button size="sm" onClick={() => void postComment()} loading={commentBusy} disabled={!commentBody.trim()}>
                <MessageCircle aria-hidden="true" className="size-4" />
                Post
              </Button>
            </div>
          ) : (
            <p className="mt-2 text-small text-fg-muted">Comments are closed for this event.</p>
          )}
          {comments.length === 0 ? (
            <p className="mt-3 text-small text-fg-muted">No comments yet.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {comments.map((comment) => (
                <li key={comment.id} className="rounded-card border border-border bg-surface p-3">
                  <div className="flex items-center gap-2">
                    <Avatar name={comment.author.fullName} src={comment.author.photoUrl} size="2xs" />
                    <p className="text-tiny font-semibold text-fg">{comment.author.fullName}</p>
                    <time className="text-tiny text-fg-subtle" dateTime={comment.createdAt}>
                      {formatEventDate(comment.createdAt, event.timezone)}
                    </time>
                  </div>
                  <p className="mt-2 whitespace-pre-line text-small text-fg">{comment.body}</p>
                  {comment.replies.length > 0 ? (
                    <ul className="mt-2 space-y-2 border-l-2 border-border pl-3">
                      {comment.replies.map((reply) => (
                        <li key={reply.id}>
                          <p className="text-tiny font-semibold text-fg">{reply.author.fullName}</p>
                          <p className="text-small text-fg">{reply.body}</p>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <BottomSheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Event options">
        {permissions.canViewDashboard ? (
          <SheetAction href={`/events/${event.id}/dashboard`} icon={<Users aria-hidden="true" className="size-5" />}>
            Organiser dashboard
          </SheetAction>
        ) : null}
        {permissions.canCheckIn ? (
          <SheetAction href={`/events/${event.id}/scan`} icon={<Check aria-hidden="true" className="size-5" />}>
            Check-in scanner
          </SheetAction>
        ) : null}
        {permissions.canEdit ? (
          <SheetAction href={`/events/${event.id}/edit`} icon={<CalendarDays aria-hidden="true" className="size-5" />}>
            Edit event
          </SheetAction>
        ) : null}
        <SheetAction onClick={() => { setMenuOpen(false); setShareOpen(true); }} icon={<Share2 aria-hidden="true" className="size-5" />}>
          Share event
        </SheetAction>
        {permissions.canCancel ? (
          <SheetAction onClick={() => { setMenuOpen(false); setCancelOpen(true); }} icon={<X aria-hidden="true" className="size-5" />} danger>
            Cancel event
          </SheetAction>
        ) : null}
        {event.organiserKind !== "OFFICIAL" && currentUser.id !== event.organisers.id ? (
          <SheetAction onClick={() => { setMenuOpen(false); setReportOpen(true); }} icon={<Flag aria-hidden="true" className="size-5" />} danger>
            Report event
          </SheetAction>
        ) : null}
      </BottomSheet>

      <BottomSheet open={shareOpen} onClose={() => setShareOpen(false)} title="Share event">
        <div className="space-y-3 px-1 pb-4">
          <Image
            src={`/e/${event.id}/opengraph-image`}
            alt="Share card preview"
            className="w-full rounded-card border border-border"
            width={1200}
            height={630}
            unoptimized
          />
          <p className="text-small text-fg-muted">
            {shareable
              ? "Anyone with this link sees only the title, date, time, venue and university."
              : "This event is private. Only students in its audience can open it; the link shows a generic card."}
          </p>
          {permissions.isOrganiser && event.audienceKind === "PUBLIC" ? (
            <label className="flex min-h-11 items-center justify-between gap-3 rounded-card border border-border p-3 text-small font-semibold text-fg">
              Allow sharing outside Konnekt
              <input
                type="checkbox"
                checked={shareable}
                onChange={(change) => void toggleShare(change.target.checked)}
                className="size-5 accent-[var(--accent)]"
              />
            </label>
          ) : null}
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(`${window.location.origin}/e/${event.id}`);
                  setError(null);
                } catch {
                  setError("Copy failed. Select the link from the address bar instead.");
                }
              }}
            >
              Copy link
            </Button>
            <ButtonLink href={`/e/${event.id}`} variant="ghost">
              Open preview
            </ButtonLink>
          </div>
          <FormMessage error={error} message={null} />
        </div>
      </BottomSheet>

      <BottomSheet open={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancel this event?">
        <div className="space-y-3 px-1 pb-4">
          <p className="text-small text-fg-muted">Tickets are revoked and everyone sees a cancelled banner. This cannot be undone.</p>
          <label htmlFor="cancel-reason" className="text-small font-semibold text-fg">
            Reason for attendees
          </label>
          <textarea
            id="cancel-reason"
            value={cancelReason}
            onChange={(change) => setCancelReason(change.target.value)}
            maxLength={300}
            rows={3}
            className="w-full rounded-button border border-border bg-bg px-3 py-2 text-small text-fg"
          />
          <Button variant="destructive" onClick={() => void cancelEvent()} disabled={cancelReason.trim().length < 3}>
            Cancel event
          </Button>
        </div>
      </BottomSheet>

      <BottomSheet open={reportOpen} onClose={() => setReportOpen(false)} title="Report this event">
        <div className="space-y-3 px-1 pb-4">
          <label htmlFor="report-reason" className="text-small font-semibold text-fg">
            Why are you reporting it?
          </label>
          <select
            id="report-reason"
            value={reportReason}
            onChange={(change) => setReportReason(change.target.value as ReportReason)}
            className="min-h-11 w-full rounded-button border border-border bg-bg px-3 text-small text-fg"
          >
            {REPORT_REASONS.map((reason) => (
              <option key={reason} value={reason}>
                {REPORT_REASON_LABELS[reason]}
              </option>
            ))}
          </select>
          <label htmlFor="report-details" className="text-small font-semibold text-fg">
            Anything else? (optional)
          </label>
          <textarea
            id="report-details"
            value={reportDetails}
            onChange={(change) => setReportDetails(change.target.value)}
            rows={3}
            maxLength={500}
            className="w-full rounded-button border border-border bg-bg px-3 py-2 text-small text-fg"
          />
          <Button onClick={() => void submitReport()}>Send report</Button>
        </div>
      </BottomSheet>

      {confirmation ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="rsvp-confirmation">
          <div className="neo-brutal w-full max-w-sm rounded-card bg-surface p-5">
            <h2 id="rsvp-confirmation" className="font-display text-h2 font-extrabold text-fg">
              {confirmation.status === "WAITLISTED" ? "You're on the list!" : "You're going!"}
            </h2>
            <p className="mt-2 text-small text-fg-muted">
              {confirmation.status === "WAITLISTED"
                ? "We'll move you to Going if a spot opens."
                : event.checkInEnabled
                  ? "Your ticket is ready. Open it when you arrive so staff can scan you in."
                  : "Your RSVP is saved. See you there."}
            </p>
            <div className="mt-4 flex gap-2">
              {confirmation.status === "GOING" && event.checkInEnabled ? (
                <ButtonLink href={`/events/${event.id}/ticket`} variant="primary">
                  Open my ticket
                </ButtonLink>
              ) : null}
              <Button variant="secondary" onClick={() => setConfirmation(null)}>
                Done
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
