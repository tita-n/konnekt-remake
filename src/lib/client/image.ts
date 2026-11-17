/** Browser-side image compression. Uploads target ~400 KB. */

export const MAX_UPLOAD_BYTES = 6 * 1024 * 1024;
export const TARGET_BYTES = 400 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

export class ClientImageError extends Error {}

export async function loadImage(file: File): Promise<HTMLImageElement> {
  if (!ALLOWED.includes(file.type)) throw new ClientImageError("Choose a JPEG, PNG or WebP photo.");
  if (file.size > MAX_UPLOAD_BYTES) throw new ClientImageError("That photo is larger than 6 MB. Choose a smaller one.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new ClientImageError("We couldn't read that photo. Try another one."));
      image.src = url;
    });
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function encode(image: HTMLImageElement, maxDimension: number, quality: number): Promise<Blob> {
  const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new ClientImageError("This browser cannot process photos.");
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, width, height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new ClientImageError("Could not compress that photo."))),
      "image/jpeg",
      quality,
    );
  });
}

/**
 * Compress to JPEG under the target size while keeping ID text legible.
 * Tries progressively smaller dimensions/qualities; EXIF is dropped by canvas.
 */
export async function compressImage(file: File, targetBytes = TARGET_BYTES): Promise<Blob> {
  const image = await loadImage(file);
  let best: Blob | null = null;
  for (const maxDimension of [1600, 1400, 1200, 1000, 800]) {
    for (const quality of [0.82, 0.72, 0.62]) {
      const blob = await encode(image, maxDimension, quality);
      best = blob;
      if (blob.size <= targetBytes) return blob;
    }
  }
  if (!best) throw new ClientImageError("Could not compress that photo.");
  if (best.size > 900 * 1024) throw new ClientImageError("That photo is too detailed. Try a clearer, closer photo.");
  return best;
}

export function formatBytes(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
