/**
 * Prove the runtime DATABASE_URL and the migration DIRECT_URL point at the same
 * migrated database. Prints schema facts only; never prints either URL.
 */
import { PrismaClient } from "@prisma/client";

const runtimeUrl = process.env.DATABASE_URL;
const migrationUrl = process.env.DIRECT_URL;
if (!runtimeUrl || !migrationUrl) {
  console.error("Database consistency check cannot run: DATABASE_URL and DIRECT_URL are both required.");
  process.exit(1);
}

async function inspect(url) {
  const db = new PrismaClient({ datasources: { db: { url } } });
  try {
    const tables = await db.$queryRawUnsafe(
      `SELECT to_regclass('public."Post"')::text AS post,
              to_regclass('public."Event"')::text AS event,
              to_regclass('public."Announcement"')::text AS announcement`,
    );
    let fingerprint = null;
    try {
      const rows = await db.$queryRawUnsafe(
        `SELECT md5(string_agg(migration_name, ',' ORDER BY migration_name)) AS fingerprint,
                COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE finished_at IS NULL)::int AS unfinished
         FROM "_prisma_migrations"`,
      );
      fingerprint = rows[0] ?? null;
    } catch {
      fingerprint = null;
    }
    return { tables: tables[0] ?? {}, fingerprint };
  } finally {
    await db.$disconnect();
  }
}

const failures = [];
let runtime;
let migrations;
try {
  runtime = await inspect(runtimeUrl);
} catch {
  failures.push("runtime database is unreachable or unreadable");
}
try {
  migrations = await inspect(migrationUrl);
} catch {
  failures.push("migration database is unreachable or unreadable");
}

if (runtime) {
  const missing = ["post", "event", "announcement"].filter((table) => !runtime.tables[table]);
  if (missing.length) {
    failures.push(`runtime database is missing table(s): ${missing.map((name) => `public.${name}`).join(", ")}`);
  }
  if (!runtime.fingerprint?.total) {
    failures.push("runtime database has no applied migrations");
  }
}
if (migrations) {
  if (!migrations.fingerprint?.total) failures.push("migration database has no applied migrations");
  if (migrations.fingerprint?.unfinished) failures.push("migration database has an unfinished migration");
}
if (runtime?.fingerprint && migrations?.fingerprint) {
  if (runtime.fingerprint.fingerprint !== migrations.fingerprint.fingerprint) {
    failures.push("DATABASE_URL and DIRECT_URL do not share the same applied migration history");
  }
}

if (failures.length) {
  console.error("Staging database consistency check failed (values are never printed):");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log("Staging database check passed: runtime and migration URLs share the migrated schema.");
