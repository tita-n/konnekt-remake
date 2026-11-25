import type { NextRequest } from "next/server";
import { apiError, noStore, socialApi } from "@/lib/api/social";
import { searchEventStaffCandidates } from "@/lib/services/events";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await socialApi(request);
  if ("response" in context) return context.response;
  try {
    const { id } = await params;
    return noStore({ candidates: await searchEventStaffCandidates(context.viewer, id, new URL(request.url).searchParams.get("q") ?? "") });
  } catch (error) {
    return apiError(error);
  }
}
