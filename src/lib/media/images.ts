import "server-only";
import sharp from "sharp";

export const MAX_UPLOAD_BYTES = 6 * 1024 * 1024; // input ceiling; client compresses to ~400 KB
export const MAX_STORED_BYTES = 900 * 1024;
const ALLOWED_INPUT = new Set(["image/jpeg", "image/png", "image/webp"]);

export class ImageValidationError extends Error {
  constructor(
    message: string,
    public readonly code: "TYPE" | "SIZE" | "CORRUPT" | "TOO_LARGE_OUTPUT",
  ) {
    super(message);
  }
}

export interface PreparedImage {
  buffer: Buffer;
  contentType: "image/jpeg";
  width: number;
  height: number;
}

/**
 * Re-encodes every uploaded image server-side. This strips EXIF/GPS metadata,
 * guarantees the bytes really are an image (no polyglot files or SVG scripts),
 * and caps dimensions so ID cards stay small on mobile data.
 */
export async function preparePrivateImage(input: Buffer, declaredType: string): Promise<PreparedImage> {
  if (!ALLOWED_INPUT.has(declaredType)) {
    throw new ImageValidationError("Upload a JPEG, PNG or WebP photo.", "TYPE");
  }
  if (input.byteLength > MAX_UPLOAD_BYTES) {
    throw new ImageValidationError("That photo is too large. Try again with a smaller one.", "SIZE");
  }

  try {
    const image = sharp(input, { failOn: "error", limitInputPixels: 40_000_000 }).rotate();
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height) {
      throw new ImageValidationError("That file is not a readable image.", "CORRUPT");
    }
    const output = await image
      .resize({ width: 1400, height: 1400, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });

    if (output.data.byteLength > MAX_STORED_BYTES) {
      throw new ImageValidationError("That photo is too large even after compression.", "TOO_LARGE_OUTPUT");
    }
    return {
      buffer: output.data,
      contentType: "image/jpeg",
      width: output.info.width,
      height: output.info.height,
    };
  } catch (error) {
    if (error instanceof ImageValidationError) throw error;
    throw new ImageValidationError("That file is not a readable image.", "CORRUPT");
  }
}

/** Square avatar: centre-cropped, small, EXIF-free. */
export async function prepareAvatar(input: Buffer): Promise<Buffer> {
  return sharp(input, { limitInputPixels: 40_000_000 })
    .rotate()
    .resize(512, 512, { fit: "cover", position: "attention" })
    .webp({ quality: 84 })
    .toBuffer();
}
