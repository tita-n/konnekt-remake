/**
 * Boot-time service check. Runs once per Node process before the server starts
 * accepting requests; a production deployment with a missing adapter key fails
 * loudly here rather than at the first upload, email or rate-limited action.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { assertProductionServices } = await import("./src/lib/adapters");
  assertProductionServices();
}
