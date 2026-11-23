import type { NextRequest } from "next/server";
import { apiError, noStore, readJson, socialApi } from "@/lib/api/social";
import { listCommunityReports, resolveCommunityReport } from "@/lib/services/communities";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await socialApi(request);
  if ("response" in context) return context.response;
  try {
    const { id } = await params;
    return noStore({ reports: await listCommunityReports(context.viewer, id) });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await socialApi(request, { mutation: true });
  if ("response" in context) return context.response;
  try {
    const { id } = await params;
    const body = await readJson(request);
    if (body.action !== "DISMISS" && body.action !== "REMOVE_CONTENT") {
      return noStore({ error: "Choose a report action." }, { status: 400 });
    }
    if (typeof body.reportId !== "string") return noStore({ error: "Choose a report." }, { status: 400 });
    await resolveCommunityReport(context.viewer, id, body.reportId, body.action);
    return noStore({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
