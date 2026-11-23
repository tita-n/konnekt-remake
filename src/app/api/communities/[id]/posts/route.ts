import type { NextRequest } from "next/server";
import { apiError, noStore, socialApi } from "@/lib/api/social";
import { getCommunityFeed } from "@/lib/services/posts";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await socialApi(request);
  if ("response" in context) return context.response;
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const sort = url.searchParams.get("sort") === "top" ? "top" : "latest";
    const result = await getCommunityFeed(context.viewer, id, sort, url.searchParams.get("cursor"));
    if (!result) return noStore({ error: "This community isn't available." }, { status: 404 });
    return noStore(result);
  } catch (error) {
    return apiError(error);
  }
}
