#!/usr/bin/env node
/**
 * Multi-tenancy guard: no university name may be hardcoded in the app shell.
 *
 * University branding is data (`University.name`, `logoUrl`, `accentColor`),
 * never a literal in `src`. Demo fixtures for the design gallery are the one
 * exception and must live outside `src` (they do not).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");

// Seeded/demo university names, plus known real universities that have appeared
// as examples. Case-insensitive whole-name match.
const NAMES = [
  "Nova University",
  "Demo University",
  "University of Lagos",
  "Covenant University",
  "Ahmadu Bello University",
  "University of Ibadan",
  "Obafemi Awolowo University",
];

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) files.push(full);
  }
  return files;
}

const problems = [];
for (const file of walk(SRC)) {
  const text = readFileSync(file, "utf8");
  for (const name of NAMES) {
    const index = text.toLowerCase().indexOf(name.toLowerCase());
    if (index === -1) continue;
    const line = text.slice(0, index).split("\n").length;
    problems.push(`${relative(ROOT, file)}:${line} contains "${name}"`);
  }
}

if (problems.length > 0) {
  console.error("University names must be data, not literals in src:\n");
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(`University branding guard: ${walk(SRC).length} source files are name-neutral.`);
