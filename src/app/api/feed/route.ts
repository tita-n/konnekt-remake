import type { NextRequest } from "next/server";
import { getFeed } from "@/lib/services/posts";
import { apiError, noStore, socialApi } from "@/lib/api/social";
import type { FeedFilter } from "@/lib/posts/types";

const FILTERS = new Set<FeedFilter>(["all", "level", "department", "college", "faculty", "public"]);

export async function GET(request: NextRequest) {
  const context = await socialApi(request);
  if ("response" in context) return context.response;
  try {
    const url = new URL(request.url);
    const rawFilter = url.searchParams.get("filter") ?? "all";
    const filter = (FILTERS.has(rawFilter as FeedFilter) ? rawFilter : "all") as FeedFilter;
    const page = await getFeed(context.viewer, filter, url.searchParams.get("cursor"));
    return noStore(page);
  } catch (error) {
    return apiError(error);
  }
}
