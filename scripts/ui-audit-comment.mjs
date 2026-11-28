import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { UI_AUDIT_MARKER, buildComment } from "./lib/ui-audit.mjs";

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

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function gh(args, input) {
  return execFileSync("gh", args, {
    input,
    encoding: "utf8",
    env: process.env,
    stdio: ["pipe", "pipe", "pipe"],
  });
}

function run() {
  const args = parseArgs(process.argv.slice(2));
  const repo = process.env.GITHUB_REPOSITORY;
  const prNumber = Number.parseInt(args.pr ?? process.env.UI_AUDIT_PR ?? "0", 10);
  const runNumber = Number.parseInt(args.run ?? process.env.UI_AUDIT_RUN ?? "0", 10);
  if (!repo || !prNumber) {
    console.log("No PR number; skipping the sticky comment.");
    return;
  }

  const summary = readJson(args.summary);
  const previous = args.previous ? readJson(args.previous) : null;
  const branch = args.branch ?? process.env.UI_AUDIT_BRANCH ?? "";
  const runUrl = args["run-url"] ?? process.env.UI_AUDIT_RUN_URL ?? "";
  const resultsPath = args["results-path"] ?? `${prNumber}/${runNumber}`;

  const body = summary
    ? buildComment({
        summary,
        previous,
        prNumber,
        runNumber,
        branch,
        runUrl,
        resultsPath,
      })
    : [
        UI_AUDIT_MARKER,
        "## Konnekt UI audit",
        "",
        `The audit could not produce \`summary.json\` for run #${runNumber}. Check the [workflow run](${runUrl}) for infrastructure errors.`,
        "",
        "_No screenshots were published for this run._",
      ].join("\n");

  const comments = JSON.parse(
    gh(["api", `repos/${repo}/issues/${prNumber}/comments?per_page=100`, "--jq", "[.[] | {id, body}]"]),
  );
  const existing = Array.isArray(comments) ? comments.find((comment) => String(comment.body ?? "").includes(UI_AUDIT_MARKER)) : null;
  const payload = JSON.stringify({ body });
  if (existing) {
    gh(["api", "-X", "PATCH", `repos/${repo}/issues/comments/${existing.id}`, "--input", "-"], payload);
    console.log(`Updated sticky audit comment ${existing.id}`);
  } else {
    gh(["api", "-X", "POST", `repos/${repo}/issues/${prNumber}/comments`, "--input", "-"], payload);
    console.log("Created sticky audit comment");
  }
}

try {
  run();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
