import type { NextRequest } from "next/server";
import { getReactionList } from "@/lib/services/posts";
import { apiError, noStore, socialApi } from "@/lib/api/social";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await socialApi(request);
  if ("response" in context) return context.response;
  try {
    const { id } = await params;
    const people = await getReactionList(context.viewer, id);
    if (!people) return noStore({ error: "This post isn't available." }, { status: 404 });
    return noStore({ people });
  } catch (error) {
    return apiError(error);
  }
}
