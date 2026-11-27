import type { NextRequest } from "next/server";
import { createComment, getPostDetail } from "@/lib/services/posts";
import { apiError, noStore, readJson, socialApi } from "@/lib/api/social";
import { withIdempotency } from "@/lib/api/idempotency";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await socialApi(request);
  if ("response" in context) return context.response;
  try {
    const { id } = await params;
    const sort = new URL(request.url).searchParams.get("sort") === "newest" ? "newest" : "top";
    const detail = await getPostDetail(context.viewer, id, sort);
    if (!detail) return noStore({ error: "This post isn't available." }, { status: 404 });
    return noStore({ comments: detail.comments, sort });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await socialApi(request, { mutation: true });
  if ("response" in context) return context.response;
  try {
    const { id } = await params;
    const body = await readJson(request);
    return await withIdempotency(request, context.viewer.userId, async () => {
      const result = await createComment({
        viewer: context.viewer,
        postId: id,
        body: typeof body.body === "string" ? body.body : "",
        parentId: typeof body.parentId === "string" ? body.parentId : null,
      });
      return noStore(result, { status: 201 });
    });
  } catch (error) {
    return apiError(error);
  }
}
