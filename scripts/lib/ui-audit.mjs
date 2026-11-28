import path from "node:path";

export const UI_AUDIT_MARKER = "<!-- konnekt-ui-audit -->";
export const UI_AUDIT_RESULTS_BRANCH = "ui-audit-results";
export const UI_AUDIT_KEEP_RUNS = 3;
export const UI_AUDIT_MAX_COMMENT_CHARS = 62_000;
export const UI_AUDIT_MAX_BYTES = 100 * 1024 * 1024;

const RULE_LABELS = {
  "horizontal-overflow": "Horizontal overflow",
  "touch-target": "Touch target under 44px",
  "overlap": "Overlapping fixed/sticky UI",
  "clipped-text": "Clipped single-line text",
  "image-aspect": "Image without reserved aspect ratio",
  "accessible-name": "Icon-only control without a name",
  "contrast": "Contrast below WCAG AA",
};

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 };

export function ruleLabel(rule) {
  return RULE_LABELS[rule] ?? rule;
}

export function defectKey(defect) {
  return [defect.route, defect.state ?? "default", defect.width, defect.theme, defect.rule, defect.selector].join("|");
}

export function normalizeRunNumber(value) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/**
 * Return which run directories to keep and which to delete. Only numeric
 * directories count. The current run is always kept, even if an older run has
 * a higher number.
 */
export function pruneRuns(existingRuns, currentRun, keep = UI_AUDIT_KEEP_RUNS) {
  const current = normalizeRunNumber(currentRun);
  const runs = [...new Set(existingRuns.map(normalizeRunNumber).filter((run) => run > 0))];
  if (current > 0 && !runs.includes(current)) runs.push(current);
  runs.sort((a, b) => b - a);
  const keepSet = new Set(runs.slice(0, Math.max(1, keep)));
  if (current > 0) keepSet.add(current);
  const kept = [...keepSet].sort((a, b) => b - a);
  const removed = runs.filter((run) => !keepSet.has(run));
  return { kept, removed };
}

export function defectCounts(defects) {
  const byGroup = new Map();
  const byWidth = new Map();
  const byRule = new Map();
  for (const defect of defects) {
    const group = defect.group ?? "ungrouped";
    byGroup.set(group, (byGroup.get(group) ?? 0) + 1);
    byWidth.set(String(defect.width), (byWidth.get(String(defect.width)) ?? 0) + 1);
    byRule.set(defect.rule, (byRule.get(defect.rule) ?? 0) + 1);
  }
  return {
    byGroup: [...byGroup.entries()].map(([id, count]) => ({ id, count })),
    byWidth: [...byWidth.entries()].map(([width, count]) => ({ width: Number(width), count })).sort((a, b) => a.width - b.width),
    byRule: [...byRule.entries()].map(([rule, count]) => ({ rule, count })).sort((a, b) => b.count - a.count),
  };
}

export function diffDefectSets(currentDefects, previousDefects) {
  const previous = new Set((previousDefects ?? []).map(defectKey));
  const current = new Set((currentDefects ?? []).map(defectKey));
  let added = 0;
  let fixed = 0;
  for (const key of current) if (!previous.has(key)) added += 1;
  for (const key of previous) if (!current.has(key)) fixed += 1;
  return { added, fixed, previous: previous.size, current: current.size };
}

export function escapeTableCell(value) {
  return String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, " ")
    .replace(/`/g, "\\`")
    .slice(0, 180);
}

export function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return "unknown";
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function groupLabel(summary, groupId) {
  return summary.groups?.find((group) => group.id === groupId)?.label ?? groupId;
}

function screenshotFor(resultsPath, defect) {
  return defect.screenshot ? `${resultsPath}/${defect.screenshot}` : "—";
}

function fetchCommands({ prNumber, runNumber, resultsPath }) {
  return [
    "```bash",
    "git fetch origin ui-audit-results",
    `git checkout origin/ui-audit-results -- ${prNumber}/${runNumber}`,
    `open ${prNumber}/${runNumber}/summary.md   # macOS; xdg-open on Linux`,
    `open ${prNumber}/${runNumber}/shots        # all JPEGs for this run`,
    "```",
  ].join("\n");
}

