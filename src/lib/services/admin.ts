import "server-only";
import type { AcademicNodeType, DecisionReason, Role, UserStatus, VerificationMethod } from "@prisma/client";
import { tenantDb, withTenantTransaction } from "@/lib/db/tenant";
import { platformDb } from "@/lib/db/platform";
import { assertUserTransition } from "@/lib/domain/status";
import { revokeAllSessions } from "@/lib/auth/session";
import { randomToken, sha256 } from "@/lib/crypto";
import { sendUniversityInvite } from "@/lib/email";
import { env } from "@/lib/env";
import { writeAudit } from "@/lib/audit";
import { parseLabels, type LayerLabels } from "./universities";
import { slugifyNodeName } from "@/lib/domain/slug";
import type { CsvRow } from "@/lib/domain/academic-csv";

export const PAGE_SIZE = 20;

function pageArgs(page: number) {
  const safe = Math.max(1, Math.min(10_000, Math.trunc(page) || 1));
  return { skip: (safe - 1) * PAGE_SIZE, take: PAGE_SIZE, page: safe };
}

/* ------------------------------- Overview ------------------------------- */

export async function getAdminOverview(universityId: string) {
  const db = tenantDb(universityId);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [verified, pending, newThisWeek, alumni, reviewers, departments] = await Promise.all([
    db.user.count({ where: { status: "VERIFIED" } }),
    db.verificationRequest.count({ where: { status: "PENDING" } }),
    db.user.count({ where: { status: "VERIFIED", verifiedAt: { gte: weekAgo } } }),
    db.user.count({ where: { status: "ALUMNI" } }),
    db.roleAssignment.count({ where: { role: { in: ["REVIEWER", "UNIVERSITY_ADMIN"] } } }),
    db.academicNode.count({ where: { type: "DEPARTMENT" } }),
  ]);
  return { verified, pending, newThisWeek, alumni, reviewers, departments };
}

/* --------------------------- Verification queue -------------------------- */

export interface QueueFilters {
  status?: "PENDING" | "APPROVED" | "REJECTED" | "ALL";
  method?: VerificationMethod | "ALL";
  q?: string;
  page: number;
}

