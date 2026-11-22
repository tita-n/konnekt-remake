import type { NextRequest } from "next/server";
import { apiError, noStore, socialApi } from "@/lib/api/social";
import { revokeCommunityInvite } from "@/lib/services/communities";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; inviteId: string }> },
) {
  const context = await socialApi(request, { mutation: true });
  if ("response" in context) return context.response;
  try {
    const { id, inviteId } = await params;
    await revokeCommunityInvite(context.viewer, id, inviteId);
    return noStore({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
