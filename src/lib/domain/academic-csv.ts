/** Shared CSV parsing for the academic tree importer (browser + server). */
import type { AcademicNodeType } from "@prisma/client";

export interface CsvRow {
  line: number;
  college: string;
  faculty: string;
  department: string;
  levels: number[];
  action: "create" | "exists" | "error";
  message?: string;
}

export interface CsvPreview {
  rows: CsvRow[];
  valid: boolean;
  error?: string;
}

const LEVELS = [100, 200, 300, 400, 500, 600, 700, 800, 900];

/**
 * Expected columns: college, faculty, department, levels.
 * Levels are separated with semicolons (commas are the CSV delimiter), e.g.
 * "100;200;300;400". A header row is optional.
 */
export function parseAcademicCsv(
  csv: string,
  existing: Array<{ name: string; type: AcademicNodeType; parentId: string | null }>,
): CsvPreview {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return { rows: [], valid: false, error: "Paste or upload a CSV first." };
  if (lines.length > 500) return { rows: [], valid: false, error: "Import at most 500 rows at a time." };

  const headerCells = lines[0]!.toLowerCase().split(",").map((cell) => cell.trim());
  const hasHeader = headerCells.includes("department") && (headerCells.includes("faculty") || headerCells.includes("college"));
  const body = hasHeader ? lines.slice(1) : lines;
  if (body.length === 0) return { rows: [], valid: false, error: "The file has a header but no rows." };

  const seen = new Set<string>();
  const rows: CsvRow[] = body.map((line, index) => {
    const cells = line.split(",").map((cell) => cell.trim());
    const [college = "", faculty = "", department = "", levelCell = ""] = cells;
    const base = {
      line: index + (hasHeader ? 2 : 1),
      college,
      faculty,
      department,
      levels: [] as number[],
    };
    if (!department) return { ...base, action: "error" as const, message: "Department is required." };
    const levels = levelCell
      ? levelCell
          .split(/[;/\s]+/)
          .map((value) => Number.parseInt(value, 10))
          .filter((value) => LEVELS.includes(value))
      : [100, 200, 300, 400];
    if (levels.length === 0) {
      return { ...base, action: "error" as const, message: "Levels must look like 100;200;300." };
    }
    const key = `${college}|${faculty}|${department}`.toLowerCase();
    if (seen.has(key)) {
      return { ...base, levels, action: "error" as const, message: "Duplicate row in this file." };
    }
    seen.add(key);
    const departmentExists = existing.some(
      (node) => node.type === "DEPARTMENT" && node.name.toLowerCase() === department.toLowerCase(),
    );
    if (departmentExists) return { ...base, levels, action: "exists" as const };
    return { ...base, levels, action: "create" as const };
  });

  const valid = rows.every((row) => row.action !== "error");
  return { rows, valid };
}
