import "server-only";
import type { UserStatus, Visibility } from "@prisma/client";
import { tenantDb } from "@/lib/db/tenant";
import { listAcademicNodes } from "./academic";
import { lineageFor } from "./student-path";

export interface ProfileView {
  id: string;
  username: string;
  fullName: string;
  photoUrl: string | null;
  bio: string | null;
  status: UserStatus;
  isPostgraduate: boolean;
  interests: string[];
  createdAt: Date;
  level: number | null;
  departmentName: string | null;
  facultyName: string | null;
  collegeName: string | null;
  departmentVisibility: Visibility;
  levelVisibility: Visibility;
  isOfficial: boolean;
}

const profileSelect = {
  id: true,
  username: true,
  fullName: true,
  photoUrl: true,
  bio: true,
  status: true,
  isPostgraduate: true,
  interests: true,
  createdAt: true,
  level: true,
  departmentNodeId: true,
  departmentVisibility: true,
  levelVisibility: true,
  roles: { select: { role: true } },
} as const;

type ProfileRow = {
  id: string;
  username: string;
  fullName: string;
  photoUrl: string | null;
  bio: string | null;
  status: UserStatus;
  isPostgraduate: boolean;
  interests: string[];
  createdAt: Date;
  level: number | null;
  departmentNodeId: string | null;
  departmentVisibility: Visibility;
  levelVisibility: Visibility;
  roles: Array<{ role: string }>;
};

function toView(row: ProfileRow, nodes: Awaited<ReturnType<typeof listAcademicNodes>>): ProfileView {
  const lineage = row.departmentNodeId ? lineageFor(nodes, row.departmentNodeId) : { college: null, faculty: null, department: null };
  return {
    id: row.id,
    username: row.username,
    fullName: row.fullName,
    photoUrl: row.photoUrl,
    bio: row.bio,
    status: row.status,
    isPostgraduate: row.isPostgraduate,
    interests: row.interests,
    createdAt: row.createdAt,
    level: row.level,
    departmentName: lineage.department?.name ?? null,
    facultyName: lineage.faculty?.name ?? null,
    collegeName: lineage.college?.name ?? null,
    departmentVisibility: row.departmentVisibility,
    levelVisibility: row.levelVisibility,
    isOfficial: row.roles.some((role) => role.role === "OFFICIAL"),
  };
}

export async function getStudentProfile(universityId: string, username: string): Promise<ProfileView | null> {
  const db = tenantDb(universityId);
  const row = await db.user.findFirst({
    where: { username: username.toLowerCase(), status: { in: ["VERIFIED", "ALUMNI"] } },
    select: profileSelect,
  });
  if (!row) return null;
  return toView(row, await listAcademicNodes(universityId));
}

export async function getOwnProfile(universityId: string, userId: string): Promise<ProfileView | null> {
  const db = tenantDb(universityId);
  const row = await db.user.findFirst({ where: { id: userId }, select: profileSelect });
  if (!row) return null;
  return toView(row, await listAcademicNodes(universityId));
}

/** Field-level privacy. Same-university is the only possible audience here. */
export function canViewField(
  visibility: Visibility,
  context: { isSelf: boolean; sameUniversity: boolean },
): boolean {
  if (context.isSelf) return true;
  if (visibility === "NOBODY") return false;
  if (visibility === "UNIVERSITY") return context.sameUniversity;
  return context.sameUniversity;
}
