import "server-only";
import type { AcademicNode, AcademicNodeType } from "@prisma/client";
import { tenantDb } from "@/lib/db/tenant";
import { type LayerLabels, parseLabels } from "./universities";

export type TreeNode = Pick<
  AcademicNode,
  "id" | "parentId" | "type" | "name" | "slug" | "path" | "sortOrder" | "isActive" | "levels"
>;

export interface DepartmentChoice {
  id: string;
  name: string;
  levels: number[];
  lineage: Array<{ id: string; name: string; type: AcademicNodeType }>;
}

export async function listAcademicNodes(universityId: string): Promise<TreeNode[]> {
  const db = tenantDb(universityId);
  return db.academicNode.findMany({
    orderBy: [{ path: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      parentId: true,
      type: true,
      name: true,
      slug: true,
      path: true,
      sortOrder: true,
      isActive: true,
      levels: true,
    },
  });
}

/**
 * Flat department choices for onboarding, with their ancestor chain resolved
 * from the materialized path. Only active departments in active parents are
 * offered, so a deactivated faculty disappears from the picker.
 */
export async function listDepartmentChoices(universityId: string): Promise<DepartmentChoice[]> {
  const nodes = await listAcademicNodes(universityId);
  return departmentChoicesFromNodes(nodes);
}

export function departmentChoicesFromNodes(nodes: TreeNode[]): DepartmentChoice[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const isUsable = (node: TreeNode): boolean => {
    if (!node.isActive) return false;
    const ancestors = node.path.split("/").filter(Boolean);
    return ancestors.every((id) => byId.get(id)?.isActive !== false);
  };

  return nodes
    .filter((node) => node.type === "DEPARTMENT" && isUsable(node))
    .map((node) => ({
      id: node.id,
      name: node.name,
      levels: [...node.levels].sort((a, b) => a - b),
      lineage: node.path
        .split("/")
        .filter(Boolean)
        .map((id) => byId.get(id))
        .filter((ancestor): ancestor is TreeNode => Boolean(ancestor))
        .map((ancestor) => ({ id: ancestor.id, name: ancestor.name, type: ancestor.type })),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export interface ResolvedStudentAcademic {
  department: DepartmentChoice;
  college: { id: string; name: string } | null;
  faculty: { id: string; name: string } | null;
  labels: LayerLabels;
}

export async function resolveStudentAcademic(
  universityId: string,
  departmentId: string,
  labelsValue: unknown,
): Promise<ResolvedStudentAcademic | null> {
  const choices = await listDepartmentChoices(universityId);
  const department = choices.find((choice) => choice.id === departmentId);
  if (!department) return null;
  const college = department.lineage.find((node) => node.type === "COLLEGE");
  const faculty = department.lineage.find((node) => node.type === "FACULTY");
  return {
    department,
    college: college ? { id: college.id, name: college.name } : null,
    faculty: faculty ? { id: faculty.id, name: faculty.name } : null,
    labels: parseLabels(labelsValue),
  };
}

export type TreeNodeWithChildren = TreeNode & { children: TreeNodeWithChildren[] };

export function buildNodeTree(nodes: TreeNode[]): TreeNodeWithChildren[] {
  const roots: TreeNodeWithChildren[] = [];
  const map = new Map<string, TreeNodeWithChildren>();
  for (const node of nodes) map.set(node.id, { ...node, children: [] });
  for (const node of map.values()) {
    const parent = node.parentId ? map.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  const sort = (list: TreeNodeWithChildren[]) => {
    list.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    list.forEach((node) => sort(node.children));
  };
  sort(roots);
  return roots;
}

/** All descendant ids of a node, for guarded move/delete operations. */
export function descendantIds(nodes: TreeNode[], nodeId: string): string[] {
  const result: string[] = [];
  const walk = (parentId: string) => {
    for (const node of nodes) {
      if (node.parentId === parentId) {
        result.push(node.id);
        walk(node.id);
      }
    }
  };
  walk(nodeId);
  return result;
}

export function isValidLevelHierarchy(type: AcademicNodeType, parentType: AcademicNodeType | null): boolean {
  if (type === "COLLEGE") return parentType === null;
  if (type === "FACULTY") return parentType === null || parentType === "COLLEGE";
  return parentType === null || parentType === "FACULTY";
}
