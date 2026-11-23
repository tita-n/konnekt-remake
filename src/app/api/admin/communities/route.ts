import type { NextRequest } from "next/server";
import { apiError, noStore, readJson, socialApi } from "@/lib/api/social";
import { COMMUNITY_CATEGORIES, type CommunityCategory } from "@/lib/domain/community";
import { createOfficialCommunity, listAdminCommunities } from "@/lib/services/communities";

function category(value: unknown): CommunityCategory {
  return typeof value === "string" && COMMUNITY_CATEGORIES.some((entry) => entry.value === value)
    ? (value as CommunityCategory)
    : "OTHER";
}

export async function GET(request: NextRequest) {
  const context = await socialApi(request);
  if ("response" in context) return context.response;
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    return noStore(
      await listAdminCommunities(context.viewer, {
        q: url.searchParams.get("q") ?? undefined,
        status:
          status === "ACTIVE" || status === "SUSPENDED" || status === "ARCHIVED" || status === "DELETED"
            ? status
            : undefined,
      }),
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  const context = await socialApi(request, { mutation: true });
  if ("response" in context) return context.response;
  try {
    const body = await readJson(request);
    const created = await createOfficialCommunity(context.viewer, {
      viewer: context.viewer,
      name: typeof body.name === "string" ? body.name : "",
      description: typeof body.description === "string" ? body.description : "",
      category: category(body.category),
      privacy:
        body.privacy === "REQUEST" || body.privacy === "INVITE_ONLY" || body.privacy === "PUBLIC"
          ? body.privacy
          : "PUBLIC",
      allowMemberUploads: body.allowMemberUploads === true,
      rules: [],
    });
    return noStore(created, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
