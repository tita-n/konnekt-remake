import type { NextRequest } from "next/server";
import { toggleReaction } from "@/lib/services/posts";
import { apiError, noStore, socialApi } from "@/lib/api/social";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await socialApi(request, { mutation: true });
  if ("response" in context) return context.response;
  try {
    const { id } = await params;
    return noStore(await toggleReaction(context.viewer, "COMMENT", id));
  } catch (error) {
    return apiError(error);
  }
}
