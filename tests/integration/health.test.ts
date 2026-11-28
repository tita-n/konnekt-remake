import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/health/route";

describe("health readiness", () => {
  it("requires the migrated schema, not just a reachable database", async () => {
    const response = await GET();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.database).toBe(true);
    expect(body.schemaReady).toBe(true);
    expect(body.migrationReady).toBe(true);
    expect(body.appliedMigration).toBe(body.expectedMigration);
    expect(body.status).toBe("ok");
  });
});
