import "server-only";
import type { AcademicNodeType } from "@prisma/client";
import { buildStudentPath, type StudentPath } from "@/lib/domain/academic";

export interface AcademicPathRow {
  id: string;
  path: string | null;
  type: AcademicNodeType;
}

export interface PathWithNames {
  id: string;
  name: string;
  type: AcademicNodeType;
  parentId: string | null;
}

/**
 * Build the canonical path [universityId, collegeId?, facultyId?, departmentId, level]
 * from a department row's materialized ancestor path.
 */
export function academicStudentPath(universityId: string, department: AcademicPathRow, level: number): StudentPath {
  const ancestors = (department.path ?? "").split("/").filter(Boolean);
  return [...[universityId, ...ancestors, department.id], level];
}

/**
 * Resolve a user's academic lineage (for display and audience paths) from the
 * full node list without extra queries per ancestor.
 */
export function lineageFor(
  nodes: PathWithNames[],
  departmentId: string,
): { college: PathWithNames | null; faculty: PathWithNames | null; department: PathWithNames | null } {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const department = byId.get(departmentId) ?? null;
  if (!department) return { college: null, faculty: null, department: null };
  const ancestorIds = new Set<string>();
  let current = department;
  const guard = new Set<string>();
  while (current.parentId && !guard.has(current.parentId)) {
    guard.add(current.parentId);
    const parent = byId.get(current.parentId);
    if (!parent) break;
    ancestorIds.add(parent.id);
    current = parent;
  }
  const college = nodes.find((node) => ancestorIds.has(node.id) && node.type === "COLLEGE") ?? null;
  const faculty = nodes.find((node) => ancestorIds.has(node.id) && node.type === "FACULTY") ?? null;
  return { college, faculty, department };
}

/** Sanity check used in tests and onboarding: level belongs to the department. */
export function levelBelongsToDepartment(levels: number[], level: number): boolean {
  return levels.includes(level);
}

export { buildStudentPath };
