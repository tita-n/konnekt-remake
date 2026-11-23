import type { NextRequest } from "next/server";
import { apiError, noStore, readJson, socialApi } from "@/lib/api/social";
import { acceptInvitation, acceptInviteToken } from "@/lib/services/communities";

export async function POST(request: NextRequest) {
  const context = await socialApi(request, { mutation: true });
  if ("response" in context) return context.response;
  try {
    const body = await readJson(request);
    if (typeof body.token === "string" && body.token) {
      return noStore(await acceptInviteToken(context.viewer, body.token));
    }
    if (typeof body.inviteId === "string" && body.inviteId) {
      return noStore(await acceptInvitation(context.viewer, body.inviteId));
    }
    return noStore({ error: "This invite isn't available." }, { status: 404 });
  } catch (error) {
    return apiError(error);
  }
}
