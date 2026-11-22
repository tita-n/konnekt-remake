import type { NextRequest } from "next/server";
import { apiError, noStore, readJson, socialApi } from "@/lib/api/social";
import { COMMUNITY_CATEGORIES, type CommunityCategory } from "@/lib/domain/community";
import { createCommunity, listDiscoverCommunities } from "@/lib/services/communities";

function category(value: unknown): CommunityCategory | null {
  return typeof value === "string" && COMMUNITY_CATEGORIES.some((entry) => entry.value === value)
    ? (value as CommunityCategory)
    : null;
}

export async function GET(request: NextRequest) {
  const context = await socialApi(request);
  if ("response" in context) return context.response;
  try {
    const params = new URL(request.url).searchParams;
    const result = await listDiscoverCommunities(context.viewer, {
      q: params.get("q") ?? undefined,
      category: category(params.get("category")),
      cursor: params.get("cursor"),
    });
    return noStore(result);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  const context = await socialApi(request, { mutation: true });
  if ("response" in context) return context.response;
  try {
    const body = await readJson(request);
    const rules = Array.isArray(body.rules)
      ? body.rules.flatMap((rule) => {
          if (!rule || typeof rule !== "object") return [];
          const row = rule as Record<string, unknown>;
          return typeof row.title === "string" && typeof row.body === "string"
            ? [{ title: row.title, body: row.body }]
            : [];
        })
      : [];
    const created = await createCommunity({
      viewer: context.viewer,
      name: typeof body.name === "string" ? body.name : "",
      description: typeof body.description === "string" ? body.description : "",
      category: category(body.category) ?? "OTHER",
      privacy:
        body.privacy === "REQUEST" || body.privacy === "INVITE_ONLY" || body.privacy === "PUBLIC"
          ? body.privacy
          : "PUBLIC",
      iconPublicId: typeof body.iconPublicId === "string" ? body.iconPublicId : null,
      bannerPublicId: typeof body.bannerPublicId === "string" ? body.bannerPublicId : null,
      allowMemberUploads: body.allowMemberUploads === true,
      rules,
    });
    return noStore(created, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
