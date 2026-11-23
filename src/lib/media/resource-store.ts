import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { v2 as cloudinary } from "cloudinary";
import {
  ALLOWED_RESOURCE_MIME,
  MAX_RESOURCE_BYTES,
  resourceExtension,
  resourceMimeForExtension,
} from "@/lib/domain/community";
import { env, hasCloudinary, isProduction } from "@/lib/env";

/**
 * Community resource files are private. Production stores them as authenticated
 * Cloudinary raw assets, reached only through short-lived signed URLs after an
 * access check. Development uses a gitignored directory behind the same
 * authorised route, so the access boundary is identical.
 */
const LOCAL_DIR = path.join(process.cwd(), ".private-media", "resources");

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

export interface StoredResource {
  fileKey: string;
  extension: string;
  mimeType: string;
  sizeBytes: number;
}

function startsWith(buffer: Buffer, bytes: number[]): boolean {
  if (buffer.length < bytes.length) return false;
  return bytes.every((byte, index) => buffer[index] === byte);
}

function looksLikeText(buffer: Buffer): boolean {
  if (buffer.includes(0)) return false;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    return true;
  } catch {
    return false;
  }
}

/** Reject a file whose bytes do not match its claimed extension. */
function contentMatchesExtension(buffer: Buffer, extension: string): boolean {
  switch (extension) {
    case "pdf":
      return startsWith(buffer, [0x25, 0x50, 0x44, 0x46]);
    case "docx":
    case "pptx":
    case "xlsx":
      return startsWith(buffer, [0x50, 0x4b, 0x03, 0x04]);
    case "png":
      return startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "jpg":
    case "jpeg":
      return startsWith(buffer, [0xff, 0xd8, 0xff]);
    case "webp":
      return (
        buffer.length >= 12 &&
        buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
        buffer.subarray(8, 12).toString("ascii") === "WEBP"
      );
    case "txt":
      return looksLikeText(buffer);
    default:
      return false;
  }
}

export async function storeResourceFile(input: {
  filename: string;
  contentType: string;
  bytes: Buffer;
}): Promise<StoredResource> {
  if (input.bytes.length === 0) throw new Error("That file is empty.");
  if (input.bytes.length > MAX_RESOURCE_BYTES) throw new Error("Files can be up to 10 MB.");
  const extension = resourceExtension(input.filename);
  if (!extension) throw new Error("Use a PDF, Word, PowerPoint, Excel, text or image file.");
  const allowed = ALLOWED_RESOURCE_MIME[extension] ?? [];
  const claimed = input.contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (claimed && claimed !== "application/octet-stream" && !allowed.includes(claimed)) {
    throw new Error("That file type doesn't match its extension.");
  }
  const mimeType = resourceMimeForExtension(extension);
  if (!mimeType) throw new Error("That file type isn't supported.");
  if (!contentMatchesExtension(input.bytes, extension)) {
    throw new Error("The file contents don't match its extension.");
  }

  if (!configureCloudinary()) {
    if (isProduction) throw new Error("Private resource storage is not configured.");
    await mkdir(LOCAL_DIR, { recursive: true });
    const id = randomUUID();
    await writeFile(path.join(LOCAL_DIR, `${id}.${extension}`), input.bytes, { mode: 0o600 });
    return { fileKey: `local:resources/${id}.${extension}`, extension, mimeType, sizeBytes: input.bytes.length };
  }

  const fileKey = await new Promise<string>((resolve, reject) => {
    const upload = cloudinary.uploader.upload_stream(
      {
        folder: "konnekt/community-resources",
        type: "authenticated",
        resource_type: "raw",
        overwrite: false,
        invalidate: true,
        unique_filename: true,
        use_filename: false,
        filename_override: `resource.${extension}`,
      },
      (error, result) => {
        if (error || !result) {
          reject(new Error("Resource upload failed."));
          return;
        }
        resolve(result.public_id);
      },
    );
    upload.end(input.bytes);
  });
  return { fileKey, extension, mimeType, sizeBytes: input.bytes.length };
}

export async function readLocalResource(fileKey: string): Promise<Buffer | null> {
  if (!fileKey.startsWith("local:resources/")) return null;
  const relative = fileKey.slice("local:resources/".length);
  if (!/^[a-f0-9-]+\.[a-z0-9]+$/i.test(relative)) return null;
  try {
    return await readFile(path.join(LOCAL_DIR, relative));
  } catch {
    return null;
  }
}

export function signedResourceUrl(fileKey: string, extension: string, ttlSeconds = 120): string | null {
  if (fileKey.startsWith("local:")) return null;
  if (!configureCloudinary()) return null;
  return cloudinary.url(fileKey, {
    type: "authenticated",
    sign_url: true,
    secure: true,
    expires_at: Math.floor(Date.now() / 1000) + ttlSeconds,
    resource_type: "raw",
    flags: "attachment",
    attachment: `resource.${extension}`,
  });
}

export async function deleteResourceFile(fileKey: string): Promise<void> {
  if (fileKey.startsWith("local:resources/")) {
    const relative = fileKey.slice("local:resources/".length);
    if (/^[a-f0-9-]+\.[a-z0-9]+$/i.test(relative)) {
      await unlink(path.join(LOCAL_DIR, relative)).catch(() => undefined);
    }
    return;
  }
  if (!configureCloudinary()) {
    console.error("[media] cannot delete resource: storage not configured");
    return;
  }
  await cloudinary.uploader.destroy(fileKey, { type: "authenticated", invalidate: true, resource_type: "raw" });
}

export function resourceExtensionFromKey(fileKey: string): string {
  const extension = fileKey.split(".").pop()?.toLowerCase() ?? "bin";
  return /^[a-z0-9]+$/.test(extension) ? extension : "bin";
}
