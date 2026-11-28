import { NextResponse } from "next/server";
import { adapterStatus } from "@/lib/adapters";
import { env } from "@/lib/env";
// Health is infrastructure: it must check the unscoped connection directly.
// eslint-disable-next-line no-restricted-imports
import { platformDb } from "@/lib/db/platform";
import expectedMigration from "@/lib/db/migration-manifest.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXPECTED_MIGRATION = expectedMigration.latest;

/**
 * Liveness plus dependency readiness. It never returns secret values and is
 * safe for the staging smoke test. A failed database, table or migration check
 * is a 503 so a deployment cannot be promoted while the data layer is behind
 * the code.
 */
export async function GET(): Promise<NextResponse> {
  let database = false;
  let schemaReady = false;
  let migrationReady = false;
  let appliedMigration: string | null = null;
  try {
    await platformDb.$queryRaw`SELECT 1`;
    database = true;
  } catch {
    database = false;
  }

  if (database) {
    // A reachable database is not necessarily the migrated one. Checking the
    // Phase 3 tables here turns a wrong DATABASE_URL into a failed readiness
    // probe instead of a first-request 500.
    try {
      const tables = await platformDb.$queryRaw<Array<{ post: string | null; event: string | null; announcement: string | null }>>`
        SELECT to_regclass('public."Post"')::text AS post,
               to_regclass('public."Event"')::text AS event,
               to_regclass('public."Announcement"')::text AS announcement
      `;
      schemaReady = Boolean(tables[0]?.post && tables[0]?.event && tables[0]?.announcement);
    } catch {
      schemaReady = false;
    }

    // Compare the migration this build expects with the newest successfully
    // applied migration. A deployment whose migrate step did not run, or ran
    // against another database, is "behind" even when the tables exist.
    try {
      const migrations = await platformDb.$queryRaw<Array<{ migration_name: string | null }>>`
        SELECT migration_name
        FROM "_prisma_migrations"
        WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
        ORDER BY finished_at DESC, migration_name DESC
        LIMIT 1
      `;
      appliedMigration = migrations[0]?.migration_name ?? null;
      migrationReady = appliedMigration === EXPECTED_MIGRATION;
    } catch {
      migrationReady = false;
    }
  }

  const adapters = adapterStatus().map(({ service, provider, mode, configured, requiredInProduction }) => ({
    service,
    provider,
    mode,
    configured,
    requiredInProduction,
  }));
  const servicesReady = env.NODE_ENV !== "production" || adapters.every((adapter) => !adapter.requiredInProduction || adapter.configured);
  const ok = database && schemaReady && migrationReady && servicesReady;

  return NextResponse.json(
    {
      status: ok ? "ok" : "unavailable",
      database,
      schemaReady,
      migrationReady,
      expectedMigration: EXPECTED_MIGRATION,
      appliedMigration,
      environment: env.NODE_ENV,
      services: adapters,
    },
    {
      status: ok ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
