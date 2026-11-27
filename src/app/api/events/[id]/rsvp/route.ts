import type { NextRequest } from "next/server";
import { apiError, noStore, readJson, socialApi } from "@/lib/api/social";
import { withIdempotency } from "@/lib/api/idempotency";
import { cancelRsvp, rsvpEvent } from "@/lib/services/events";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await socialApi(request, { mutation: true });
  if ("response" in context) return context.response;
  try {
    const { id } = await params;
    const body = await readJson(request);
    if (body.status !== "GOING" && body.status !== "INTERESTED") {
      return noStore({ error: "Choose Going or Interested." }, { status: 400 });
    }
    const status = body.status;
    return await withIdempotency(request, context.viewer.userId, async () => {
      const result = await rsvpEvent(context.viewer, id, status);
      return noStore(result);
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await socialApi(request, { mutation: true });
  if ("response" in context) return context.response;
  try {
    const { id } = await params;
    return noStore(await cancelRsvp(context.viewer, id));
  } catch (error) {
    return apiError(error);
  }
}
