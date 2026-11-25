import type { NextRequest } from "next/server";
import { apiError, noStore, readJson, socialApi } from "@/lib/api/social";
import { isEventCategory } from "@/lib/domain/events";
import { cancelEvent, getEventDetail, updateEvent } from "@/lib/services/events";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await socialApi(request);
  if ("response" in context) return context.response;
  try {
    const { id } = await params;
    const detail = await getEventDetail(context.viewer, id);
    return noStore(detail);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await socialApi(request, { mutation: true });
  if ("response" in context) return context.response;
  try {
    const { id } = await params;
    const body = await readJson(request);
    const result = await updateEvent(context.viewer, id, {
      title: typeof body.title === "string" ? body.title : undefined,
      description: typeof body.description === "string" ? body.description : undefined,
      category: isEventCategory(body.category) ? body.category : undefined,
      startsAt: typeof body.startsAt === "string" ? new Date(body.startsAt) : undefined,
      endsAt: typeof body.endsAt === "string" ? new Date(body.endsAt) : undefined,
      venueName: typeof body.venueName === "string" ? body.venueName : undefined,
      placeId: body.placeId === null ? null : typeof body.placeId === "string" ? body.placeId : undefined,
      venueNote: body.venueNote === null ? null : typeof body.venueNote === "string" ? body.venueNote : undefined,
      coverPublicId: body.coverPublicId === null ? null : typeof body.coverPublicId === "string" ? body.coverPublicId : undefined,
      capacity:
        body.capacity === null ? null : body.capacity === undefined ? undefined : Number.isFinite(Number(body.capacity)) ? Math.trunc(Number(body.capacity)) : undefined,
      waitlistEnabled: typeof body.waitlistEnabled === "boolean" ? body.waitlistEnabled : undefined,
      checkInEnabled: typeof body.checkInEnabled === "boolean" ? body.checkInEnabled : undefined,
      allowOutsideSharing: typeof body.allowOutsideSharing === "boolean" ? body.allowOutsideSharing : undefined,
    });
    return noStore(result);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await socialApi(request, { mutation: true });
  if ("response" in context) return context.response;
  try {
    const { id } = await params;
    const body = await readJson(request);
    const result = await cancelEvent(context.viewer, id, typeof body.reason === "string" ? body.reason : "");
    return noStore(result);
  } catch (error) {
    return apiError(error);
  }
}
