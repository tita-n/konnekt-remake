import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { v2 as cloudinary } from "cloudinary";
import { env, hasCloudinary, isProduction } from "@/lib/env";

/**
 * Private image storage for ID cards.
 *
 * Production uses Cloudinary with the `authenticated` delivery type: assets are
 * not publicly addressable and are only readable through short-lived signed
 * URLs generated for an authorised reviewer. Local development and tests use a
 * gitignored directory served through the same authorised route, so the access
 * control being exercised is identical.
 */
const LOCAL_DIR = path.join(process.cwd(), ".private-media");

function configureCloudinary() {
  if (!hasCloudinary) return false;
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  return true;
}

export async function putPrivateImage(buffer: Buffer, folder: string): Promise<string> {
  if (!configureCloudinary()) {
    if (isProduction) throw new Error("Private image storage is not configured");
    await mkdir(LOCAL_DIR, { recursive: true });
    const id = `local:${randomUUID()}`;
    await writeFile(path.join(LOCAL_DIR, `${id.slice(6)}.jpg`), buffer, { mode: 0o600 });
    return id;
  }

  return new Promise((resolve, reject) => {
    const upload = cloudinary.uploader.upload_stream(
      {
        folder: `konnekt/${folder}`,
        type: "authenticated",
        resource_type: "image",
        overwrite: false,
        invalidate: true,
        unique_filename: true,
        use_filename: false,
      },
      (error, result) => {
        if (error || !result) {
          reject(new Error("Image upload failed"));
          return;
        }
        resolve(result.public_id);
      },
    );
    upload.end(buffer);
  });
}

/** Short-lived signed URL. Only called after an authorisation check. */
export function signedPrivateUrl(publicId: string, ttlSeconds = 120): string | null {
  if (publicId.startsWith("local:")) return null;
  if (!configureCloudinary()) return null;
  return cloudinary.url(publicId, {
    type: "authenticated",
    sign_url: true,
    secure: true,
    expires_at: Math.floor(Date.now() / 1000) + ttlSeconds,
    resource_type: "image",
    flags: "attachment",
  });
}

export async function readLocalPrivateImage(publicId: string): Promise<Buffer | null> {
  if (!publicId.startsWith("local:")) return null;
  try {
    return await readFile(path.join(LOCAL_DIR, `${publicId.slice(6)}.jpg`));
  } catch {
    return null;
  }
}

/** Called as soon as a verification request is decided. Idempotent. */
export async function deletePrivateImage(publicId: string | null): Promise<void> {
  if (!publicId) return;
  if (publicId.startsWith("local:")) {
    await unlink(path.join(LOCAL_DIR, `${publicId.slice(6)}.jpg`)).catch(() => undefined);
    return;
  }
  if (!configureCloudinary()) {
    console.error("[media] cannot delete private asset: storage not configured");
    return;
  }
  await cloudinary.uploader.destroy(publicId, { type: "authenticated", invalidate: true, resource_type: "image" });
}
