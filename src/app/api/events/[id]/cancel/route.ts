import type { NextRequest } from "next/server";
import { apiError, noStore, readJson, socialApi } from "@/lib/api/social";
import { cancelEvent } from "@/lib/services/events";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await socialApi(request, { mutation: true });
  if ("response" in context) return context.response;
  try {
    const { id } = await params;
    const body = await readJson(request);
    return noStore(await cancelEvent(context.viewer, id, typeof body.reason === "string" ? body.reason : ""));
  } catch (error) {
    return apiError(error);
  }
}
