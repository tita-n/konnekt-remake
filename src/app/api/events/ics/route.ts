import type { NextRequest } from "next/server";
import { apiError, socialApi } from "@/lib/api/social";
import { buildIcs } from "@/lib/domain/event-time";
import { getMyEventsForCalendar } from "@/lib/services/events";

export async function GET(request: NextRequest) {
  const context = await socialApi(request);
  if ("response" in context) return context.response;
  try {
    const rows = await getMyEventsForCalendar(context.viewer);
    const ics = buildIcs({
      events: rows.map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        startsAt: row.startsAt,
        endsAt: row.endsAt,
        venueName: row.venueName,
        status: row.status,
        url: `/events/${row.id}`,
      })),
      calendarName: "My Konnekt events",
      baseUrl: new URL(request.url).origin,
    });
    return new Response(ics, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'attachment; filename="konnekt-my-events.ics"',
        "Cache-Control": "private, no-store, max-age=0",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
