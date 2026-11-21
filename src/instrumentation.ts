/**
 * Runs once when a Next.js server process starts (not during `next build`).
 * Production must fail before accepting a request if any service is missing.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  // Keep this dependency-free: importing the Zod env module here would be
  // bundled into middleware and inflate the edge bundle by ~25 kB. The complete
  // schema still validates on every route that imports env.
  const { assertProductionServices } = await import("./lib/adapters");
  assertProductionServices();
}
