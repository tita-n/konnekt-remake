import type { NextRequest } from "next/server";
import { repostPost, undoRepost } from "@/lib/services/posts";
import { apiError, noStore, readJson, socialApi } from "@/lib/api/social";
import { withIdempotency } from "@/lib/api/idempotency";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await socialApi(request, { mutation: true });
  if ("response" in context) return context.response;
  try {
    const { id } = await params;
    const body = await readJson(request);
    const quote = typeof body.body === "string" ? body.body : "";
    return await withIdempotency(request, context.viewer.userId, async () => {
      const result = await repostPost(context.viewer, id, quote);
      return noStore(result, { status: 201 });
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await socialApi(request, { mutation: true });
  if ("response" in context) return context.response;
  try {
    const { id } = await params;
    return noStore(await undoRepost(context.viewer, id));
  } catch (error) {
    return apiError(error);
  }
}
