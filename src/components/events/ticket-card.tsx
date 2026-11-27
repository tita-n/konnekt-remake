"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "react-qr-code";
import { CalendarDays, CloudOff, MapPin, RotateCcw, ShieldCheck, Sun } from "lucide-react";
import { Avatar } from "@/components/ui/display";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/auth/auth-shell";
import { apiPost } from "@/lib/posts/client";
import { formatEventDate, formatEventTime } from "@/lib/domain/event-display";
import type { TicketMeta } from "@/lib/services/events";

const STORAGE_PREFIX = "konnekt.ticket.";

export interface TicketAttendee {
  fullName: string;
  username: string;
  photoUrl: string | null;
}

export function TicketCard({ meta, attendee }: { meta: TicketMeta; attendee?: TicketAttendee | null }) {
  const [code, setCode] = useState<string | null>(null);
  const [hasTicket, setHasTicket] = useState(meta.hasTicket);
  const [busy, setBusy] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      setCode(window.localStorage.getItem(`${STORAGE_PREFIX}${meta.event.id}`));
    } catch {
      setCode(null);
    }
  }, [meta.event.id]);

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await apiPost<{ code: string }>(`/api/events/${meta.event.id}/ticket`);
      setCode(result.code);
      setHasTicket(true);
      setConfirmRegenerate(false);
      try {
        window.localStorage.setItem(`${STORAGE_PREFIX}${meta.event.id}`, result.code);
      } catch {
        // The code is still displayed for this visit.
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create your ticket.");
    } finally {
      setBusy(false);
    }
  };

  if (meta.status !== "GOING") {
    return (
      <div className="rounded-card border border-border bg-surface p-5 text-center">
        <h1 className="text-h2 text-fg">No ticket yet</h1>
        <p className="mt-2 text-small text-fg-muted">RSVP as Going to get a QR ticket for this event.</p>
        <Link href={`/events/${meta.event.id}`} className="mt-4 inline-flex min-h-11 items-center justify-center rounded-button bg-accent px-4 text-small font-bold text-accent-fg">
          Back to event
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="text-tiny font-bold uppercase tracking-widest text-accent-ink">Your ticket</p>
        <h1 className="mt-1 font-display text-h2 font-extrabold text-fg">{meta.event.title}</h1>
      </div>

      <div className="event-ticket event-ticket-stub-48 overflow-hidden rounded-card border border-border bg-surface shadow-card">
        {/* Accent stripe across the top of the ticket. */}
        <span className="block h-1 w-full bg-accent" aria-hidden="true" />

        <div className="px-5 pb-4 pt-4">
          <div className="flex items-center gap-3">
            {attendee ? (
              <Avatar name={attendee.fullName} seed={attendee.username} src={attendee.photoUrl} size="sm" />
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.9375rem] font-semibold text-fg">{attendee?.fullName ?? "Your ticket"}</p>
              {attendee ? <p className="truncate text-tiny text-fg-muted">@{attendee.username}</p> : null}
            </div>
            <span className="shrink-0 rounded-chip bg-surface-2 px-2 py-0.5 text-[0.6875rem] font-semibold text-fg-muted">
              {meta.event.live ? "Entry open" : "Scan at the door"}
            </span>
          </div>

          <p className="mt-3 text-small font-semibold text-fg">
            {formatEventDate(meta.event.startsAt, meta.event.timezone)} · {formatEventTime(meta.event.startsAt, meta.event.timezone)}
          </p>
          <p className="mt-1 flex items-center gap-1 text-tiny text-fg-muted">
            <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
            <span className="truncate">{meta.event.venueName}</span>
          </p>

          {code ? (
            <div className="qr-tile mx-auto mt-4 w-fit">
              <QRCode value={code} size={200} level="M" style={{ height: "auto", width: "200px", maxWidth: "100%" }} aria-label="Ticket QR code" />
            </div>
          ) : (
            <div className="mt-4 flex aspect-square w-full max-w-[224px] flex-col items-center justify-center gap-2 rounded-card border border-dashed border-border-strong bg-surface-2 px-4 text-center mx-auto">
              <ShieldCheck aria-hidden="true" className="size-8 text-fg-subtle" />
              <p className="text-small leading-relaxed text-fg-muted">
                {hasTicket ? "Your ticket is on another device. Generate a new code to show it here." : "Generate your QR ticket before you arrive."}
              </p>
            </div>
          )}
        </div>

        <div className="event-ticket-perforation flex h-12 items-center justify-between gap-2 px-5">
          <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-chip bg-success-soft px-2 py-1 text-[0.6875rem] font-semibold text-success">
            <CloudOff aria-hidden="true" className="size-3.5" />
            Available offline
          </span>
          <span className="inline-flex min-w-0 items-center gap-1.5 whitespace-nowrap text-tiny text-fg-muted">
            <Sun aria-hidden="true" className="size-3.5 shrink-0" />
            <span className="truncate">Raise brightness</span>
          </span>
        </div>
      </div>

      <div className="rounded-card border border-border bg-surface-2 p-3">
        <p className="text-tiny text-fg-muted">
          This code is personal and single-use for check-in. Anyone with it can check you in, so don&apos;t post it publicly.
        </p>
        {code ? (
          <Button variant="secondary" size="sm" className="mt-2" loading={busy} onClick={() => (confirmRegenerate ? void generate() : setConfirmRegenerate(true))}>
            <RotateCcw aria-hidden="true" className="size-4" />
            {confirmRegenerate ? "Yes, replace my old code" : "Regenerate ticket"}
          </Button>
        ) : (
          <Button size="sm" className="mt-2" loading={busy} onClick={() => void generate()}>
            {hasTicket ? "Show a new code" : "Generate ticket"}
          </Button>
        )}
      </div>

      <div className="flex items-center justify-center gap-2 text-tiny text-fg-muted">
        <CalendarDays aria-hidden="true" className="size-4" />
        <a href={`/api/events/${meta.event.id}/ics`} className="font-semibold underline underline-offset-4">
          Add to calendar
        </a>
      </div>
      <FormMessage error={error} message={null} />
    </div>
  );
}
