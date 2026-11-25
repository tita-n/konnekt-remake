import type { NextRequest } from "next/server";
import { apiError, noStore, socialApi } from "@/lib/api/social";
import { MAX_ANNOUNCEMENT_ATTACHMENT_BYTES } from "@/lib/domain/announcements";
import { storeResourceFile } from "@/lib/media/resource-store";
import { getOfficialPostingContext } from "@/lib/services/official";

export const runtime = "nodejs";

/** Official staff only: store a PDF privately and return its opaque file key. */
export async function POST(request: NextRequest) {
  const context = await socialApi(request, { mutation: true });
  if ("response" in context) return context.response;
  try {
    const posting = await getOfficialPostingContext(context.viewer);
    if (posting.accounts.length === 0) {
      return noStore({ error: "You don't have posting rights for an official account." }, { status: 403 });
    }
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return noStore({ error: "Choose a PDF first." }, { status: 400 });
    if (file.type !== "application/pdf") return noStore({ error: "Attachments must be PDF files." }, { status: 400 });
    if (file.size > MAX_ANNOUNCEMENT_ATTACHMENT_BYTES) {
      return noStore({ error: "Each attachment can be at most 10 MB." }, { status: 400 });
    }
    const stored = await storeResourceFile({
      bytes: Buffer.from(await file.arrayBuffer()),
      filename: file.name || "attachment.pdf",
      contentType: file.type,
    });
    if (stored.mimeType !== "application/pdf") {
      return noStore({ error: "Attachments must be PDF files." }, { status: 400 });
    }
    return noStore(
      {
        fileKey: stored.fileKey,
        name: file.name || "attachment.pdf",
        mimeType: stored.mimeType,
        sizeBytes: stored.sizeBytes,
      },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