export async function listVerificationQueue(universityId: string, filters: QueueFilters) {
  const db = tenantDb(universityId);
  const { skip, take, page } = pageArgs(filters.page);
  const where = {
    ...(filters.status && filters.status !== "ALL" ? { status: filters.status } : {}),
    ...(filters.method && filters.method !== "ALL" ? { method: filters.method } : {}),
    ...(filters.q?.trim()
      ? {
          OR: [
            { user: { fullName: { contains: filters.q.trim(), mode: "insensitive" as const } } },
            { user: { username: { contains: filters.q.trim(), mode: "insensitive" as const } } },
            { matricNumber: { contains: filters.q.trim(), mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    db.verificationRequest.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      skip,
      take,
      select: {
        id: true,
        method: true,
        status: true,
        matricNumber: true,
        createdAt: true,
        decidedAt: true,
        decisionReason: true,
        idImageRef: true,
        user: {
          select: { id: true, fullName: true, username: true, photoUrl: true, email: true, status: true },
        },
        reviewer: { select: { fullName: true } },
      },
    }),
    db.verificationRequest.count({ where }),
  ]);
  return { rows, total, page, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function getVerificationDetail(universityId: string, requestId: string) {
  const db = tenantDb(universityId);
  const request = await db.verificationRequest.findFirst({
    where: { id: requestId },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          username: true,
          email: true,
          photoUrl: true,
          status: true,
          matricNumber: true,
          createdAt: true,
          departmentNodeId: true,
          level: true,
        },
      },
      voucher: { select: { id: true, fullName: true, username: true } },
      reviewer: { select: { id: true, fullName: true } },
    },
  });
  if (!request) return null;

  const university = await platformDb.university.findUnique({
    where: { id: universityId },
    select: { matricPattern: true, labels: true },
  });
  const department = request.user.departmentNodeId
    ? await db.academicNode.findFirst({
        where: { id: request.user.departmentNodeId },
        select: { name: true, type: true },
      })
    : null;
  const priorDecision = await db.verificationRequest.findFirst({
    where: { userId: request.userId, id: { not: request.id }, status: { in: ["APPROVED", "REJECTED"] } },
    orderBy: { decidedAt: "desc" },
    select: { status: true, decisionReason: true, decidedAt: true },
  });
  const duplicateMatric = await db.user.findFirst({
    where: {
      status: "VERIFIED",
      matricNormalized: request.matricNormalized,
      id: { not: request.userId },
    },
    select: { fullName: true, username: true },
  });

  return {
    request,
    labels: parseLabels(university?.labels),
    matricPattern: university?.matricPattern ?? "",
    department,
    priorDecision,
    duplicateMatric,
  };
}

/* -------------------------------- Students ------------------------------- */

export async function listStudents(
  universityId: string,
  filters: { q?: string; status?: UserStatus | "ALL"; page: number },
) {
  const db = tenantDb(universityId);
  const { skip, take, page } = pageArgs(filters.page);
  const where = {
    ...(filters.status && filters.status !== "ALL" ? { status: filters.status } : {}),
    ...(filters.q?.trim()
      ? {
          OR: [
            { fullName: { contains: filters.q.trim(), mode: "insensitive" as const } },
            { username: { contains: filters.q.trim(), mode: "insensitive" as const } },
            { email: { contains: filters.q.trim(), mode: "insensitive" as const } },
            { matricNumber: { contains: filters.q.trim(), mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      skip,
      take,
      select: {
        id: true,
        fullName: true,
        username: true,
        email: true,
        photoUrl: true,
        status: true,
        matricNumber: true,
        level: true,
        createdAt: true,
        verifiedAt: true,
        departmentNodeId: true,
        roles: { select: { role: true } },
      },
    }),
    db.user.count({ where }),
  ]);

  const departments = await db.academicNode.findMany({
    where: { type: "DEPARTMENT" },
    select: { id: true, name: true },
  });
  const departmentNames = new Map(departments.map((node) => [node.id, node.name]));
  return {
    rows: rows.map((row) => ({
      ...row,
      departmentName: row.departmentNodeId ? (departmentNames.get(row.departmentNodeId) ?? null) : null,
    })),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

export async function getStudentDetail(universityId: string, userId: string) {
  const db = tenantDb(universityId);
  const student = await db.user.findFirst({
    where: { id: userId },
    select: {
      id: true,
      fullName: true,
      username: true,
      email: true,
      photoUrl: true,
      bio: true,
      status: true,
      matricNumber: true,
      level: true,
      isPostgraduate: true,
      createdAt: true,
      verifiedAt: true,
      lastActiveAt: true,
      departmentNodeId: true,
      roles: { select: { id: true, role: true } },
      verificationRequests: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, method: true, status: true, createdAt: true, decidedAt: true, decisionReason: true },
      },
    },
  });
  if (!student) return null;
  const department = student.departmentNodeId
    ? await db.academicNode.findFirst({ where: { id: student.departmentNodeId }, select: { name: true } })
    : null;
  const lastAudit = await db.auditLog.findFirst({
    where: { targetId: userId, action: { in: ["student.suspended", "student.reinstated", "student.marked_alumni"] } },
    orderBy: { createdAt: "desc" },
    select: { action: true, metadata: true, createdAt: true },
  });
  return { student, departmentName: department?.name ?? null, lastAudit };
}

export interface StudentStatusResult {
  ok: boolean;
  error?: string;
}

/** Admin status changes: suspend, reinstate, mark alumni. Audited, sessions revoked. */
export async function setStudentStatus(input: {
  actorId: string;
  universityId: string;
  userId: string;
  target: "SUSPENDED" | "VERIFIED" | "ALUMNI";
  reason?: string;
}): Promise<StudentStatusResult> {
  if ((input.target === "SUSPENDED" || input.target === "ALUMNI") && !input.reason?.trim()) {
    return { ok: false, error: "Add a short reason. The student sees it." };
  }
  const db = tenantDb(input.universityId);
  const student = await db.user.findFirst({
    where: { id: input.userId },
    select: { id: true, status: true, fullName: true, email: true },
  });
  if (!student) return { ok: false, error: "Student not found." };
  if (student.id === input.actorId) return { ok: false, error: "You cannot change your own status." };

  const from = student.status;
  if (input.target === "SUSPENDED" && !["VERIFIED", "ALUMNI"].includes(from)) {
    return { ok: false, error: "Only verified students or alumni can be suspended." };
  }
  if (input.target === "VERIFIED" && from !== "SUSPENDED") {
    return { ok: false, error: "Only suspended accounts can be reinstated." };
  }
  if (input.target === "ALUMNI" && from !== "VERIFIED") {
    return { ok: false, error: "Only verified students can be marked as alumni." };
  }

  try {
    assertUserTransition(from, input.target);
  } catch {
    return { ok: false, error: "That change is not allowed from the current status." };
  }

  await tenantDb(input.universityId).user.update({
    where: { id: student.id },
    data: { status: input.target },
  });
  if (input.target === "SUSPENDED" || input.target === "ALUMNI") {
    await revokeAllSessions(student.id);
    await platformDb.session.deleteMany({
      where: { userId: student.id, universityId: input.universityId, revokedAt: { not: null } },
    });
  }

  // The reason is part of the audit metadata so the decision is explainable.
  await writeAudit({
    actorId: input.actorId,
    universityId: input.universityId,
    action:
      input.target === "SUSPENDED"
        ? "student.suspended"
        : input.target === "ALUMNI"
          ? "student.marked_alumni"
          : "student.reinstated",
    targetType: "User",
    targetId: student.id,
    metadata: { from, to: input.target, reason: input.reason?.slice(0, 300) ?? null },
  });

  return { ok: true };
}

/* ------------------------------ Academic tree ---------------------------- */

export interface AcademicNodeInput {
  type: AcademicNodeType;
  name: string;
  parentId: string | null;
  levels?: number[];
}

export function isValidNodeType(type: string): type is AcademicNodeType {
  return type === "COLLEGE" || type === "FACULTY" || type === "DEPARTMENT";
}

export async function createAcademicNode(
  input: AcademicNodeInput & { actorId: string; universityId: string },
): Promise<{ ok: boolean; error?: string }> {
  const db = tenantDb(input.universityId);
  const name = input.name.trim();
  if (name.length < 2) return { ok: false, error: "Give the node a name." };
  if (input.type === "DEPARTMENT" && (!input.levels || input.levels.length === 0)) {
    return { ok: false, error: "Pick at least one level for a department." };
  }
  let path = "";
  if (input.parentId) {
    const parent = await db.academicNode.findFirst({
      where: { id: input.parentId },
      select: { id: true, path: true, type: true },
    });
    if (!parent) return { ok: false, error: "Parent not found." };
    const allowedParent =
      input.type === "FACULTY" ? ["COLLEGE"] : input.type === "DEPARTMENT" ? ["FACULTY"] : [];
    if (!allowedParent.includes(parent.type)) {
      return { ok: false, error: `A ${input.type.toLowerCase()} cannot sit under a ${parent.type.toLowerCase()}.` };
    }
    path = parent.path ? `${parent.path}/${parent.id}` : parent.id;
  } else if (input.type === "DEPARTMENT") {
    return { ok: false, error: "Choose a faculty for this department." };
  }

  const slug = slugifyNodeName(name);
  if (!slug) return { ok: false, error: "That name cannot be used as a URL slug." };
  const existing = await db.academicNode.findFirst({
    where: { parentId: input.parentId, slug },
    select: { id: true },
  });
  if (existing) return { ok: false, error: "A node with that name already exists here." };

  const last = await db.academicNode.findFirst({
    where: { parentId: input.parentId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const node = await db.academicNode.create({
    data: {
      universityId: input.universityId,
      type: input.type,
      name,
      parentId: input.parentId,
      path,
      parentPath: path,
      slug,
      sortOrder: (last?.sortOrder ?? 0) + 1,
      levels: input.type === "DEPARTMENT" ? [...new Set(input.levels ?? [])].sort((a, b) => a - b) : [],
    },
  });

  await writeAudit({
    actorId: input.actorId,
    universityId: input.universityId,
    action: "academic.node_created",
    targetType: "AcademicNode",
    targetId: node.id,
    metadata: { type: node.type, name: node.name, parentId: node.parentId },
  });
  return { ok: true };
}

export async function updateAcademicNode(input: {
  actorId: string;
  universityId: string;
  nodeId: string;
  name?: string;
  levels?: number[];
  isActive?: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const db = tenantDb(input.universityId);
  const node = await db.academicNode.findFirst({
    where: { id: input.nodeId },
    select: { id: true, type: true, name: true, isActive: true, levels: true },
  });
  if (!node) return { ok: false, error: "Node not found." };

  const data: { name?: string; levels?: number[]; isActive?: boolean; slug?: string } = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (name.length < 2) return { ok: false, error: "Give the node a name." };
    data.name = name;
    data.slug = slugifyNodeName(name);
  }
  if (input.levels !== undefined) {
    if (node.type !== "DEPARTMENT") return { ok: false, error: "Only departments have levels." };
    const levels = [...new Set(input.levels)].sort((a, b) => a - b);
    if (levels.length === 0) return { ok: false, error: "Pick at least one level." };
    data.levels = levels;
  }
  if (input.isActive !== undefined) data.isActive = input.isActive;

  if (Object.keys(data).length === 0) return { ok: true };

  await db.academicNode.update({ where: { id: node.id }, data });
  await writeAudit({
    actorId: input.actorId,
    universityId: input.universityId,
    action: input.isActive === false ? "academic.node_deactivated" : "academic.node_updated",
    targetType: "AcademicNode",
    targetId: node.id,
    metadata: { name: data.name ?? node.name, isActive: data.isActive ?? node.isActive },
  });
  return { ok: true };
}

export async function moveAcademicNode(input: {
  actorId: string;
  universityId: string;
  nodeId: string;
  direction: "up" | "down";
}): Promise<{ ok: boolean; error?: string }> {
  const db = tenantDb(input.universityId);
  const node = await db.academicNode.findFirst({
    where: { id: input.nodeId },
    select: { id: true, parentId: true, sortOrder: true },
  });
  if (!node) return { ok: false, error: "Node not found." };
  const neighbour = await db.academicNode.findFirst({
    where: {
      parentId: node.parentId,
      sortOrder: input.direction === "up" ? { lt: node.sortOrder } : { gt: node.sortOrder },
    },
    orderBy: { sortOrder: input.direction === "up" ? "desc" : "asc" },
    select: { id: true, sortOrder: true },
  });
  if (!neighbour) return { ok: true };
  await withTenantTransaction(input.universityId, async (tx) => {
    await tx.academicNode.update({ where: { id: node.id }, data: { sortOrder: neighbour.sortOrder } });
    await tx.academicNode.update({ where: { id: neighbour.id }, data: { sortOrder: node.sortOrder } });
  });
  await writeAudit({
    actorId: input.actorId,
    universityId: input.universityId,
    action: "academic.node_reordered",
    targetType: "AcademicNode",
    targetId: node.id,
    metadata: { direction: input.direction },
  });
  return { ok: true };
}

export async function deleteAcademicNode(input: {
  actorId: string;
  universityId: string;
  nodeId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const db = tenantDb(input.universityId);
  const node = await db.academicNode.findFirst({
    where: { id: input.nodeId },
    select: { id: true, name: true, type: true },
  });
  if (!node) return { ok: false, error: "Node not found." };
  const [children, students] = await Promise.all([
    db.academicNode.count({ where: { parentId: node.id } }),
    db.user.count({ where: { departmentNodeId: node.id } }),
  ]);
  if (children > 0) return { ok: false, error: "Remove or move the children first." };
  if (students > 0) {
    return { ok: false, error: "Students are assigned here. Deactivate it instead of deleting." };
  }
  await db.academicNode.delete({ where: { id: node.id } });
  await writeAudit({
    actorId: input.actorId,
    universityId: input.universityId,
    action: "academic.node_deleted",
    targetType: "AcademicNode",
    targetId: node.id,
    metadata: { type: node.type, name: node.name },
  });
  return { ok: true };
}

/* ------------------------------- CSV import ------------------------------ */

export { parseAcademicCsv } from "@/lib/domain/academic-csv";
export { slugifyNodeName } from "@/lib/domain/slug";
export type { CsvPreview, CsvRow } from "@/lib/domain/academic-csv";

export async function applyAcademicCsv(input: {
  actorId: string;
  universityId: string;
  rows: CsvRow[];
}): Promise<{ ok: boolean; created: number; error?: string }> {
  const db = tenantDb(input.universityId);
  const roots = await db.academicNode.findMany({
    where: { parentId: null },
    select: { id: true, type: true, name: true, path: true },
  });
  let created = 0;

  for (const row of input.rows.filter((entry) => entry.action !== "error")) {
    let facultyId: string | null = null;
    const facultyName = row.faculty || "General";
    let faculty = await db.academicNode.findFirst({
      where: { type: "FACULTY", name: { equals: facultyName, mode: "insensitive" } },
      select: { id: true },
    });
    if (!faculty) {
      const slug = slugifyNodeName(facultyName) || "general";
      const existingSlug = await db.academicNode.findFirst({ where: { parentId: null, slug } });
      faculty = await db.academicNode.create({
        data: {
          universityId: input.universityId,
          type: "FACULTY",
          name: facultyName,
          slug: existingSlug ? `${slug}-${Date.now().toString(36).slice(-4)}` : slug,
          path: "",
          parentPath: "",
          sortOrder: roots.length + created + 1,
          levels: [],
        },
        select: { id: true },
      });
      created += 1;
    }
    facultyId = faculty.id;

    const slug = slugifyNodeName(row.department) || `department-${Date.now().toString(36)}`;
    const exists = await db.academicNode.findFirst({
      where: { parentId: facultyId, slug },
      select: { id: true },
    });
    if (exists) continue;
    const parentFull = await db.academicNode.findFirst({
      where: { id: facultyId },
      select: { path: true, id: true },
    });
    const path = parentFull?.path ? `${parentFull.path}/${facultyId}` : facultyId;
    await db.academicNode.create({
      data: {
        universityId: input.universityId,
        type: "DEPARTMENT",
        name: row.department,
        parentId: facultyId,
        path,
        parentPath: path,
        slug,
        sortOrder: created + 1,
        levels: row.levels,
      },
    });
    created += 1;
  }

  await writeAudit({
    actorId: input.actorId,
    universityId: input.universityId,
    action: "academic.csv_imported",
    targetType: "University",
    targetId: input.universityId,
    metadata: { rows: input.rows.length, created },
  });
  return { ok: true, created };
}

/* --------------------------------- Team ---------------------------------- */

const INVITABLE_ROLES: Role[] = ["UNIVERSITY_ADMIN", "REVIEWER", "MODERATOR", "OFFICIAL"];

export async function listTeam(universityId: string) {
  const db = tenantDb(universityId);
  const [members, pendingInvites] = await Promise.all([
    db.roleAssignment.findMany({
      where: { role: { in: INVITABLE_ROLES } },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        role: true,
        createdAt: true,
        user: { select: { id: true, fullName: true, username: true, email: true, photoUrl: true } },
      },
    }),
    db.roleInvite.findMany({
      where: { acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: { id: true, email: true, role: true, createdAt: true, expiresAt: true },
    }),
  ]);
  return { members, pendingInvites };
}

export async function inviteRole(input: {
  actorId: string;
  universityId: string;
  email: string;
  role: Role;
}): Promise<{ ok: boolean; error?: string }> {
  if (!INVITABLE_ROLES.includes(input.role)) return { ok: false, error: "That role cannot be invited." };
  const email = input.email.trim().toLowerCase();
  const university = await platformDb.university.findUnique({
    where: { id: input.universityId },
    select: { name: true, shortName: true, slug: true },
  });
  if (!university) return { ok: false, error: "University not found." };

  const pending = await tenantDb(input.universityId).roleInvite.findFirst({
    where: { email, role: input.role, acceptedAt: null, expiresAt: { gt: new Date() } },
    select: { id: true },
  });
  if (pending) return { ok: false, error: "An invitation is already pending for that email and role." };

  const token = randomToken(32);
  await tenantDb(input.universityId).roleInvite.create({
    data: {
      email,
      role: input.role,
      universityId: input.universityId,
      tokenHash: sha256(token),
      invitedBy: input.actorId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
  await sendUniversityInvite(email, {
    universityName: university.name,
    roleLabel: input.role.replaceAll("_", " ").toLowerCase(),
    url: `${env.APP_URL}/invite/${token}`,
  });
  await writeAudit({
    actorId: input.actorId,
    universityId: input.universityId,
    action: "team.invited",
    targetType: "RoleInvite",
    targetId: email,
    metadata: { role: input.role },
  });
  return { ok: true };
}

export async function acceptRoleInvite(input: {
  token: string;
  userId: string;
  userEmail: string;
}): Promise<{ ok: boolean; error?: string; universityId?: string | null }> {
  const invite = await platformDb.roleInvite.findUnique({
    where: { tokenHash: sha256(input.token) },
    select: { id: true, email: true, role: true, universityId: true, expiresAt: true, acceptedAt: true },
  });
  if (!invite) return { ok: false, error: "This invitation link is not valid." };
  if (invite.acceptedAt) return { ok: false, error: "This invitation was already accepted." };
  if (invite.expiresAt < new Date()) return { ok: false, error: "This invitation has expired. Ask for a new one." };
  if (invite.email.toLowerCase() !== input.userEmail.toLowerCase()) {
    return { ok: false, error: "Sign in with the email address this invitation was sent to." };
  }

  const existing = await platformDb.roleAssignment.findFirst({
    where: { userId: input.userId, role: invite.role, universityId: invite.universityId },
    select: { id: true },
  });
  if (!existing) {
    await platformDb.roleAssignment.create({
      data: {
        userId: input.userId,
        universityId: invite.universityId,
        role: invite.role,
        grantedBy: null,
      },
    });
  }
  await platformDb.roleInvite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });
  await writeAudit({
    actorId: input.userId,
    universityId: invite.universityId,
    action: "team.invite_accepted",
    targetType: "RoleInvite",
    targetId: invite.id,
    metadata: { role: invite.role },
  });
  return { ok: true, universityId: invite.universityId };
}

export async function revokeRole(input: {
  actorId: string;
  universityId: string;
  assignmentId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const assignment = await platformDb.roleAssignment.findFirst({
    where: { id: input.assignmentId, universityId: input.universityId },
    select: { id: true, userId: true, role: true },
  });
  if (!assignment) return { ok: false, error: "Role not found." };
  if (assignment.userId === input.actorId) {
    return { ok: false, error: "Ask another admin to remove your own role." };
  }
  if (assignment.role === "UNIVERSITY_ADMIN") {
    const admins = await platformDb.roleAssignment.count({
      where: { universityId: input.universityId, role: "UNIVERSITY_ADMIN" },
    });
    if (admins <= 1) return { ok: false, error: "A university needs at least one admin." };
  }
  await platformDb.roleAssignment.delete({ where: { id: assignment.id } });
  await platformDb.session.deleteMany({ where: { userId: assignment.userId, universityId: input.universityId } });
  await writeAudit({
    actorId: input.actorId,
    universityId: input.universityId,
    action: "team.role_removed",
    targetType: "User",
    targetId: assignment.userId,
    metadata: { role: assignment.role },
  });
  return { ok: true };
}

export async function cancelInvite(input: {
  actorId: string;
  universityId: string;
  inviteId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const result = await tenantDb(input.universityId).roleInvite.deleteMany({
    where: { id: input.inviteId, acceptedAt: null },
  });
  if (result.count !== 1) return { ok: false, error: "Invitation not found." };
  await writeAudit({
    actorId: input.actorId,
    universityId: input.universityId,
    action: "team.invite_cancelled",
    targetType: "RoleInvite",
    targetId: input.inviteId,
  });
  return { ok: true };
}

/* -------------------------------- Settings ------------------------------- */

export interface UniversitySettings {
  name: string;
  shortName: string;
  accentColor: string;
  logoUrl: string | null;
  studentEmailDomains: string[];
  idCardEnabled: boolean;
  vouchingEnabled: boolean;
  matricPattern: string;
  labels: LayerLabels;
  policyVersion: string;
  slug: string;
}

export async function getUniversitySettings(universityId: string): Promise<UniversitySettings | null> {
  const row = await platformDb.university.findUnique({ where: { id: universityId } });
  if (!row) return null;
  return {
    name: row.name,
    shortName: row.shortName,
    accentColor: row.accentColor,
    logoUrl: row.logoUrl,
    studentEmailDomains: row.studentEmailDomains,
    idCardEnabled: row.idCardEnabled,
    vouchingEnabled: row.vouchingEnabled,
    matricPattern: row.matricPattern,
    labels: parseLabels(row.labels),
    policyVersion: row.policyVersion,
    slug: row.slug,
  };
}

export async function updateUniversitySettings(input: {
  actorId: string;
  universityId: string;
  settings: UniversitySettings;
}): Promise<{ ok: boolean; error?: string }> {
  const university = await platformDb.university.findUnique({
    where: { id: input.universityId },
    select: { status: true, slug: true },
  });
  if (!university) return { ok: false, error: "University not found." };
  if (university.status === "OFF") return { ok: false, error: "This university is switched off." };

  const labels = {
    college: input.settings.labels.college.trim() || "College",
    faculty: input.settings.labels.faculty.trim() || "Faculty",
    department: input.settings.labels.department.trim() || "Department",
  };
  await platformDb.university.update({
    where: { id: input.universityId },
    data: {
      name: input.settings.name.trim(),
      shortName: input.settings.shortName.trim(),
      accentColor: input.settings.accentColor.toLowerCase(),
      logoUrl: input.settings.logoUrl || null,
      studentEmailDomains: input.settings.studentEmailDomains.map((domain) => domain.trim().toLowerCase()).filter(Boolean),
      idCardEnabled: input.settings.idCardEnabled,
      vouchingEnabled: input.settings.vouchingEnabled,
      matricPattern: input.settings.matricPattern,
      labels,
    },
  });
  await writeAudit({
    actorId: input.actorId,
    universityId: input.universityId,
    action: "university.settings_updated",
    targetType: "University",
    targetId: input.universityId,
    metadata: {
      accentColor: input.settings.accentColor,
      idCardEnabled: input.settings.idCardEnabled,
      vouchingEnabled: input.settings.vouchingEnabled,
      domains: input.settings.studentEmailDomains.length,
    },
  });
  return { ok: true };
}

/** Accept/decline a decision is in verification.ts; re-export reason type labels. */
export type { DecisionReason, UserStatus };
