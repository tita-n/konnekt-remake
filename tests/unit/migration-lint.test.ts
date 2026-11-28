import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  findDestructiveChanges,
  hasDestructiveApproval,
  lintMigrations,
} from "../../scripts/migration-lint.mjs";

function fixture(sql: string) {
  const root = mkdtempSync(path.join(tmpdir(), "konnekt-migration-lint-"));
  const name = "20261128120000_drop_legacy";
  const migrationsDir = path.join(root, "migrations");
  mkdirSync(path.join(migrationsDir, name), { recursive: true });
  writeFileSync(path.join(migrationsDir, name, "migration.sql"), sql);
  writeFileSync(path.join(root, "baseline.json"), JSON.stringify({ version: 1, migrations: {} }));
  writeFileSync(path.join(root, "manifest.json"), JSON.stringify({ latest: name }));
  return {
    root,
    options: {
      migrationsDir,
      baselinePath: path.join(root, "baseline.json"),
      manifestPath: path.join(root, "manifest.json"),
    },
  };
}

describe("migration safety lint", () => {
  it("flags drops, renames, NOT NULL without default and SET NOT NULL", () => {
    const sql = `
      DROP TABLE "Old";
      ALTER TABLE "User" DROP COLUMN "legacy";
      ALTER TABLE "User" RENAME COLUMN "name" TO "fullName";
      ALTER TABLE "User" ADD COLUMN "handle" TEXT NOT NULL;
      ALTER TABLE "User" ALTER COLUMN "handle" SET NOT NULL;
    `;
    const findings = findDestructiveChanges(sql);
    expect(findings.map((finding) => finding.rule)).toEqual([
      "DROP object",
      "DROP object",
      "RENAME object",
      "ADD COLUMN NOT NULL without DEFAULT",
      "SET NOT NULL",
    ]);
  });

  it("allows additive ADD COLUMN NOT NULL with a default and new tables", () => {
    const sql = `
      CREATE TABLE "New" ("id" TEXT NOT NULL, "createdAt" TIMESTAMP NOT NULL);
      ALTER TABLE "User" ADD COLUMN "handle" TEXT NOT NULL DEFAULT 'pending';
      ALTER TABLE "User" ADD COLUMN "nickname" TEXT;
    `;
    expect(findDestructiveChanges(sql)).toEqual([]);
  });

  it("ignores destructive words inside comments", () => {
    const sql = `
      -- DROP TABLE "Old" is deliberately deferred.
      /* ALTER TABLE "User" DROP COLUMN "legacy"; */
      ALTER TABLE "User" ADD COLUMN "nickname" TEXT;
    `;
    expect(findDestructiveChanges(sql)).toEqual([]);
  });

  it("requires a reason after the reviewed destructive annotation", () => {
    expect(hasDestructiveApproval("-- migration-safety: destructive-approved")).toBe(false);
    expect(
      hasDestructiveApproval(
        "-- migration-safety: destructive-approved: reviewed in #42; the old column has been unread since the previous release",
      ),
    ).toBe(true);
  });

  it("rejects an unannotated destructive migration", () => {
    const { root, options } = fixture('ALTER TABLE "User" DROP COLUMN "legacy";');
    try {
      const result = lintMigrations(options);
      expect(result.failures.join("\n")).toContain("DROP object is destructive");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("accepts a destructive migration with a reasoned annotation", () => {
    const { root, options } = fixture(
      '-- migration-safety: destructive-approved: reviewed in #42; no release reads this column\nALTER TABLE "User" DROP COLUMN "legacy";',
    );
    try {
      const result = lintMigrations(options);
      expect(result.failures).toEqual([]);
      expect(result.approved).toBe(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("accepts the committed migrations and manifest", () => {
    const result = lintMigrations();
    expect(result.failures).toEqual([]);
    expect(result.legacyAllowed).toBeGreaterThan(0);
  });
});
