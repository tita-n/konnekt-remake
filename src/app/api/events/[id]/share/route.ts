import type { NextRequest } from "next/server";
import { apiError, noStore, readJson, socialApi } from "@/lib/api/social";
import { rateLimit } from "@/lib/security/rate-limit";
import { eventAllowsOutsideSharing } from "@/lib/domain/events";
import { getEventDetail, updateEvent } from "@/lib/services/events";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await socialApi(request);
  if ("response" in context) return context.response;
  try {
    const { id } = await params;
    const limit = await rateLimit("eventShareCard", context.viewer.userId);
    if (!limit.success) return noStore({ error: "You've generated a lot of share cards. Try again later." }, { status: 429 });
    const detail = await getEventDetail(context.viewer, id, { recordView: false });
    return noStore({
      shareable: eventAllowsOutsideSharing(detail.event),
      link: `/e/${id}`,
      event: detail.event,
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await socialApi(request, { mutation: true });
  if ("response" in context) return context.response;
  try {
    const { id } = await params;
    const body = await readJson(request);
    return noStore(await updateEvent(context.viewer, id, { allowOutsideSharing: body.allowOutsideSharing === true }));
  } catch (error) {
    return apiError(error);
  }
}
