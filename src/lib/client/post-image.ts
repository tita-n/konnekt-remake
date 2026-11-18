"use client";

import { apiPost, csrfToken } from "@/lib/posts/client";

export interface UploadedPostImage {
  publicId: string;
  url: string;
  width: number;
  height: number;
  alt: string | null;
}

const MAX_LONG_EDGE = 1080;
const TARGET_BYTES = 250 * 1024;
const MAX_INPUT_BYTES = 12 * 1024 * 1024;

function dataSaverOn(): boolean {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return Boolean(connection?.saveData) || window.matchMedia("(prefers-reduced-data: reduce)").matches;
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't compress that image."))), "image/webp", quality);
  });
}

/** Client-side resize and compression before anything leaves the device. */
export async function compressPostImage(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  if (file.size > MAX_INPUT_BYTES) throw new Error("That image is too large. Pick one under 12 MB.");
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("Upload a JPEG, PNG or WebP image.");
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new Error("That file isn't a readable image.");
  const scale = Math.min(1, MAX_LONG_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Couldn't prepare that image.");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  let quality = dataSaverOn() ? 0.55 : 0.8;
  let blob = await canvasToBlob(canvas, quality);
  while (blob.size > TARGET_BYTES && quality > 0.4) {
    quality -= 0.08;
    blob = await canvasToBlob(canvas, quality);
  }
  if (blob.size > 900 * 1024) throw new Error("That image is still too large after compression.");
  return { blob, width, height };
}

type SignResponse =
  | { mode: "local" }
  | {
      mode: "cloudinary";
      cloudName: string;
      apiKey: string;
      signature: string;
      timestamp: number;
      folder: string;
      publicId: string;
    };

export async function uploadPostImage(file: File): Promise<UploadedPostImage> {
  const compressed = await compressPostImage(file);
  const sign = await apiPost<SignResponse>("/api/uploads/sign");

  if (sign.mode === "local") {
    const form = new FormData();
    form.append("file", new File([compressed.blob], "post.webp", { type: "image/webp" }));
    const response = await fetch("/api/uploads/local", {
      method: "POST",
      headers: { "x-konnekt-csrf": csrfToken() },
      body: form,
    });
    const data = (await response.json().catch(() => ({}))) as Partial<UploadedPostImage> & { error?: string };
    if (!response.ok || !data.publicId || !data.url) throw new Error(data.error ?? "Couldn't upload that image.");
    return {
      publicId: data.publicId,
      url: data.url,
      width: data.width ?? compressed.width,
      height: data.height ?? compressed.height,
      alt: null,
    };
  }

  const form = new FormData();
  form.append("file", new File([compressed.blob], "post.webp", { type: "image/webp" }));
  form.append("api_key", sign.apiKey);
  form.append("timestamp", String(sign.timestamp));
  form.append("signature", sign.signature);
  form.append("folder", sign.folder);
  form.append("public_id", sign.publicId);
  const response = await fetch(`https://api.cloudinary.com/v1_1/${sign.cloudName}/image/upload`, {
    method: "POST",
    body: form,
  });
  const data = (await response.json().catch(() => ({}))) as {
    error?: { message?: string };
    public_id?: string;
    secure_url?: string;
    width?: number;
    height?: number;
  };
  if (!response.ok || !data.public_id || !data.secure_url) {
    throw new Error(data.error?.message ?? "Cloudinary couldn't accept that image.");
  }
  if (typeof data.width === "number" && data.width > 1600) throw new Error("That image is too wide.");
  return {
    publicId: data.public_id,
    url: data.secure_url,
    width: data.width ?? compressed.width,
    height: data.height ?? compressed.height,
    alt: null,
  };
}
