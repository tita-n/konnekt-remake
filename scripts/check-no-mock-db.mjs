import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

/**
 * Fails if a mock/in-memory/failover database path returns to runtime code.
 * This guard exists because a UI-only change once replaced the Prisma client
 * with a mock that could have served fabricated data in production.
 */
const ROOTS = ["src", "prisma"];
const BANNED = [
  /\bmock(?:ed)?[_ -]?database\b/i,
  /\bdatabase[_ -]?mock\b/i,
  /\bin[_-]memory[_ -]?database\b/i,
  /\b(?:database|db)[_-]?failover\b/i,
  /\b(?:failover|fallback)[_-]?(?:database|db)\b/i,
  /\bmemory(?:db|database)\b/i,
];
const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs"]);

function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) return walk(full);
    return EXTENSIONS.has(path.extname(entry)) ? [full] : [];
  });
}

const hits = [];
for (const root of ROOTS) {
  for (const file of walk(path.join(process.cwd(), root))) {
    const source = readFileSync(file, "utf8");
    if (BANNED.some((pattern) => pattern.test(source))) hits.push(path.relative(process.cwd(), file));
  }
}

if (hits.length > 0) {
  console.error("Mock/in-memory/failover database code is forbidden:");
  for (const hit of hits) console.error(`  ${hit}`);
  process.exit(1);
}
console.log("Database guard passed: no mock or failover database code in src/prisma.");
