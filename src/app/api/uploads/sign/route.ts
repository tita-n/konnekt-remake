import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { apiError, noStore, socialApi } from "@/lib/api/social";
import { cloudinarySignature } from "@/lib/media/post-media";
import { rateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

/**
 * Returns either a Cloudinary signature for a direct browser upload, or the
 * local-adapter mode used in development. The browser compresses first; this
 * endpoint is the server-side gate on how many uploads an account may start.
 */
export async function POST(request: NextRequest) {
  const context = await socialApi(request, { mutation: true });
  if ("response" in context) return context.response;
  try {
    const limit = await rateLimit("uploadSign", context.viewer.userId);
    if (!limit.success) return noStore({ error: "Too many uploads. Try again later." }, { status: 429 });
    const timestamp = Math.floor(Date.now() / 1000);
    const publicId = randomUUID();
    const folder = "konnekt/posts";
    const signature = cloudinarySignature({ folder, public_id: publicId, timestamp });
    if (!signature) {
      return noStore({ mode: "local", publicIdPrefix: "local:posts/", folder });
    }
    return noStore({
      mode: "cloudinary",
      cloudName: signature.cloudName,
      apiKey: signature.apiKey,
      signature: signature.signature,
      timestamp,
      folder,
      publicId,
    });
  } catch (error) {
    return apiError(error);
  }
}
