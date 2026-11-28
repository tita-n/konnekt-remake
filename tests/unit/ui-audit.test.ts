import { describe, expect, it } from "vitest";
import {
  UI_AUDIT_MARKER,
  UI_AUDIT_MAX_COMMENT_CHARS,
  assertRunSize,
  buildComment,
  buildSummaryMarkdown,
  diffDefectSets,
  pruneRuns,
} from "../../scripts/lib/ui-audit.mjs";

const defect = {
  route: "/pulse",
  state: "default",
  group: "pulse",
  width: 320,
  theme: "light",
  rule: "touch-target",
  selector: "button[aria-label='Post']",
  value: "32×32 px, needs 44×44",
  severity: "high" as const,
  screenshot: "shots/pulse-320-light.jpg",
};

const summary = {
  prNumber: 42,
  runNumber: 7,
  branch: "ui/test-audit",
  commit: "abcdef0123456789",
  durationMs: 123_000,
  widths: [320, 390, 1280],
  groups: [
    { id: "pulse", label: "Pulse" },
    { id: "admin", label: "Admin consoles" },
  ],
  routes: [
    { id: "pulse", group: "pulse", path: "/pulse" },
    { id: "admin", group: "admin", path: "/admin" },
  ],
  defects: [defect],
  screenshots: ["shots/pulse-320-light.jpg"],
  totals: { routeStates: 2, defects: 1, screenshots: 1 },
};

describe("UI audit comment", () => {
  it("renders the sticky marker, group counts, defect and fetch commands", () => {
    const body = buildComment({
      summary,
      previous: null,
      prNumber: 42,
      runNumber: 7,
      branch: "ui/test-audit",
      runUrl: "https://example.test/run/7",
      resultsPath: "42/7",
    });
    expect(body.startsWith(UI_AUDIT_MARKER)).toBe(true);
    expect(body).toContain("| Pulse | 1 | 1 |");
    expect(body).toContain("button[aria-label='Post']");
    expect(body).toContain("git fetch origin ui-audit-results");
    expect(body).toContain("git checkout origin/ui-audit-results -- 42/7");
    expect(body).toContain("first recorded run");
  });

  it("reports new and fixed defects against the previous run", () => {
    const body = buildComment({
      summary: { ...summary, defects: [{ ...defect, selector: "button.new" }] },
      previous: { ...summary, defects: [defect] },
      prNumber: 42,
      runNumber: 8,
    });
    expect(body).toContain("**1 new**, **1 fixed**");
  });

  it("stays under GitHub's comment limit", () => {
    const groups = Array.from({ length: 3000 }, (_, index) => ({ id: `group-${index}`, label: `Group ${index}` }));
    const body = buildComment({
      summary: { ...summary, groups, widths: Array.from({ length: 800 }, (_, index) => index + 320) },
      prNumber: 42,
      runNumber: 9,
    });
    expect(body.length).toBeLessThanOrEqual(UI_AUDIT_MAX_COMMENT_CHARS);
    expect(body).toContain("Comment truncated");
  });

  it("uses the expected summary tables", () => {
    const body = buildSummaryMarkdown(summary, { resultsPath: "42/7" });
    expect(body).toContain("## Defects by route group");
    expect(body).toContain("## Defects by width");
    expect(body).toContain("| 320px | 1 |");
    expect(body).toContain("## Top 40 defects");
  });
});

describe("UI audit result pruning", () => {
  it("keeps the last three runs and the current run", () => {
    expect(pruneRuns([1, 2, 3, 4, 5], 5)).toEqual({ kept: [5, 4, 3], removed: [2, 1] });
  });

  it("keeps three runs when the current run is already present", () => {
    expect(pruneRuns(["10", "9", "8", "7"], 10)).toEqual({ kept: [10, 9, 8], removed: [7] });
  });

  it("keeps a current run even when the directory list is stale", () => {
    expect(pruneRuns([2, 1], 3)).toEqual({ kept: [3, 2, 1], removed: [] });
  });

  it("ignores non-numeric directories", () => {
    expect(pruneRuns(["4", "3", "notes", "2", "1"], 4)).toEqual({ kept: [4, 3, 2], removed: [1] });
  });

  it("computes added and fixed defect sets", () => {
    expect(diffDefectSets([{ ...defect, selector: "new" }], [defect])).toEqual({
      added: 1,
      fixed: 1,
      previous: 1,
      current: 1,
    });
  });
});

describe("UI audit size guard", () => {
  it("accepts a branch below 100 MB and rejects one above it", () => {
    expect(assertRunSize(99 * 1024 * 1024)).toBe(99 * 1024 * 1024);
    expect(() => assertRunSize(100 * 1024 * 1024 + 1)).toThrow(/over the 100 MB limit/);
  });
});
