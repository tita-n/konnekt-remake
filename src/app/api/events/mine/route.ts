import type { NextRequest } from "next/server";
import { apiError, noStore, socialApi } from "@/lib/api/social";
import { getMyEvents } from "@/lib/services/events";

export async function GET(request: NextRequest) {
  const context = await socialApi(request);
  if ("response" in context) return context.response;
  try {
    const tab = new URL(request.url).searchParams.get("tab");
    const selected = tab === "interested" || tab === "waitlisted" || tab === "past" ? tab : "going";
    return noStore(await getMyEvents(context.viewer, selected));
  } catch (error) {
    return apiError(error);
  }
}
