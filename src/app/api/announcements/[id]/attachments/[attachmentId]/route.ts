import type { NextRequest } from "next/server";
import { apiError, socialApi } from "@/lib/api/social";
import { getAnnouncementAttachment } from "@/lib/services/announcements";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> },
) {
  const context = await socialApi(request);
  if ("response" in context) return context.response;
  try {
    const { id, attachmentId } = await params;
    const file = await getAnnouncementAttachment(context.viewer, id, attachmentId);
    if (file.signedUrl) {
      return Response.redirect(file.signedUrl, 302);
    }
    if (!file.localBytes) return Response.json({ error: "That file isn't available." }, { status: 404 });
    const safeName = file.name.replace(/["\\\r\n]/g, "").slice(0, 120);
    return new Response(new Uint8Array(file.localBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeName}"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
