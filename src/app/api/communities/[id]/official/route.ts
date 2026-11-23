import type { NextRequest } from "next/server";
import { apiError, noStore, readJson, socialApi } from "@/lib/api/social";
import { requestOfficialCommunity } from "@/lib/services/communities";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await socialApi(request, { mutation: true });
  if ("response" in context) return context.response;
  try {
    const { id } = await params;
    const body = await readJson(request);
    await requestOfficialCommunity(context.viewer, id, typeof body.note === "string" ? body.note : "");
    return noStore({ ok: true }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
