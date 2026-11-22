import type { NextRequest } from "next/server";
import { apiError, noStore, socialApi } from "@/lib/api/social";
import { listJoinRequests } from "@/lib/services/communities";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await socialApi(request);
  if ("response" in context) return context.response;
  try {
    const { id } = await params;
    return noStore({ requests: await listJoinRequests(context.viewer, id) });
  } catch (error) {
    return apiError(error);
  }
}
