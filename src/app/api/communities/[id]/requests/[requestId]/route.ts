import type { NextRequest } from "next/server";
import { apiError, noStore, readJson, socialApi } from "@/lib/api/social";
import { decideJoinRequest } from "@/lib/services/communities";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; requestId: string }> },
) {
  const context = await socialApi(request, { mutation: true });
  if ("response" in context) return context.response;
  try {
    const { id, requestId } = await params;
    const body = await readJson(request);
    if (body.decision !== "APPROVE" && body.decision !== "DECLINE") {
      return noStore({ error: "Choose approve or decline." }, { status: 400 });
    }
    await decideJoinRequest(context.viewer, id, requestId, body.decision);
    return noStore({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
