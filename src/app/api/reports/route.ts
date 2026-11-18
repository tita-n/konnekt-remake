import type { NextRequest } from "next/server";
import { REPORT_REASONS, reportContent } from "@/lib/services/moderation";
import { apiError, noStore, readJson, socialApi } from "@/lib/api/social";
import type { ReportReason } from "@prisma/client";

export async function POST(request: NextRequest) {
  const context = await socialApi(request, { mutation: true });
  if ("response" in context) return context.response;
  try {
    const body = await readJson(request);
    if (body.targetType !== "POST" && body.targetType !== "COMMENT") {
      return noStore({ error: "Choose what to report." }, { status: 400 });
    }
    if (typeof body.targetId !== "string" || typeof body.reason !== "string" || !REPORT_REASONS.includes(body.reason as ReportReason)) {
      return noStore({ error: "Choose a reason for the report." }, { status: 400 });
    }
    const result = await reportContent(context.viewer, {
      targetType: body.targetType,
      targetId: body.targetId,
      reason: body.reason as ReportReason,
      details: typeof body.details === "string" ? body.details : undefined,
    });
    return noStore(result, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
