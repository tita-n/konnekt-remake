/** Print schema/migration facts only. Never prints a connection string or row data. */
import { PrismaClient } from "@prisma/client";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not available.");
  process.exit(0);
}
const db = new PrismaClient({ datasources: { db: { url } } });
try {
  const columns = await db.$queryRawUnsafe(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'Post'
     ORDER BY column_name`,
  );
  console.log(`Post columns: ${columns.map((row) => row.column_name).join(", ")}`);
  const migrations = await db.$queryRawUnsafe(
    'SELECT migration_name, finished_at FROM "_prisma_migrations" ORDER BY started_at DESC LIMIT 8',
  );
  for (const row of migrations) {
    console.log(`migration ${row.migration_name}: ${row.finished_at ? "applied" : "UNFINISHED"}`);
  }
  const tables = await db.$queryRawUnsafe(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name IN ('Post', 'Event', 'Announcement')
     ORDER BY table_name`,
  );
  console.log(`tables: ${tables.map((row) => row.table_name).join(", ")}`);
} catch (error) {
  console.error(`Database diagnosis failed: ${error instanceof Error ? error.message : "unknown error"}`);
} finally {
  await db.$disconnect();
}
