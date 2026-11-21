import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

/**
 * A UI-only change may alter components and presentation. It may not change
 * schema, services, auth/middleware, API routes, server actions, workers,
 * dependencies, env/security, performance configuration or test infrastructure.
 */
const config = JSON.parse(readFileSync(".github/ui-guard.json", "utf8"));
const branch = process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || "";
const label = process.env.UI_ONLY_LABEL === "true";
const isUi = branch.startsWith("ui/") || label;
if (!isUi) {
  console.log("UI guard skipped: not a ui/* branch or ui-only pull request.");
  process.exit(0);
}

let files;
if (process.env.INPUT_FILES !== undefined) {
  files = process.env.INPUT_FILES.split(/\r?\n/).filter(Boolean);
} else {
  const base = process.env.BASE_REF || "origin/main";
  const mergeBase = execFileSync("git", ["merge-base", base, "HEAD"], { encoding: "utf8" }).trim();
  files = execFileSync("git", ["diff", "--name-only", mergeBase, "HEAD"], { encoding: "utf8" })
    .split(/\r?\n/)
    .filter(Boolean);
}

function globToRegex(glob) {
  let pattern = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "\u0000")
    .replace(/\*/g, "[^/]*")
    .replace(/\?/g, "[^/]")
    .replace(/\u0000/g, ".*");
  pattern = pattern.replace(/\\\{([^}]+)\\\}/g, (_, choices) => `(?:${choices.split(",").join("|")})`);
  return new RegExp(`^${pattern}$`);
}

const protectedPatterns = config.protected.map((glob) => ({ glob, regex: globToRegex(glob) }));
const allowedPatterns = config.allowed.map((glob) => ({ glob, regex: globToRegex(glob) }));
const violations = files.filter((file) => {
  const blocked = protectedPatterns.some(({ regex }) => regex.test(file));
  if (!blocked) return false;
  return !allowedPatterns.some(({ regex }) => regex.test(file));
});

if (violations.length) {
  console.error("UI-only guard failed. These protected paths changed:");
  for (const file of violations) console.error(`  ${file}`);
  console.error("Move infrastructure/security/test changes to a separate, reviewed PR.");
  process.exit(1);
}
console.log(`UI guard passed (${files.length} changed files, none in protected paths).`);
