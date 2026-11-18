import type { NextRequest } from "next/server";
import { acceptAnswer } from "@/lib/services/posts";
import { apiError, noStore, readJson, socialApi } from "@/lib/api/social";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await socialApi(request, { mutation: true });
  if ("response" in context) return context.response;
  try {
    const { id } = await params;
    const body = await readJson(request);
    if (typeof body.commentId !== "string") return noStore({ error: "Choose an answer to accept." }, { status: 400 });
    await acceptAnswer(context.viewer, id, body.commentId);
    return noStore({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
