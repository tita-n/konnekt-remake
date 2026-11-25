import type { NextRequest } from "next/server";
import { apiError, noStore, readJson, socialApi } from "@/lib/api/social";
import { removeEvent, restoreEvent } from "@/lib/services/events";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await socialApi(request, { mutation: true });
  if ("response" in context) return context.response;
  try {
    const { id } = await params;
    const body = await readJson(request);
    if (body.action === "remove") return noStore(await removeEvent(context.viewer, id));
    if (body.action === "restore") return noStore(await restoreEvent(context.viewer, id));
    return noStore({ error: "Choose remove or restore." }, { status: 400 });
  } catch (error) {
    return apiError(error);
  }
}
