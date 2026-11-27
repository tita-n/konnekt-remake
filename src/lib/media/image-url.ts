/**
 * One place that turns a stored public id into a delivery URL.
 *
 * Only a fixed set of named widths is allowed. Cloudinary counts every unique
 * transformation as billable, so composing ad-hoc `w_` values is how a free
 * plan is consumed by cache sprawl. Swapping provider later means changing this
 * module, not every component.
 */
export const IMAGE_WIDTHS = {
  avatar: 96,
  thumb: 240,
  card: 640,
  cover: 1200,
  full: 1600,
} as const;

export type ImageWidth = keyof typeof IMAGE_WIDTHS;

export function cloudinaryImageUrl(publicId: string, width: ImageWidth, cloudName = process.env.CLOUDINARY_CLOUD_NAME ?? ""): string {
  const w = IMAGE_WIDTHS[width];
  return `https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_auto,c_limit,w_${w}/${publicId}`;
}

/** A demo asset served by the app itself is never uploaded or transformed. */
export function appRelativeImage(publicId: string | null | undefined): string | null {
  if (publicId && publicId.startsWith("/")) return publicId;
  return null;
}
