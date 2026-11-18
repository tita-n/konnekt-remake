import type { NextRequest } from "next/server";
import { saveDraft } from "@/lib/services/posts";
import { apiError, noStore, readJson, socialApi } from "@/lib/api/social";
import type { DraftView } from "@/lib/posts/types";

export async function POST(request: NextRequest) {
  const context = await socialApi(request, { mutation: true });
  if ("response" in context) return context.response;
  try {
    const body = await readJson(request);
    if (body.type !== "POST" && body.type !== "QUESTION" && body.type !== "POLL") {
      return noStore({ error: "Choose a draft type." }, { status: 400 });
    }
    const payload = body.payload && typeof body.payload === "object" ? (body.payload as DraftView["payload"]) : {};
    const audience = body.audience && typeof body.audience === "object" ? (body.audience as DraftView["audience"]) : {};
    const id = await saveDraft(context.viewer, {
      id: typeof body.id === "string" ? body.id : undefined,
      type: body.type,
      payload,
      audience,
    });
    return noStore({ id }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
