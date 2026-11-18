import type { NextRequest } from "next/server";
import { getTrendingTags } from "@/lib/services/posts";
import { apiError, noStore, socialApi } from "@/lib/api/social";
import type { FeedFilter } from "@/lib/posts/types";

export async function GET(request: NextRequest) {
  const context = await socialApi(request);
  if ("response" in context) return context.response;
  try {
    const filter = (new URL(request.url).searchParams.get("filter") ?? "all") as FeedFilter;
    const tags = await getTrendingTags(context.viewer, filter);
    return noStore({ tags });
  } catch (error) {
    return apiError(error);
  }
}
