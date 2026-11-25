import type { NextRequest } from "next/server";
import { apiError, noStore, readJson, socialApi } from "@/lib/api/social";
import { addEventComment } from "@/lib/services/events";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await socialApi(request, { mutation: true });
  if ("response" in context) return context.response;
  try {
    const { id } = await params;
    const body = await readJson(request);
    const result = await addEventComment(context.viewer, id, {
      body: typeof body.body === "string" ? body.body : "",
      parentId: typeof body.parentId === "string" ? body.parentId : null,
    });
    return noStore(result, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
