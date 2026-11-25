import type { NextRequest } from "next/server";
import { apiError, noStore, readJson, socialApi } from "@/lib/api/social";
import { checkInAttendee } from "@/lib/services/events";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await socialApi(request, { mutation: true });
  if ("response" in context) return context.response;
  try {
    const { id } = await params;
    const body = await readJson(request);
    if (body.method !== "QR" && body.method !== "MANUAL") {
      return noStore({ error: "Choose a scan method." }, { status: 400 });
    }
    if (typeof body.clientScanId !== "string") {
      return noStore({ error: "Missing scan id." }, { status: 400 });
    }
    const result = await checkInAttendee(context.viewer, id, {
      method: body.method,
      clientScanId: body.clientScanId,
      code: typeof body.code === "string" ? body.code : null,
      userId: typeof body.userId === "string" ? body.userId : null,
      deviceLabel: typeof body.deviceLabel === "string" ? body.deviceLabel : null,
    });
    return noStore(result);
  } catch (error) {
    return apiError(error);
  }
}
