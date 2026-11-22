import type { NextRequest } from "next/server";
import { apiError, noStore, socialApi } from "@/lib/api/social";
import { checkCommunityName } from "@/lib/services/communities";

export async function GET(request: NextRequest) {
  const context = await socialApi(request);
  if ("response" in context) return context.response;
  try {
    const name = new URL(request.url).searchParams.get("name") ?? "";
    return noStore(await checkCommunityName(context.viewer, name));
  } catch (error) {
    return apiError(error);
  }
}
