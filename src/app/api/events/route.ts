import type { NextRequest } from "next/server";
import { apiError, noStore, readJson, socialApi } from "@/lib/api/social";
import { withIdempotency } from "@/lib/api/idempotency";
import { isEventCategory, type EventAudienceKind, type EventCategory } from "@/lib/domain/events";
import { createEvent, listEvents, type EventListTab } from "@/lib/services/events";

const AUDIENCE_KINDS: EventAudienceKind[] = ["PUBLIC", "COLLEGE", "FACULTY", "DEPARTMENT", "LEVEL", "COMMUNITY"];

export async function GET(request: NextRequest) {
  const context = await socialApi(request);
  if ("response" in context) return context.response;
  try {
    const params = new URL(request.url).searchParams;
    const tab = params.get("tab") === "this-week" ? "this-week" : params.get("tab") === "calendar" ? "calendar" : "for-you";
    const year = Number(params.get("year"));
    const month = Number(params.get("month"));
    const result = await listEvents(context.viewer, {
      tab: tab as EventListTab,
      category: isEventCategory(params.get("category")) ? (params.get("category") as EventCategory) : null,
      cursor: params.get("cursor"),
      month: Number.isInteger(year) && Number.isInteger(month) && month >= 1 && month <= 12 ? { year, month } : null,
    });
    return noStore(result);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  const context = await socialApi(request, { mutation: true });
  if ("response" in context) return context.response;
  try {
    const body = await readJson(request);
    const audienceKind = AUDIENCE_KINDS.includes(body.audienceKind as EventAudienceKind)
      ? (body.audienceKind as EventAudienceKind)
      : null;
    if (!audienceKind) return noStore({ error: "Choose an audience." }, { status: 400 });
    if (!isEventCategory(body.category)) return noStore({ error: "Choose a category." }, { status: 400 });
    const categoryValue = body.category;
    const audiencePath = Array.isArray(body.audiencePath)
      ? body.audiencePath.filter((value): value is string => typeof value === "string")
      : [];
    const startsAt = typeof body.startsAt === "string" ? new Date(body.startsAt) : new Date(Number.NaN);
    const endsAt = typeof body.endsAt === "string" ? new Date(body.endsAt) : new Date(Number.NaN);
    const capacity =
      body.capacity === null || body.capacity === undefined || body.capacity === ""
        ? null
        : Number(body.capacity);
    return await withIdempotency(request, context.viewer.userId, async () => {
    const created = await createEvent(context.viewer, {
      title: typeof body.title === "string" ? body.title : "",
      description: typeof body.description === "string" ? body.description : "",
      category: categoryValue,
      audienceKind,
      audiencePath,
      startsAt,
      endsAt,
      venueName: typeof body.venueName === "string" ? body.venueName : "",
      placeId: typeof body.placeId === "string" ? body.placeId : null,
      venueNote: typeof body.venueNote === "string" ? body.venueNote : null,
      coverPublicId: typeof body.coverPublicId === "string" ? body.coverPublicId : null,
      capacity: capacity !== null && Number.isFinite(capacity) ? Math.trunc(capacity) : null,
      waitlistEnabled: body.waitlistEnabled === true,
      checkInEnabled: body.checkInEnabled !== false,
      allowOutsideSharing: body.allowOutsideSharing === true,
      communityId: typeof body.communityId === "string" ? body.communityId : null,
      officialAccountId: typeof body.officialAccountId === "string" ? body.officialAccountId : null,
    });
    return noStore(created, { status: 201 });
    });
  } catch (error) {
    return apiError(error);
  }
}
