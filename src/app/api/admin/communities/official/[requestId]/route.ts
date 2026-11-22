import type { NextRequest } from "next/server";
import { apiError, noStore, readJson, socialApi } from "@/lib/api/social";
import { decideOfficialCommunity } from "@/lib/services/communities";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const context = await socialApi(request, { mutation: true });
  if ("response" in context) return context.response;
  try {
    const { requestId } = await params;
    const body = await readJson(request);
    if (body.decision !== "APPROVE" && body.decision !== "REJECT") {
      return noStore({ error: "Choose approve or reject." }, { status: 400 });
    }
    await decideOfficialCommunity(context.viewer, requestId, body.decision);
    return noStore({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
