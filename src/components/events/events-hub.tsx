"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, RefreshCw } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/display";
import { SegmentedControl } from "@/components/ui/navigation";
import { EventCard } from "./event-card";
import { apiGet } from "@/lib/posts/client";
import { cn } from "@/lib/utils";
import { eventDateKey, eventDateParts } from "@/lib/domain/event-display";
import { EVENT_CATEGORIES, type EventCategory } from "@/lib/domain/events";
import type { EventListResult, SerializedEvent } from "@/lib/services/events";
import type { EventRsvpStatus } from "@/lib/domain/events";

type Tab = "for-you" | "this-week" | "calendar";

const TABS: Array<{ value: Tab; label: string }> = [
  { value: "for-you", label: "For you" },
  { value: "this-week", label: "This week" },
  { value: "calendar", label: "Calendar" },
];

function groupForYou(events: SerializedEvent[], timezone: string) {
  const today = eventDateKey(new Date(), timezone);
  const groups: Array<{ label: string; events: SerializedEvent[] }> = [
    { label: "Today", events: [] },
    { label: "This week", events: [] },
    { label: "Later", events: [] },
  ];
  for (const event of events) {
    const key = eventDateKey(event.startsAt, timezone);
    if (key === today) groups[0]!.events.push(event);
    else if (new Date(event.startsAt).getTime() - Date.now() <= 7 * 24 * 60 * 60 * 1000) groups[1]!.events.push(event);
    else groups[2]!.events.push(event);
  }
  return groups.filter((group) => group.events.length > 0);
}

function CalendarGrid({
  year,
  month,
  events,
  timezone,
  onMonthChange,
  selectedDay,
  onSelectDay,
}: {
  year: number;
  month: number;
  events: SerializedEvent[];
  timezone: string;
  onMonthChange: (year: number, month: number) => void;
  selectedDay: string | null;
  onSelectDay: (day: string | null) => void;
}) {
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthLabel = new Intl.DateTimeFormat("en-NG", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
  const byDay = new Map<string, number>();
  for (const event of events) {
    const parts = eventDateParts(event.startsAt, timezone);
    const key = `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
    byDay.set(key, (byDay.get(key) ?? 0) + 1);
  }
  const cells: Array<{ key: string; day: number } | null> = [];
  for (let index = 0; index < firstWeekday; index += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ key: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`, day });
  }
  const move = (delta: number) => {
    const next = new Date(Date.UTC(year, month - 1 + delta, 1));
    onMonthChange(next.getUTCFullYear(), next.getUTCMonth() + 1);
  };
  return (
    <div className="rounded-card border border-border bg-surface p-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => move(-1)}
          aria-label="Previous month"
          className="inline-flex size-10 items-center justify-center rounded-full text-fg hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          <ChevronLeft aria-hidden="true" className="size-5" />
        </button>
        <p className="text-h3 font-semibold text-fg" aria-live="polite">
          {monthLabel}
        </p>
        <button
          type="button"
          onClick={() => move(1)}
          aria-label="Next month"
          className="inline-flex size-10 items-center justify-center rounded-full text-fg hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          <ChevronRight aria-hidden="true" className="size-5" />
        </button>
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1 text-center">
        {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
          <span key={`${day}-${index}`} className="py-1 text-[0.625rem] font-bold uppercase text-fg-subtle" aria-hidden="true">
            {day}
          </span>
        ))}
        {cells.map((cell, index) =>
          cell ? (
            <button
              key={cell.key}
              type="button"
              onClick={() => onSelectDay(selectedDay === cell.key ? null : cell.key)}
              aria-pressed={selectedDay === cell.key}
              aria-label={`${cell.day}, ${byDay.get(cell.key) ?? 0} events`}
              className={cn(
                "relative flex aspect-square flex-col items-center justify-center rounded-button text-small font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
                selectedDay === cell.key ? "bg-accent text-accent-fg" : "text-fg hover:bg-surface-2",
              )}
            >
              {cell.day}
              {byDay.get(cell.key) ? (
                <span
                  className={cn("mt-0.5 size-1.5 rounded-full", selectedDay === cell.key ? "bg-accent-fg" : "bg-accent-ink")}
                  aria-hidden="true"
                />
              ) : null}
            </button>
          ) : (
            <span key={`empty-${index}`} aria-hidden="true" />
          ),
        )}
      </div>
    </div>
  );
}

