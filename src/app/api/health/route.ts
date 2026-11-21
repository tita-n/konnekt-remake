import { NextResponse } from "next/server";
import { adapterStatus } from "@/lib/adapters";
import { env } from "@/lib/env";
// Health is infrastructure: it must check the unscoped connection directly.
// eslint-disable-next-line no-restricted-imports
import { platformDb } from "@/lib/db/platform";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Liveness plus dependency readiness. It never returns secret values and is
 * safe for the staging smoke test. A failed database check is a 503 so a
 * deployment cannot be promoted while the data layer is unavailable.
 */
export async function GET(): Promise<NextResponse> {
  let database = false;
  try {
    await platformDb.$queryRaw`SELECT 1`;
    database = true;
  } catch {
    database = false;
  }

  const adapters = adapterStatus().map(({ service, provider, mode, configured, requiredInProduction }) => ({
    service,
    provider,
    mode,
    configured,
    requiredInProduction,
  }));
  const servicesReady = env.NODE_ENV !== "production" || adapters.every((adapter) => !adapter.requiredInProduction || adapter.configured);
  const ok = database && servicesReady;

  return NextResponse.json(
    {
      status: ok ? "ok" : "unavailable",
      database,
      environment: env.NODE_ENV,
      services: adapters,
    },
    {
      status: ok ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
