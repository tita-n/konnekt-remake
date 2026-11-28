"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Flag, RotateCcw, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "./status-badge";
import { FormMessage } from "@/components/auth/auth-shell";
import { apiGet, apiPost } from "@/lib/posts/client";
import { formatEventDate, formatEventTime } from "@/lib/domain/event-display";
import { EVENT_CATEGORY_LABELS, eventAudienceLabel, type EventAudienceKind, type EventCategory, type EventStatus } from "@/lib/domain/events";

type ModerationEvent = {
  id: string;
  title: string;
  status: EventStatus;
  category: EventCategory;
  startsAt: string;
  endsAt: string;
  goingCount: number;
  organiser: string;
  organiserKind: string;
  audienceKind: EventAudienceKind;
  rsvpCount: number;
  reportCount: number;
};

const EVENT_STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "Scheduled",
  CANCELLED: "Cancelled",
  REMOVED: "Removed",
};

const STATUSES = [
  { value: "ALL", label: "All" },
  { value: "SCHEDULED", label: "Live" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "REMOVED", label: "Removed" },
] as const;

export function EventModerationConsole({
  initialEvents,
  timezone,
}: {
  initialEvents: ModerationEvent[];
  timezone: string;
}) {
  const [events, setEvents] = useState(initialEvents);
  const [status, setStatus] = useState<(typeof STATUSES)[number]["value"]>("ALL");
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handle = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        if (status !== "ALL") params.set("status", status);
        if (query.trim()) params.set("q", query.trim());
        const { data } = await apiGet<{ events: ModerationEvent[] }>(`/api/admin/events?${params.toString()}`);
        setEvents(data.events);
      } catch {
        // Keep the previous page visible if a filter request fails.
      }
    }, 250);
    return () => window.clearTimeout(handle);
  }, [status, query]);

  const moderate = async (id: string, action: "remove" | "restore") => {
    setBusyId(id);
    setError(null);
    try {
      await apiPost(`/api/admin/events/${id}/moderate`, { action });
      setEvents((current) =>
        current.map((entry) =>
          entry.id === id ? { ...entry, status: action === "remove" ? "REMOVED" : "SCHEDULED" } : entry,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't moderate that event.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-h1 text-fg">Events</h1>
        <p className="mt-1 text-small text-fg-muted">
          Moderating an event hides it from every student immediately. The organiser is notified in-app; restore puts it back.
        </p>
      </header>

      <div className="flex items-center gap-2 rounded-button border border-border bg-surface px-3">
        <Search aria-hidden="true" className="size-4 text-fg-subtle" />
        <label htmlFor="event-moderation-search" className="sr-only">
          Search events
        </label>
        <input
          id="event-moderation-search"
          value={query}
          onChange={(change) => setQuery(change.target.value)}
          placeholder="Search title or venue"
          className="min-h-11 flex-1 bg-transparent text-small text-fg focus:outline-none"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {STATUSES.map((entry) => (
          <button
            key={entry.value}
            type="button"
            onClick={() => setStatus(entry.value)}
            aria-pressed={status === entry.value}
            className={`min-h-11 rounded-chip border px-3 text-small font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
              status === entry.value ? "border-accent bg-accent-soft text-accent-soft-fg" : "border-border text-fg-muted"
            }`}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <FormMessage error={error} message={null} />

      <ul className="space-y-3">
        {events.length === 0 ? (
          <li className="rounded-card border border-border bg-surface p-4 text-small text-fg-muted">No events match.</li>
        ) : (
          events.map((event) => (
            <li key={event.id} className="rounded-card border border-border bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={event.status === "REMOVED" ? "danger" : event.status === "CANCELLED" ? "warning" : "success"}>
                  {EVENT_STATUS_LABELS[event.status] ?? event.status}
                </Badge>
                <span className="rounded-chip bg-surface-2 px-2 py-0.5 text-[0.625rem] font-semibold text-fg-muted">
                  {EVENT_CATEGORY_LABELS[event.category] ?? event.category}
                </span>
                {event.reportCount > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-chip bg-danger-soft px-2 py-0.5 text-[0.625rem] font-bold text-danger">
                    <Flag aria-hidden="true" className="size-3" />
                    {event.reportCount} report{event.reportCount === 1 ? "" : "s"}
                  </span>
                ) : null}
              </div>
              <h2 className="mt-2 text-h3 font-bold text-fg">{event.title}</h2>
              <p className="mt-1 text-tiny text-fg-muted">
                {event.organiser} · {formatEventDate(event.startsAt, timezone)} · {formatEventTime(event.startsAt, timezone)} ·{" "}
                {eventAudienceLabel(event.audienceKind)} · {event.goingCount} going
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={`/events/${event.id}`}
                  className="inline-flex min-h-11 items-center rounded-button border border-border px-3 text-tiny font-semibold text-fg transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  Open
                </Link>
                {event.status === "REMOVED" ? (
                  <Button size="sm" variant="secondary" loading={busyId === event.id} onClick={() => void moderate(event.id, "restore")}>
                    <RotateCcw aria-hidden="true" className="size-4" />
                    Restore
                  </Button>
                ) : (
                  <Button size="sm" variant="destructive" loading={busyId === event.id} onClick={() => void moderate(event.id, "remove")}>
                    <Trash2 aria-hidden="true" className="size-4" />
                    Remove
                  </Button>
                )}
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
