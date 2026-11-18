import type { NextRequest } from "next/server";
import { deleteComment, updateComment } from "@/lib/services/posts";
import { apiError, noStore, readJson, socialApi } from "@/lib/api/social";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await socialApi(request, { mutation: true });
  if ("response" in context) return context.response;
  try {
    const { id } = await params;
    const body = await readJson(request);
    await updateComment(context.viewer, id, typeof body.body === "string" ? body.body : "");
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
    await deleteComment(context.viewer, id);
    return noStore({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
