import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import type { NextRequest } from "next/server";
import { apiError, noStore, socialApi } from "@/lib/api/social";
import { isProduction } from "@/lib/env";

export const runtime = "nodejs";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_INPUT = 6 * 1024 * 1024;

/**
 * Development-only storage adapter for post images. It performs the same
 * server-side decode/re-encode as production (EXIF stripped, WebP, capped at
 * 1080px) and writes to a gitignored directory, so the browser flow is real.
 */
export async function POST(request: NextRequest) {
  if (isProduction) return noStore({ error: "Not found." }, { status: 404 });
  const context = await socialApi(request, { mutation: true });
  if ("response" in context) return context.response;
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return noStore({ error: "Choose an image first." }, { status: 400 });
    if (!ALLOWED.has(file.type)) return noStore({ error: "Upload a JPEG, PNG or WebP image." }, { status: 400 });
    if (file.size > MAX_INPUT) return noStore({ error: "That image is too large." }, { status: 400 });
    const input = Buffer.from(await file.arrayBuffer());
    const base = sharp(input, { failOn: "error", limitInputPixels: 40_000_000 }).rotate().resize({
      width: 1080,
      height: 1080,
      fit: "inside",
      withoutEnlargement: true,
    });
    let output = await base.webp({ quality: 78 }).toBuffer({ resolveWithObject: true });
    if (output.data.byteLength > 350 * 1024) {
      output = await sharp(input, { failOn: "error", limitInputPixels: 40_000_000 })
        .rotate()
        .resize({ width: 1080, height: 1080, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 62 })
        .toBuffer({ resolveWithObject: true });
    }
    if (output.data.byteLength > 900 * 1024) {
      return noStore({ error: "That image is still too large after compression." }, { status: 400 });
    }
    const filename = `${randomUUID()}.webp`;
    const dir = path.join(process.cwd(), "public", "uploads", "posts");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, filename), output.data);
    return noStore(
      {
        publicId: `local:posts/${filename.replace(".webp", "")}`,
        url: `/uploads/posts/${filename}`,
        width: output.info.width,
        height: output.info.height,
        bytes: output.data.byteLength,
      },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
