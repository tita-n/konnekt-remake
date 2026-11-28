export interface AuditDefect {
  route: string;
  state?: string;
  group?: string;
  width: number;
  theme: string;
  rule: string;
  selector: string;
  value?: string;
  severity?: "high" | "medium" | "low";
  screenshot?: string;
}

export interface AuditSummary {
  prNumber?: number;
  runNumber?: number;
  branch?: string;
  commit?: string;
  runUrl?: string;
  durationMs?: number;
  widths?: number[];
  themes?: string[];
  groups?: Array<{ id: string; label: string }>;
  routes?: Array<{ id: string; group: string; path: string }>;
  defects?: AuditDefect[];
  screenshots?: string[];
  totals?: { routeStates?: number; defects?: number; screenshots?: number };
}

export const UI_AUDIT_MARKER: string;
export const UI_AUDIT_RESULTS_BRANCH: string;
export const UI_AUDIT_KEEP_RUNS: number;
export const UI_AUDIT_MAX_COMMENT_CHARS: number;
export const UI_AUDIT_MAX_BYTES: number;
export function ruleLabel(rule: string): string;
export function defectKey(defect: AuditDefect): string;
export function normalizeRunNumber(value: unknown): number;
export function pruneRuns(
  existingRuns: Array<number | string>,
  currentRun: number | string,
  keep?: number,
): { kept: number[]; removed: number[] };
export function defectCounts(defects: AuditDefect[]): {
  byGroup: Array<{ id: string; count: number }>;
  byWidth: Array<{ width: number; count: number }>;
  byRule: Array<{ rule: string; count: number }>;
};
export function diffDefectSets(
  currentDefects: AuditDefect[],
  previousDefects: AuditDefect[],
): { added: number; fixed: number; previous: number; current: number };
export function escapeTableCell(value: unknown): string;
export function formatDuration(ms: number): string;
export function buildSummaryMarkdown(
  summary: AuditSummary,
  options?: {
    previous?: AuditSummary | null;
    prNumber?: number;
    runNumber?: number;
    runUrl?: string;
    resultsPath?: string;
  },
): string;
export function buildComment(input: {
  summary: AuditSummary;
  previous?: AuditSummary | null;
  prNumber?: number;
  runNumber?: number;
  branch?: string;
  runUrl?: string;
  resultsPath?: string;
}): string;
export function resolveResultsPath(prNumber: number | string, runNumber: number | string): string;
export function resultFileNames(routeId: string, width: number, theme: string): {
  screenshot: string;
  summaryJson: string;
  summaryMarkdown: string;
};
export function assertRunSize(bytes: number, limit?: number): number;
export function pageIdFromPath(pathValue: string): string;
