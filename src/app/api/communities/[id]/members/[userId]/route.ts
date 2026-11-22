import type { NextRequest } from "next/server";
import { apiError, noStore, readJson, socialApi } from "@/lib/api/social";
import {
  banCommunityMember,
  muteCommunityMember,
  removeCommunityMember,
  unbanCommunityMember,
  unmuteCommunityMember,
  updateMemberRole,
} from "@/lib/services/communities";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  const context = await socialApi(request, { mutation: true });
  if ("response" in context) return context.response;
  try {
    const { id, userId } = await params;
    const body = await readJson(request);
    if (body.role === "MODERATOR" || body.role === "MEMBER") {
      await updateMemberRole(context.viewer, id, userId, body.role);
    } else if (body.action === "mute") {
      await muteCommunityMember(context.viewer, id, userId, Number(body.hours) || 24);
    } else if (body.action === "unmute") {
      await unmuteCommunityMember(context.viewer, id, userId);
    } else if (body.action === "ban") {
      await banCommunityMember(context.viewer, id, userId, typeof body.reason === "string" ? body.reason : "");
    } else if (body.action === "unban") {
      await unbanCommunityMember(context.viewer, id, userId);
    } else {
      return noStore({ error: "Choose a member action." }, { status: 400 });
    }
    return noStore({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  const context = await socialApi(request, { mutation: true });
  if ("response" in context) return context.response;
  try {
    const { id, userId } = await params;
    await removeCommunityMember(context.viewer, id, userId);
    return noStore({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
