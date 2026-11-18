import type { NextRequest } from "next/server";
import { searchHashtags } from "@/lib/services/posts";
import { apiError, noStore, socialApi } from "@/lib/api/social";

export async function GET(request: NextRequest) {
  const context = await socialApi(request);
  if ("response" in context) return context.response;
  try {
    const query = new URL(request.url).searchParams.get("q") ?? "";
    return noStore({ tags: await searchHashtags(context.viewer, query) });
  } catch (error) {
    return apiError(error);
  }
}
