import type { NextRequest } from "next/server";
import { apiError, noStore, socialApi } from "@/lib/api/social";
import { listCommunityMembers } from "@/lib/services/communities";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await socialApi(request);
  if ("response" in context) return context.response;
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const status = url.searchParams.get("status") === "BANNED" ? "BANNED" : "ACTIVE";
    return noStore({
      members: await listCommunityMembers(context.viewer, id, {
        q: url.searchParams.get("q") ?? undefined,
        status,
      }),
    });
  } catch (error) {
    return apiError(error);
  }
}
