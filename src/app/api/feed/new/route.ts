import type { NextRequest } from "next/server";
import { countNewPosts } from "@/lib/services/posts";
import { apiError, noStore, socialApi } from "@/lib/api/social";
import type { FeedFilter } from "@/lib/posts/types";

const FILTERS = new Set<FeedFilter>(["all", "level", "department", "college", "faculty", "public"]);

/**
 * Cheap conditional check behind the "new posts" pill. The client polls only
 * while the feed is visible and focused, every 45 seconds, and sends
 * If-None-Match so an unchanged count costs a 304 with no body.
 */
export async function GET(request: NextRequest) {
  const context = await socialApi(request);
  if ("response" in context) return context.response;
  try {
    const url = new URL(request.url);
    const rawFilter = url.searchParams.get("filter") ?? "all";
    const filter = (FILTERS.has(rawFilter as FeedFilter) ? rawFilter : "all") as FeedFilter;
    const sinceParam = url.searchParams.get("since");
    const since = sinceParam && !Number.isNaN(new Date(sinceParam).getTime())
      ? new Date(sinceParam)
      : new Date(Date.now() - 60 * 60 * 1000);
    const count = await countNewPosts(context.viewer, filter, since);
    const etag = `"np-${filter}-${count}"`;
    if (request.headers.get("if-none-match") === etag) {
      return new Response(null, { status: 304, headers: { ETag: etag, "Cache-Control": "private, no-store" } });
    }
    const response = noStore({ count, checkedAt: new Date().toISOString() });
    response.headers.set("ETag", etag);
    return response;
  } catch (error) {
    return apiError(error);
  }
}
