import type { NextRequest } from "next/server";
import { apiError, noStore, readJson, socialApi } from "@/lib/api/social";
import { COMMUNITY_CATEGORIES, type CommunityCategory } from "@/lib/domain/community";
import { archiveCommunity, deleteCommunity, updateCommunity } from "@/lib/services/communities";

function category(value: unknown): CommunityCategory | undefined {
  return typeof value === "string" && COMMUNITY_CATEGORIES.some((entry) => entry.value === value)
    ? (value as CommunityCategory)
    : undefined;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await socialApi(request, { mutation: true });
  if ("response" in context) return context.response;
  try {
    const { id } = await params;
    const body = await readJson(request);
    const rules = Array.isArray(body.rules)
      ? body.rules.flatMap((rule) => {
          if (!rule || typeof rule !== "object") return [];
          const row = rule as Record<string, unknown>;
          return typeof row.title === "string" && typeof row.body === "string"
            ? [{ title: row.title, body: row.body }]
            : [];
        })
      : undefined;
    if (body.action === "archive") {
      await archiveCommunity(context.viewer, id);
      return noStore({ ok: true });
    }
    await updateCommunity(context.viewer, id, {
      ...(typeof body.name === "string" ? { name: body.name } : {}),
      ...(typeof body.description === "string" ? { description: body.description } : {}),
      ...(category(body.category) ? { category: category(body.category) } : {}),
      ...(body.privacy === "PUBLIC" || body.privacy === "REQUEST" || body.privacy === "INVITE_ONLY"
        ? { privacy: body.privacy }
        : {}),
      ...(typeof body.allowMemberUploads === "boolean" ? { allowMemberUploads: body.allowMemberUploads } : {}),
      ...(body.iconPublicId === null || typeof body.iconPublicId === "string" ? { iconPublicId: body.iconPublicId } : {}),
      ...(body.bannerPublicId === null || typeof body.bannerPublicId === "string" ? { bannerPublicId: body.bannerPublicId } : {}),
      ...(rules ? { rules } : {}),
    });
    return noStore({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await socialApi(request, { mutation: true });
  if ("response" in context) return context.response;
  try {
    const { id } = await params;
    await deleteCommunity(context.viewer, id);
    return noStore({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
