import Link from "next/link";
import { CalendarDays, ChevronRight } from "lucide-react";
import { EventCard } from "@/components/events/event-card";
import { AnnouncementBanners } from "@/components/official/banners";
import type { AnnouncementBanner } from "@/lib/services/announcements";
import type { SerializedEvent } from "@/lib/services/events";

/**
 * Pulse event modules. Each renders at most once per page and only when it has
 * something to show, so a quiet campus never gets empty rails.
 */
export function PulseEventModules({
  banners,
  happeningNow,
  upcoming,
  viewerState,
}: {
  banners: AnnouncementBanner;
  happeningNow: SerializedEvent[];
  upcoming: SerializedEvent | null;
  viewerState: Record<string, { status: string | null; hasTicket: boolean; staffRole: string | null }>;
}) {
  const hasBanners = Boolean(banners.critical || banners.official);
  if (!hasBanners && happeningNow.length === 0 && !upcoming) return null;

  return (
    <div className="space-y-4 px-3.5 pt-3">
      <AnnouncementBanners banners={banners} />

      {happeningNow.length > 0 ? (
        <section aria-labelledby="pulse-happening-now">
          <div className="mb-2 flex items-center justify-between">
            <h2 id="pulse-happening-now" className="flex items-center gap-2 text-h3 text-fg">
              <span className="inline-flex items-center gap-1 rounded-chip bg-highlight-soft px-2 py-0.5 text-[0.6875rem] font-extrabold uppercase tracking-wide highlight-ink">
                <span className="size-1.5 rounded-full bg-highlight" aria-hidden="true" />
                Live
              </span>
              Happening now
            </h2>
            <Link href="/events" className="inline-flex min-h-9 items-center text-tiny font-semibold text-accent-ink">
              All events
              <ChevronRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
          <div className="no-scrollbar flex gap-3 overflow-x-auto pb-1">
            {happeningNow.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                compact
                rsvpStatus={(viewerState[event.id]?.status as never) ?? null}
                className="w-[280px] shrink-0"
              />
            ))}
          </div>
        </section>
      ) : null}

      {upcoming ? (
        <section aria-labelledby="pulse-upcoming">
          <div className="mb-2 flex items-center justify-between">
            <h2 id="pulse-upcoming" className="flex items-center gap-1.5 text-h3 text-fg">
              <CalendarDays aria-hidden="true" className="size-4 text-fg-muted" />
              Upcoming on campus
            </h2>
            <Link href="/events" className="inline-flex min-h-9 items-center text-tiny font-semibold text-accent-ink">
              See all
              <ChevronRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
          <EventCard event={upcoming} rsvpStatus={(viewerState[upcoming.id]?.status as never) ?? null} />
        </section>
      ) : null}
    </div>
  );
}
