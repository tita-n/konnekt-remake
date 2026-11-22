import type { NextRequest } from "next/server";
import { apiError, noStore, socialApi } from "@/lib/api/social";
import { listCommunityOptions } from "@/lib/services/communities";

export async function GET(request: NextRequest) {
  const context = await socialApi(request);
  if ("response" in context) return context.response;
  try {
    return noStore({ communities: await listCommunityOptions(context.viewer) });
  } catch (error) {
    return apiError(error);
  }
}
