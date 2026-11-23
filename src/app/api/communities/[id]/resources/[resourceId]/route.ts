import { NextResponse, type NextRequest } from "next/server";
import { apiError, noStore, socialApi } from "@/lib/api/social";
import { getResourceDownload, removeCommunityResource } from "@/lib/services/communities";
import { readLocalResource, resourceExtensionFromKey, signedResourceUrl } from "@/lib/media/resource-store";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; resourceId: string }> },
) {
  const context = await socialApi(request);
  if ("response" in context) return context.response;
  try {
    const { id, resourceId } = await params;
    const resource = await getResourceDownload(context.viewer, id, resourceId);
    if (resource.kind === "LINK") {
      return NextResponse.redirect(resource.url, {
        headers: { "Cache-Control": "private, no-store, max-age=0" },
      });
    }
    const extension = resourceExtensionFromKey(resource.fileKey);
    const local = await readLocalResource(resource.fileKey);
    if (local) {
      const safe = resource.title.replace(/[^a-z0-9._ -]/gi, "_").slice(0, 100) || "resource";
      return new NextResponse(new Uint8Array(local), {
        headers: {
          "Content-Type": resource.mimeType,
          "Content-Disposition": `attachment; filename="${safe}.${extension}"`,
          "Cache-Control": "private, no-store, max-age=0",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    const signed = signedResourceUrl(resource.fileKey, extension, 120);
    if (!signed) return NextResponse.json({ error: "That file isn't available." }, { status: 404 });
    return NextResponse.redirect(signed, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; resourceId: string }> },
) {
  const context = await socialApi(request, { mutation: true });
  if ("response" in context) return context.response;
  try {
    const { id, resourceId } = await params;
    await removeCommunityResource(context.viewer, id, resourceId);
    return noStore({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
