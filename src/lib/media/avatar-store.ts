import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { v2 as cloudinary } from "cloudinary";
import { env, hasCloudinary, isProduction } from "@/lib/env";

/**
 * Avatars are public images (unlike ID cards). Cloudinary in deployed
 * environments; a local directory in development.
 */
export async function putPublicAvatar(buffer: Buffer): Promise<string> {
  if (!hasCloudinary) {
    if (isProduction) throw new Error("Avatar storage is not configured");
    const dir = path.join(process.cwd(), "public", "uploads", "avatars");
    await mkdir(dir, { recursive: true });
    const name = `${randomUUID()}.webp`;
    await writeFile(path.join(dir, name), buffer);
    return `/uploads/avatars/${name}`;
  }

  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });

  return new Promise((resolve, reject) => {
    const upload = cloudinary.uploader.upload_stream(
      {
        folder: "konnekt/avatars",
        resource_type: "image",
        overwrite: false,
        invalidate: true,
        transformation: [{ width: 512, height: 512, crop: "fill", gravity: "auto", quality: "auto", fetch_format: "auto" }],
      },
      (error, result) => {
        if (error || !result) {
          reject(new Error("Avatar upload failed"));
          return;
        }
        resolve(result.secure_url);
      },
    );
    upload.end(buffer);
  });
}
