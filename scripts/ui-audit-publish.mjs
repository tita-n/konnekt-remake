import { execFileSync } from "node:child_process";
import { cp, mkdir, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { assertRunSize, pruneRuns } from "./lib/ui-audit.mjs";

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) args[key] = true;
    else {
      args[key] = value;
      index += 1;
    }
  }
  return args;
}

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

async function directorySize(root) {
  let total = 0;
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.name === ".git") continue;
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) total += await directorySize(full);
    else if (entry.isFile()) total += (await stat(full)).size;
  }
  return total;
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const resultsRoot = path.resolve(args.root ?? process.env.UI_AUDIT_RESULTS_ROOT ?? "ui-audit-results");
  const source = path.resolve(args.out ?? ".ui-audit");
  const prNumber = Number.parseInt(args.pr ?? process.env.UI_AUDIT_PR ?? "0", 10);
  const runNumber = Number.parseInt(args.run ?? process.env.UI_AUDIT_RUN ?? "0", 10);
  if (!prNumber || !runNumber) throw new Error("--pr and --run are required");

  const prDir = path.join(resultsRoot, String(prNumber));
  const existing = await readdir(prDir, { withFileTypes: true }).catch(() => []);
  const runDirectories = existing.filter((entry) => entry.isDirectory() && /^\d+$/.test(entry.name)).map((entry) => entry.name);
  const { removed } = pruneRuns(runDirectories, runNumber);
  for (const oldRun of removed) await rm(path.join(prDir, String(oldRun)), { recursive: true, force: true });

  const destination = path.join(prDir, String(runNumber));
  await rm(destination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true });
  await cp(path.join(source, "summary.json"), path.join(destination, "summary.json"));
  await cp(path.join(source, "summary.md"), path.join(destination, "summary.md"));
  await cp(path.join(source, "shots"), path.join(destination, "shots"), { recursive: true, force: true });

  const bytes = await directorySize(resultsRoot);
  assertRunSize(bytes);
  await git(resultsRoot, ["add", "-A"]);
  const status = git(resultsRoot, ["status", "--porcelain"]);
  if (!status.trim()) {
    console.log("No results change to publish.");
    return;
  }
  git(resultsRoot, ["commit", "-m", `UI audit: PR #${prNumber} run ${runNumber}`]);
  let pushed = false;
  let lastError;
  for (let attempt = 1; attempt <= 3 && !pushed; attempt += 1) {
    try {
      git(resultsRoot, ["push", "origin", "HEAD:ui-audit-results"]);
      pushed = true;
    } catch (error) {
      lastError = error;
      if (attempt === 3) break;
      try {
        git(resultsRoot, ["pull", "--rebase", "origin", "ui-audit-results"]);
      } catch {
        git(resultsRoot, ["rebase", "--abort"]).toString();
      }
    }
  }
  if (!pushed) throw lastError ?? new Error("Could not push ui-audit-results");
  console.log(`Published PR #${prNumber} run ${runNumber}; branch is ${(bytes / 1024 / 1024).toFixed(1)} MB`);
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
