"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarPlus, Ticket } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/display";
import { apiGet } from "@/lib/posts/client";
import { EventCard } from "./event-card";
import type { EventRsvpStatus } from "@/lib/domain/events";
import type { SerializedEvent } from "@/lib/services/events";

type Tab = "going" | "interested" | "waitlisted" | "past";
type MyEvent = SerializedEvent & { rsvpStatus: EventRsvpStatus; hasTicket: boolean };

const TABS = [
  { tab: "going", label: "Going" },
  { tab: "interested", label: "Interested" },
  { tab: "waitlisted", label: "Waitlist" },
  { tab: "past", label: "Past" },
] as const;

export function MyEvents({ initialTab, initialEvents }: { initialTab: Tab; initialEvents: MyEvent[] }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [events, setEvents] = useState<MyEvent[]>(initialEvents);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (nextTab: Tab) => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiGet<{ events: MyEvent[] }>(`/api/events/mine?tab=${nextTab}`);
      setEvents(data.events);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load your events.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === initialTab && events === initialEvents) return;
    void load(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  return (
    <div className="space-y-4 pb-12">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-h1 text-fg">My events</h1>
          <p className="mt-1 text-small text-fg-muted">Your tickets and RSVPs in one place.</p>
        </div>
        {/* File download: a document navigation, not a client-side page link. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/api/events/ics"
          className="mt-1 inline-flex min-h-9 items-center gap-1 rounded-button border border-border px-3 text-tiny font-semibold text-fg hover:bg-surface-2"
        >
          <CalendarPlus aria-hidden="true" className="size-4" />
          Export .ics
        </a>
      </header>

      <div className="flex gap-2 overflow-x-auto" role="tablist" aria-label="My event lists">
        {TABS.map((entry) => (
          <button
            key={entry.tab}
            type="button"
            role="tab"
            aria-selected={tab === entry.tab}
            onClick={() => setTab(entry.tab)}
            className={`min-h-9 shrink-0 rounded-chip border px-3 text-small font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
              tab === entry.tab ? "border-accent bg-accent-soft text-accent-soft-fg" : "border-border text-fg-muted hover:bg-surface-2"
            }`}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading your events">
          {[0, 1].map((key) => (
            <Skeleton key={key} className="h-72 w-full" rounded="rounded-card" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-card border border-border bg-surface">
          <ErrorState description={error} onRetry={() => void load(tab)} />
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-card border border-border bg-surface">
          <EmptyState
            illustration="events"
            title={tab === "past" ? "Nothing in the archive yet" : "Nothing here yet"}
            description={tab === "going" ? "RSVP to an event and your ticket will live here." : "Events you save will show up in this list."}
            action={<ButtonLink href="/events">Browse events</ButtonLink>}
          />
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {events.map((event) => (
            <li key={event.id} className="space-y-2">
              <EventCard event={event} rsvpStatus={event.rsvpStatus} />
              <div className="flex items-center gap-2">
                {event.rsvpStatus === "GOING" && event.checkInEnabled && !event.ended ? (
                  <ButtonLink href={`/events/${event.id}/ticket`} size="sm" variant="secondary">
                    <Ticket aria-hidden="true" className="size-4" />
                    {event.hasTicket ? "My ticket" : "Get ticket"}
                  </ButtonLink>
                ) : null}
                <a
                  href={`/api/events/${event.id}/ics`}
                  className="inline-flex min-h-8 items-center gap-1 rounded-button px-2 text-tiny font-semibold text-fg-muted underline underline-offset-4"
                >
                  Add to calendar
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
