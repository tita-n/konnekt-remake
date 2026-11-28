import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ queryRaw: vi.fn() }));

vi.mock("@/lib/db/platform", () => ({ platformDb: { $queryRaw: db.queryRaw } }));
vi.mock("@/lib/adapters", () => ({ adapterStatus: () => [] }));
vi.mock("@/lib/env", () => ({ env: { NODE_ENV: "test" } }));

import { GET } from "@/app/api/health/route";
import manifest from "@/lib/db/migration-manifest.json";

const EXPECTED = manifest.latest;

function databaseReturns(options: {
  tables?: boolean;
  appliedMigration?: string | null;
  migrationsTable?: boolean;
} = {}) {
  const { tables = true, appliedMigration = EXPECTED, migrationsTable = true } = options;
  db.queryRaw.mockImplementation((strings: TemplateStringsArray) => {
    const sql = strings.join("?");
    if (sql.includes("SELECT 1")) return Promise.resolve([{ "?column?": 1 }]);
    if (sql.includes("to_regclass")) {
      return Promise.resolve([
        {
          post: tables ? 'public."Post"' : null,
          event: tables ? 'public."Event"' : null,
          announcement: tables ? 'public."Announcement"' : null,
        },
      ]);
    }
    if (sql.includes("_prisma_migrations")) {
      if (!migrationsTable) return Promise.reject(new Error("relation does not exist"));
      return Promise.resolve([{ migration_name: appliedMigration }]);
    }
    return Promise.reject(new Error(`unexpected query: ${sql.slice(0, 40)}`));
  });
}

async function health() {
  const response = await GET();
  return { response, body: await response.json() };
}

describe("health migration readiness", () => {
  beforeEach(() => {
    db.queryRaw.mockReset();
  });

  it("returns 200 when the newest applied migration matches the code", async () => {
    databaseReturns();
    const { response, body } = await health();
    expect(response.status).toBe(200);
    expect(body.database).toBe(true);
    expect(body.schemaReady).toBe(true);
    expect(body.migrationReady).toBe(true);
    expect(body.expectedMigration).toBe(EXPECTED);
    expect(body.appliedMigration).toBe(EXPECTED);
  });

  it("returns 503 when the database is behind the code", async () => {
    databaseReturns({ appliedMigration: "20260101000000_previous_release" });
    const { response, body } = await health();
    expect(response.status).toBe(503);
    expect(body.status).toBe("unavailable");
    expect(body.database).toBe(true);
    expect(body.migrationReady).toBe(false);
    expect(body.expectedMigration).toBe(EXPECTED);
    expect(body.appliedMigration).toBe("20260101000000_previous_release");
  });

  it("returns 503 when the migrations table is missing", async () => {
    databaseReturns({ migrationsTable: false });
    const { response, body } = await health();
    expect(response.status).toBe(503);
    expect(body.database).toBe(true);
    expect(body.migrationReady).toBe(false);
    expect(body.appliedMigration).toBeNull();
  });

  it("still fails when the required tables are missing", async () => {
    databaseReturns({ tables: false });
    const { response, body } = await health();
    expect(response.status).toBe(503);
    expect(body.schemaReady).toBe(false);
    expect(body.migrationReady).toBe(true);
  });
});
