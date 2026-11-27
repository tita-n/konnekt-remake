import type { NextRequest } from "next/server";
import { apiError, noStore, readJson, socialApi } from "@/lib/api/social";
import { withIdempotency } from "@/lib/api/idempotency";
import { cancelJoinRequest, joinCommunity, leaveCommunity } from "@/lib/services/communities";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await socialApi(request, { mutation: true });
  if ("response" in context) return context.response;
  try {
    const { id } = await params;
    const body = await readJson(request);
    return await withIdempotency(request, context.viewer.userId, async () => {
      const result = await joinCommunity(context.viewer, id, typeof body.message === "string" ? body.message : undefined);
      return noStore(result, { status: 201 });
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
    await leaveCommunity(context.viewer, id);
    return noStore({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await socialApi(request, { mutation: true });
  if ("response" in context) return context.response;
  try {
    const { id } = await params;
    await cancelJoinRequest(context.viewer, id);
    return noStore({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
