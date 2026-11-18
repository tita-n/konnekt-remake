import type { NextRequest } from "next/server";
import { votePoll } from "@/lib/services/posts";
import { apiError, noStore, readJson, socialApi } from "@/lib/api/social";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await socialApi(request, { mutation: true });
  if ("response" in context) return context.response;
  try {
    const { id } = await params;
    const body = await readJson(request);
    if (typeof body.optionId !== "string") return noStore({ error: "Pick an option first." }, { status: 400 });
    await votePoll(context.viewer, id, body.optionId);
    return noStore({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
