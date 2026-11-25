import type { NextRequest } from "next/server";
import { apiError, noStore, readJson, socialApi } from "@/lib/api/social";
import { postEventUpdate } from "@/lib/services/events";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await socialApi(request, { mutation: true });
  if ("response" in context) return context.response;
  try {
    const { id } = await params;
    const body = await readJson(request);
    return noStore(await postEventUpdate(context.viewer, id, typeof body.body === "string" ? body.body : ""), { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