export function EventsHub({
  initial,
  timezone,
  canCreate,
}: {
  initial: EventListResult;
  timezone: string;
  canCreate: boolean;
}) {
  const [tab, setTab] = useState<Tab>("for-you");
  const [category, setCategory] = useState<EventCategory | null>(null);
  const [feed, setFeed] = useState<EventListResult>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const now = new Date();
  const [month, setMonth] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const load = useCallback(
    async (nextTab: Tab, nextCategory: EventCategory | null, nextMonth: { year: number; month: number }) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ tab: nextTab });
        if (nextCategory) params.set("category", nextCategory);
        if (nextTab === "calendar") {
          params.set("year", String(nextMonth.year));
          params.set("month", String(nextMonth.month));
        }
        const { data } = await apiGet<EventListResult>(`/api/events?${params.toString()}`);
        setFeed(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't load events.");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (tab === "for-you" && !category) {
      setFeed(initial);
      return;
    }
    void load(tab, category, month);
  }, [tab, category, month, load, initial]);

  const groups = useMemo(() => groupForYou(feed.events, timezone), [feed.events, timezone]);
  const dayEvents = useMemo(() => {
    if (!selectedDay) return feed.events;
    return feed.events.filter((event) => {
      const parts = eventDateParts(event.startsAt, timezone);
      return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}` === selectedDay;
    });
  }, [feed.events, selectedDay, timezone]);

  return (
    <div className="px-1 pb-24 pt-2">
      <header className="flex items-start justify-between gap-3 px-3 pb-3 pt-4">
        <div>
          <h1 className="text-h1 text-fg">Events</h1>
          <p className="mt-1 text-small text-fg-muted">What&apos;s happening around your campus.</p>
        </div>
        <ButtonLink href="/events/mine" variant="secondary" size="sm" className="mt-1 whitespace-nowrap">
          My events
        </ButtonLink>
      </header>

      <div className="px-3">
        <SegmentedControl label="Event views" value={tab} onChange={setTab} options={TABS} />
      </div>

      <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto px-3 pb-1" role="group" aria-label="Filter by category">
        <button
          type="button"
          onClick={() => setCategory(null)}
          aria-pressed={category === null}
          className={cn(
            "min-h-9 shrink-0 rounded-chip border px-3 text-small font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
            category === null ? "border-accent bg-accent-soft text-accent-soft-fg" : "border-border text-fg-muted hover:bg-surface-2",
          )}
        >
          All
        </button>
        {EVENT_CATEGORIES.map((entry) => (
          <button
            key={entry.value}
            type="button"
            onClick={() => setCategory(category === entry.value ? null : entry.value)}
            aria-pressed={category === entry.value}
            className={cn(
              "min-h-9 shrink-0 rounded-chip border px-3 text-small font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
              category === entry.value
                ? "border-accent bg-accent-soft text-accent-soft-fg"
                : "border-border text-fg-muted hover:bg-surface-2",
            )}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <div className="mt-4 px-3">
        {error ? (
          <div className="rounded-card border border-border bg-surface">
            <ErrorState description={error} onRetry={() => void load(tab, category, month)} />
          </div>
        ) : loading ? (
          <div className="space-y-3" aria-busy="true" aria-label="Loading events">
            {[0, 1, 2].map((key) => (
              <Skeleton key={key} className="h-72 w-full" rounded="rounded-card" />
            ))}
          </div>
        ) : tab === "calendar" ? (
          <div className="space-y-4">
            <CalendarGrid
              year={month.year}
              month={month.month}
              events={feed.events}
              timezone={timezone}
              onMonthChange={(year, nextMonth) => {
                setMonth({ year, month: nextMonth });
                setSelectedDay(null);
              }}
              selectedDay={selectedDay}
              onSelectDay={setSelectedDay}
            />
            {dayEvents.length === 0 ? (
              <div className="rounded-card border border-border bg-surface">
                <EmptyState
                  illustration="events"
                  compact
                  title={selectedDay ? "Nothing on this day" : "No events this month"}
                  description="Try another day, or create something for your campus."
                  action={canCreate ? <ButtonLink href="/events/new">Create event</ButtonLink> : undefined}
                />
              </div>
            ) : (
              <ul className="space-y-3">
                {dayEvents.map((event) => (
                  <li key={event.id}>
                    <EventCard event={event} rsvpStatus={feed.viewer[event.id]?.status} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {tab === "for-you" && feed.happeningNow.length > 0 ? (
              <section aria-labelledby="happening-now">
                <h2 id="happening-now" className="mb-2 flex items-center gap-2 text-h3 text-fg">
                  <span className="inline-flex items-center gap-1 rounded-chip bg-highlight-soft px-2 py-0.5 text-[0.6875rem] font-extrabold uppercase tracking-wide text-highlight-fg">
                    <span className="size-1.5 rounded-full bg-highlight" aria-hidden="true" />
                    Live
                  </span>
                  Happening now
                </h2>
                <div className="no-scrollbar flex gap-3 overflow-x-auto pb-1">
                  {feed.happeningNow.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      rsvpStatus={feed.viewer[event.id]?.status}
                      compact
                      className="w-[290px] shrink-0"
                    />
                  ))}
                </div>
              </section>
            ) : null}

            {feed.events.length === 0 ? (
              <div className="rounded-card border border-border bg-surface">
                <EmptyState
                  illustration="events"
                  title="No events on the calendar"
                  description={canCreate ? "Be the first to put something on the calendar for your campus." : "New events will appear here as students and communities post them."}
                  action={canCreate ? <ButtonLink href="/events/new">Create event</ButtonLink> : undefined}
                />
              </div>
            ) : tab === "for-you" ? (
              groups.map((group) => (
                <section key={group.label} aria-labelledby={`group-${group.label.replace(/\s+/g, "-")}`}>
                  <h2 id={`group-${group.label.replace(/\s+/g, "-")}`} className="mb-2 text-h3 text-fg">
                    {group.label}
                  </h2>
                  <ul className="space-y-3">
                    {group.events.map((event) => (
                      <li key={event.id}>
                        <EventCard event={event} rsvpStatus={feed.viewer[event.id]?.status} />
                      </li>
                    ))}
                  </ul>
                </section>
              ))
            ) : (
              <ul className="space-y-3">
                {feed.events.map((event) => (
                  <li key={event.id}>
                    <EventCard event={event} rsvpStatus={feed.viewer[event.id]?.status} />
                  </li>
                ))}
              </ul>
            )}
            {feed.nextCursor ? (
              <button
                type="button"
                onClick={async () => {
                  const params = new URLSearchParams({ tab, cursor: feed.nextCursor ?? "" });
                  if (category) params.set("category", category);
                  setLoading(true);
                  try {
                    const { data } = await apiGet<EventListResult>(`/api/events?${params.toString()}`);
                    setFeed({ ...data, events: [...feed.events, ...data.events], viewer: { ...feed.viewer, ...data.viewer } });
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Couldn't load more events.");
                  } finally {
                    setLoading(false);
                  }
                }}
                className="mx-auto flex min-h-11 items-center gap-2 rounded-button border border-border px-4 text-small font-semibold text-fg hover:bg-surface-2"
              >
                <RefreshCw aria-hidden="true" className="size-4" />
                Load more
              </button>
            ) : null}
          </div>
        )}
      </div>

      {canCreate ? (
        <Link
          href="/events/new"
          className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 z-30 inline-flex min-h-12 items-center gap-2 rounded-full bg-accent px-5 text-small font-bold text-accent-fg shadow-create transition hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus lg:bottom-8 lg:right-8"
        >
          <Plus aria-hidden="true" className="size-5" />
          Create event
        </Link>
      ) : null}
    </div>
  );
}
