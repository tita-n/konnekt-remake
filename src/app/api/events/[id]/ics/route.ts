import type { NextRequest } from "next/server";
import { apiError, socialApi } from "@/lib/api/social";
import { buildIcs, icsFileName } from "@/lib/domain/event-time";
import { getEventDetail } from "@/lib/services/events";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await socialApi(request);
  if ("response" in context) return context.response;
  try {
    const { id } = await params;
    const detail = await getEventDetail(context.viewer, id, { recordView: false });
    const ics = buildIcs({
      events: [
        {
          id: detail.event.id,
          title: detail.event.title,
          description: detail.event.description,
          startsAt: detail.event.startsAt,
          endsAt: detail.event.endsAt,
          venueName: detail.event.venueName,
          status: detail.event.status,
          url: `/events/${id}`,
          sequence: detail.changeLog.length,
        },
      ],
      calendarName: detail.event.title,
      baseUrl: new URL(request.url).origin,
    });
    return new Response(ics, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${icsFileName(detail.event.title)}"`,
        "Cache-Control": "private, no-store, max-age=0",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