export function buildSummaryMarkdown(summary, options = {}) {
  const defects = Array.isArray(summary.defects) ? summary.defects : [];
  const groups = Array.isArray(summary.groups) ? summary.groups : [];
  const counts = defectCounts(defects);
  const groupCount = new Map(counts.byGroup.map((entry) => [entry.id, entry.count]));
  const widthCount = new Map(counts.byWidth.map((entry) => [String(entry.width), entry.count]));
  const top = [...defects]
    .sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9) || defectKey(a).localeCompare(defectKey(b)))
    .slice(0, 40);

  const lines = [];
  lines.push(`# UI audit — ${summary.branch ?? "unknown branch"}`);
  lines.push("");
  const themeCount = summary.themes?.length ?? 2;
  lines.push(
    `**${summary.totals?.defects ?? defects.length} defects** across ${summary.totals?.routeStates ?? summary.routes?.length ?? 0} route states, ${summary.widths?.length ?? 0} widths and ${themeCount === 1 ? "one theme" : "both themes"}. ` +
      `Run took ${formatDuration(summary.durationMs)}.`,
  );
  lines.push("");
  lines.push(`- Run: [#${summary.runNumber ?? options.runNumber ?? "?"}](${options.runUrl ?? summary.runUrl ?? "#"})`);
  lines.push(`- Commit: \`${String(summary.commit ?? "unknown").slice(0, 12)}\``);
  lines.push(`- Results: \`${options.resultsPath ?? `${summary.prNumber}/${summary.runNumber}`}\` on \`ui-audit-results\``);
  lines.push(`- Images: ${summary.totals?.screenshots ?? summary.screenshots?.length ?? 0} JPEGs (max 60 per run)`);
  if (options.previous) {
    const delta = diffDefectSets(defects, options.previous.defects ?? []);
    lines.push(
      `- Change vs previous run: **${delta.added} new**, **${delta.fixed} fixed** (previously ${delta.previous}).`,
    );
  } else {
    lines.push("- Change vs previous run: this is the first recorded run for this PR.");
  }
  lines.push("");

  lines.push("## Defects by route group");
  lines.push("");
  lines.push("| Route group | Route states | Defects |");
  lines.push("| --- | ---: | ---: |");
  for (const group of groups) {
    const routes = summary.routes?.filter((route) => route.group === group.id).length ?? group.routes ?? 0;
    lines.push(`| ${escapeTableCell(group.label)} | ${routes} | ${groupCount.get(group.id) ?? 0} |`);
  }
  lines.push("");

  lines.push("## Defects by width");
  lines.push("");
  lines.push("| Width | Defects |");
  lines.push("| ---: | ---: |");
  for (const width of summary.widths ?? []) {
    lines.push(`| ${width}px | ${widthCount.get(String(width)) ?? 0} |`);
  }
  lines.push("");

  lines.push("## Top 40 defects");
  lines.push("");
  if (top.length === 0) {
    lines.push("No defects detected in this run.");
  } else {
    lines.push("| Route | State | Width | Theme | Rule | Selector / value | Screenshot |");
    lines.push("| --- | --- | ---: | --- | --- | --- | --- |");
    for (const defect of top) {
      const measured = defect.value ? `${defect.selector} — ${defect.value}` : defect.selector;
      const shot = screenshotFor(options.resultsPath ?? `${summary.prNumber}/${summary.runNumber}`, defect);
      lines.push(
        `| \`${escapeTableCell(defect.route)}\` | ${escapeTableCell(defect.state ?? "default")} | ${defect.width} | ${defect.theme} | ${escapeTableCell(ruleLabel(defect.rule))} | \`${escapeTableCell(measured)}\` | ${shot === "—" ? "—" : `\`${escapeTableCell(shot)}\``} |`,
      );
    }
    if (defects.length > top.length) lines.push("");
    if (defects.length > top.length) lines.push(`_${defects.length - top.length} more defects are in \`summary.json\`._`);
  }
  lines.push("");

  lines.push("## Fetch the screenshots");
  lines.push("");
  lines.push(
    fetchCommands({
      prNumber: summary.prNumber ?? options.prNumber,
      runNumber: summary.runNumber ?? options.runNumber,
      resultsPath: options.resultsPath ?? `${summary.prNumber}/${summary.runNumber}`,
    }),
  );
  lines.push("");
  lines.push(
    "_Informational run: defects do not fail the PR unless the repository variable `UI_AUDIT_STRICT` is `true`. Infrastructure failures still fail the workflow._",
  );
  return lines.join("\n");
}

export function buildComment({ summary, previous, prNumber, runNumber, branch, runUrl, resultsPath }) {
  const enriched = {
    ...summary,
    prNumber: prNumber ?? summary.prNumber,
    runNumber: runNumber ?? summary.runNumber,
    branch: branch ?? summary.branch,
    runUrl: runUrl ?? summary.runUrl,
  };
  const body = [
    UI_AUDIT_MARKER,
    `## Konnekt UI audit`,
    "",
    `<sub>Sticky comment · updated for run #${enriched.runNumber} · ${branch ?? enriched.branch ?? ""}</sub>`,
    "",
    buildSummaryMarkdown(enriched, {
      previous,
      prNumber: enriched.prNumber,
      runNumber: enriched.runNumber,
      runUrl: enriched.runUrl,
      resultsPath: resultsPath ?? `${enriched.prNumber}/${enriched.runNumber}`,
    }),
  ].join("\n");
  if (body.length <= UI_AUDIT_MAX_COMMENT_CHARS) return body;
  const suffix = "\n\n_Comment truncated to fit GitHub's size limit. Read summary.md on `ui-audit-results` for the full report._";
  return `${body.slice(0, UI_AUDIT_MAX_COMMENT_CHARS - suffix.length)}${suffix}`;
}

export function resolveResultsPath(prNumber, runNumber) {
  return path.posix.join(String(prNumber), String(runNumber));
}

export function resultFileNames(routeId, width, theme) {
  return {
    screenshot: `shots/${routeId}-${width}-${theme}.jpg`,
    summaryJson: "summary.json",
    summaryMarkdown: "summary.md",
  };
}

export function assertRunSize(bytes, limit = UI_AUDIT_MAX_BYTES) {
  if (bytes > limit) {
    throw new Error(`ui-audit-results would be ${(bytes / 1024 / 1024).toFixed(1)} MB, over the ${(limit / 1024 / 1024).toFixed(0)} MB limit`);
  }
  return bytes;
}

export function pageIdFromPath(pathValue) {
  return String(pathValue)
    .replace(/^https?:\/\/[^/]+/, "")
    .replace(/^\//, "")
    .replace(/[?#].*$/, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "root";
}
