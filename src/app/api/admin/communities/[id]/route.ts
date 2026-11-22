import type { NextRequest } from "next/server";
import { apiError, noStore, readJson, socialApi } from "@/lib/api/social";
import { adminModerateCommunity } from "@/lib/services/communities";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await socialApi(request, { mutation: true });
  if ("response" in context) return context.response;
  try {
    const { id } = await params;
    const body = await readJson(request);
    if (body.action !== "SUSPEND" && body.action !== "REINSTATE" && body.action !== "ARCHIVE") {
      return noStore({ error: "Choose a moderation action." }, { status: 400 });
    }
    await adminModerateCommunity(
      context.viewer,
      id,
      body.action,
      typeof body.reason === "string" ? body.reason : "",
    );
    return noStore({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
