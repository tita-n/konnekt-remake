import type { NextRequest } from "next/server";
import { apiError, noStore, readJson, socialApi } from "@/lib/api/social";
import { setShowEventAttendance } from "@/lib/services/events";

export async function POST(request: NextRequest) {
  const context = await socialApi(request, { mutation: true });
  if ("response" in context) return context.response;
  try {
    const body = await readJson(request);
    return noStore(await setShowEventAttendance(context.viewer, body.show === true));
  } catch (error) {
    return apiError(error);
  }
}
