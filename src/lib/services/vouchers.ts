import "server-only";
import { tenantDb } from "@/lib/db/tenant";

export interface Voucher {
  id: string;
  fullName: string;
  username: string;
  photoUrl: string | null;
  roleLabel: "Reviewer" | "Course rep";
  departmentName: string | null;
  level: number | null;
}

const roleLabels = {
  REVIEWER: "Reviewer",
  OFFICIAL: "Course rep",
} as const;

export async function listVouchers(universityId: string): Promise<Voucher[]> {
  const db = tenantDb(universityId);
  const users = await db.user.findMany({
    where: {
      status: "VERIFIED",
      roles: { some: { universityId, role: { in: ["REVIEWER", "OFFICIAL"] } } },
    },
    orderBy: [{ fullName: "asc" }],
    take: 100,
    select: {
      id: true,
      fullName: true,
      username: true,
      photoUrl: true,
      level: true,
      department: { select: { name: true } },
      roles: { where: { universityId }, select: { role: true } },
    },
  });

  return users.map((user) => {
    const role = user.roles.some((assignment) => assignment.role === "REVIEWER") ? "REVIEWER" : "OFFICIAL";
    return {
      id: user.id,
      fullName: user.fullName,
      username: user.username,
      photoUrl: user.photoUrl,
      roleLabel: roleLabels[role],
      departmentName: user.department?.name ?? null,
      level: user.level,
    };
  });
}

export async function countVouchers(universityId: string): Promise<number> {
  const db = tenantDb(universityId);
  return db.user.count({
    where: {
      status: "VERIFIED",
      roles: { some: { universityId, role: { in: ["REVIEWER", "OFFICIAL"] } } },
    },
  });
}
