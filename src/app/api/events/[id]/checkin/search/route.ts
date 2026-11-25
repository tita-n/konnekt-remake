import type { NextRequest } from "next/server";
import { apiError, noStore, socialApi } from "@/lib/api/social";
import { searchCheckInCandidates } from "@/lib/services/events";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await socialApi(request);
  if ("response" in context) return context.response;
  try {
    const { id } = await params;
    const q = new URL(request.url).searchParams.get("q") ?? "";
    return noStore({ candidates: await searchCheckInCandidates(context.viewer, id, q) });
  } catch (error) {
    return apiError(error);
  }
}
