import type { NextRequest } from "next/server";
import { toggleBlock, toggleMute } from "@/lib/services/moderation";
import { apiError, noStore, readJson, socialApi } from "@/lib/api/social";

export async function POST(request: NextRequest) {
  const context = await socialApi(request, { mutation: true });
  if ("response" in context) return context.response;
  try {
    const body = await readJson(request);
    if (typeof body.username !== "string" || (body.action !== "block" && body.action !== "mute")) {
      return noStore({ error: "Choose a student to block or mute." }, { status: 400 });
    }
    const result =
      body.action === "block"
        ? await toggleBlock(context.viewer, body.username)
        : await toggleMute(context.viewer, body.username);
    return noStore(result);
  } catch (error) {
    return apiError(error);
  }
}
