/**
 * Branded fixtures for the component gallery. Demo data may carry a university
 * name; the app shell may not, so these live outside `src` where the branding
 * guard (and the bundler) can still reach them.
 */
export const GALLERY_UNIVERSITY = {
  name: "Nova University",
  shortName: "Nova",
  logoUrl: null,
  accentColor: "#4f46e5",
  status: "ACTIVE",
} as const;
