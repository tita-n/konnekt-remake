import type { NextRequest } from "next/server";
import { apiError, noStore, socialApi } from "@/lib/api/social";
import { isEventCategory, type EventStatus } from "@/lib/domain/events";
import { listEventsForModeration } from "@/lib/services/event-admin";

const STATUSES: EventStatus[] = ["SCHEDULED", "CANCELLED", "REMOVED"];

export async function GET(request: NextRequest) {
  const context = await socialApi(request);
  if ("response" in context) return context.response;
  try {
    const params = new URL(request.url).searchParams;
    const status = params.get("status");
    return noStore({
      events: await listEventsForModeration(context.viewer, {
        q: params.get("q") ?? undefined,
        status: STATUSES.includes(status as EventStatus) ? (status as EventStatus) : "ALL",
        category: isEventCategory(params.get("category")) ? (params.get("category") as never) : null,
      }),
    });
  } catch (error) {
    return apiError(error);
  }
}
