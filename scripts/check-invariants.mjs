import { readFileSync } from "node:fs";

const mapping = JSON.parse(readFileSync("ci/invariants.json", "utf8")).invariants;
const problems = [];
for (const invariant of mapping) {
  let source;
  try {
    source = readFileSync(invariant.file, "utf8");
  } catch {
    problems.push(`${invariant.name}: missing file ${invariant.file}`);
    continue;
  }
  for (const title of invariant.tests) {
    const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(?:it|test)\\(\\s*["'\`]${escaped}["'\`]`);
    if (!pattern.test(source)) problems.push(`${invariant.name}: missing test "${title}" in ${invariant.file}`);
    if (new RegExp(`(?:it|test)\\.skip\\(\\s*["'\`]${escaped}`).test(source)) {
      problems.push(`${invariant.name}: invariant test is skipped`);
    }
  }
}
if (problems.length) {
  console.error("Invariant mapping failed:");
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}
console.log(`Invariant mapping passed (${mapping.length} invariants, all named tests present).`);
