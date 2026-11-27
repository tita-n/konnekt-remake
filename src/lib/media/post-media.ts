import "server-only";
import { createHash } from "node:crypto";
import { env } from "@/lib/env";
import { cloudinaryImageUrl } from "./image-url";

/**
 * Post images are public-delivery Cloudinary assets with unguessable ids. The
 * app still enforces the audience before it ever puts a URL in a response, and
 * the URL itself contains no author, post or campus information.
 */
export function postMediaUrl(publicId: string, storedUrl?: string | null): string | null {
  if (storedUrl) return storedUrl;
  if (publicId.startsWith("local:")) return null;
  if (!env.CLOUDINARY_CLOUD_NAME) return null;
  return cloudinaryImageUrl(publicId, "card", env.CLOUDINARY_CLOUD_NAME);
}

export function isAllowedPostPublicId(publicId: string): boolean {
  return publicId.startsWith("konnekt/posts/") || publicId.startsWith("local:posts/");
}

/** Cloudinary signing payload for a direct browser upload. */
export function cloudinarySignature(params: Record<string, string | number>): { signature: string; apiKey: string; cloudName: string } | null {
  if (!env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET || !env.CLOUDINARY_CLOUD_NAME) return null;
  const entries = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .sort(([a], [b]) => a.localeCompare(b));
  const toSign = entries.map(([key, value]) => `${key}=${value}`).join("&");
  // Cloudinary's documented SHA-1 signature of `params + api_secret`.
  const signature = createHash("sha1").update(`${toSign}${env.CLOUDINARY_API_SECRET}`).digest("hex");
  return { signature, apiKey: env.CLOUDINARY_API_KEY, cloudName: env.CLOUDINARY_CLOUD_NAME };
}
