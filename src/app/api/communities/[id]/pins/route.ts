import type { NextRequest } from "next/server";
import { apiError, noStore, readJson, socialApi } from "@/lib/api/social";
import { pinCommunityPost, unpinCommunityPost } from "@/lib/services/communities";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await socialApi(request, { mutation: true });
  if ("response" in context) return context.response;
  try {
    const { id } = await params;
    const body = await readJson(request);
    if (typeof body.postId !== "string") return noStore({ error: "Choose a post." }, { status: 400 });
    await pinCommunityPost(context.viewer, id, body.postId);
    return noStore({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await socialApi(request, { mutation: true });
  if ("response" in context) return context.response;
  try {
    const { id } = await params;
    const body = await readJson(request);
    if (typeof body.postId !== "string") return noStore({ error: "Choose a post." }, { status: 400 });
    await unpinCommunityPost(context.viewer, id, body.postId);
    return noStore({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
