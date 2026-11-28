/**
 * Migration safety lint.
 *
 * Expand-and-contract policy: additive migrations ship first; destructive DDL
 * (drops, renames, NOT NULL without a default, SET NOT NULL) must wait for a
 * later release. This lint fails a new migration that contains destructive DDL
 * unless it carries a reviewed, reasoned annotation:
 *
 *   -- migration-safety: destructive-approved: <why this is safe now>
 *
 * Migrations that predate the policy are frozen by SHA-256 in
 * scripts/migration-lint-baseline.json. Editing one of those files fails the
 * lint (and would also break Prisma's migration checksum).
 *
 * Also verifies that src/lib/db/migration-manifest.json matches the newest
 * migration directory, because /api/health uses it as the expected version.
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const DEFAULT_MIGRATIONS_DIR = path.join(REPO_ROOT, "prisma", "migrations");
const DEFAULT_BASELINE = path.join(REPO_ROOT, "scripts", "migration-lint-baseline.json");
const DEFAULT_MANIFEST = path.join(REPO_ROOT, "src", "lib", "db", "migration-manifest.json");

const APPROVAL = /^\s*--\s*migration-safety:\s*destructive-approved\b(?:\s*[:—–-]\s*)?(\S.*)$/im;

const DESTRUCTIVE_PATTERNS = [
  {
    rule: "DROP object",
    pattern: /\bDROP\s+(?:TABLE|COLUMN|INDEX|TYPE|VIEW|SCHEMA|CONSTRAINT|FUNCTION|TRIGGER|SEQUENCE|EXTENSION|POLICY)\b/gi,
  },
  {
    rule: "RENAME object",
    pattern: /\bALTER\s+(?:TABLE|TYPE|INDEX|VIEW|SCHEMA)\b[^;]*?\bRENAME\b/gi,
  },
  {
    rule: "ADD COLUMN NOT NULL without DEFAULT",
    pattern: /\bADD\s+COLUMN\b[^;]*?\bNOT\s+NULL\b(?![^;]*?\bDEFAULT\b)/gi,
  },
  {
    rule: "SET NOT NULL",
    pattern: /\bALTER\s+COLUMN\b[^;]*?\bSET\s+NOT\s+NULL\b/gi,
  },
];

/** Replace SQL comments with whitespace while preserving line numbers. */
export function stripSqlComments(sql) {
  let output = "";
  let index = 0;
  let quote = null;
  while (index < sql.length) {
    const char = sql[index];
    const next = sql[index + 1];
    if (quote) {
      output += char;
      if (quote === "'" && char === "'" && next === "'") {
        output += next;
        index += 2;
        continue;
      }
      if (char === quote) quote = null;
      index += 1;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      output += char;
      index += 1;
      continue;
    }
    if (char === "-" && next === "-") {
      while (index < sql.length && sql[index] !== "\n") {
        output += " ";
        index += 1;
      }
      continue;
    }
    if (char === "/" && next === "*") {
      output += "  ";
      index += 2;
      while (index < sql.length && !(sql[index] === "*" && sql[index + 1] === "/")) {
        output += sql[index] === "\n" ? "\n" : " ";
        index += 1;
      }
      if (index < sql.length) {
        output += "  ";
        index += 2;
      }
      continue;
    }
    output += char;
    index += 1;
  }
  return output;
}

/** Return every destructive statement in a migration, with a 1-based line. */
export function findDestructiveChanges(sql) {
  const text = stripSqlComments(sql);
  const findings = [];
  for (const { rule, pattern } of DESTRUCTIVE_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const line = text.slice(0, match.index).split("\n").length;
      findings.push({
        rule,
        line,
        statement: match[0].replace(/\s+/g, " ").trim().slice(0, 160),
      });
    }
  }
  return findings.sort((left, right) => left.line - right.line);
}

/** A destructive migration is approved only when the annotation has a reason. */
export function hasDestructiveApproval(sql) {
  const match = APPROVAL.exec(sql);
  return Boolean(match?.[1]?.trim());
}

export function listMigrations(migrationsDir = DEFAULT_MIGRATIONS_DIR) {
  return readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d{14}_/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

export function lintMigrations(options = {}) {
  const migrationsDir = options.migrationsDir ?? DEFAULT_MIGRATIONS_DIR;
  const baselinePath = options.baselinePath ?? DEFAULT_BASELINE;
  const manifestPath = options.manifestPath ?? DEFAULT_MANIFEST;
  const writeManifest = options.writeManifest === true;
  const failures = [];
  const names = listMigrations(migrationsDir);
  if (!names.length) failures.push(`no Prisma migrations found in ${migrationsDir}`);

  const baseline = readJson(baselinePath).migrations ?? {};
  const baselineNames = new Set(Object.keys(baseline));
  for (const name of names) baselineNames.delete(name);
  for (const missing of baselineNames) {
    failures.push(`baseline references a migration that no longer exists: ${missing}`);
  }

  let legacyAllowed = 0;
  let approved = 0;
  for (const name of names) {
    const file = path.join(migrationsDir, name, "migration.sql");
    if (!existsSync(file)) {
      failures.push(`${name} has no migration.sql`);
      continue;
    }
    const sql = readFileSync(file, "utf8");
    const hash = sha256(sql);
    const baselineHash = baseline[name];
    if (baselineHash && baselineHash !== hash) {
      failures.push(`${name} was edited after being baselined; never edit an applied migration`);
      continue;
    }
    const findings = findDestructiveChanges(sql);
    if (!findings.length) continue;
    if (baselineHash === hash) {
      legacyAllowed += 1;
      continue;
    }
    if (hasDestructiveApproval(sql)) {
      approved += 1;
      continue;
    }
    for (const finding of findings) {
      failures.push(
        `${name}/migration.sql:${finding.line} ${finding.rule} is destructive (${finding.statement}). ` +
          "Split it into an additive migration, or add `-- migration-safety: destructive-approved: <reason>` after review.",
      );
    }
  }

  const latest = names.at(-1) ?? null;
  const manifest = readJson(manifestPath);
  if (writeManifest && latest) {
    writeFileSync(manifestPath, `${JSON.stringify({ latest }, null, 2)}\n`);
  } else if (manifest.latest !== latest) {
    failures.push(
      `src/lib/db/migration-manifest.json expects ${manifest.latest ?? "nothing"} but the newest migration is ${latest ?? "nothing"}. ` +
        "Run `npm run db:manifest`.",
    );
  }

  return {
    failures,
    latest,
    total: names.length,
    legacyAllowed,
    approved,
    manifestUpdated: writeManifest && Boolean(latest),
  };
}

function main() {
  const writeManifest = process.argv.includes("--write");
  const result = lintMigrations({ writeManifest });
  if (result.manifestUpdated) console.log(`Updated migration manifest to ${result.latest}.`);
  if (result.failures.length) {
    console.error("Migration lint failed:");
    for (const failure of result.failures) console.error(`- ${failure}`);
    process.exitCode = 1;
    return;
  }
  console.log(
    `Migration lint passed: ${result.total} migrations, ${result.legacyAllowed} legacy destructive migration(s) baselined, ` +
      `${result.approved} reviewed destructive migration(s), latest ${result.latest}.`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
