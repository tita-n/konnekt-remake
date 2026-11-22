import type { NextRequest } from "next/server";
import { apiError, noStore, readJson, socialApi } from "@/lib/api/social";
import { transferCommunityOwnership } from "@/lib/services/communities";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await socialApi(request, { mutation: true });
  if ("response" in context) return context.response;
  try {
    const { id } = await params;
    const body = await readJson(request);
    if (typeof body.targetUserId !== "string") {
      return noStore({ error: "Choose a member." }, { status: 400 });
    }
    await transferCommunityOwnership(context.viewer, id, body.targetUserId);
    return noStore({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
