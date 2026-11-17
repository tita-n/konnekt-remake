import type { Metadata } from "next";
import type { Role } from "@prisma/client";
import { requireUniversityRole } from "@/lib/auth/guards";
import { accentCssVars } from "@/lib/domain/color";
import { tenantDb } from "@/lib/db/tenant";
import { AdminShell } from "@/components/admin/admin-shell";

export const metadata: Metadata = {
  title: { default: "University console", template: "%s · Konnekt admin" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUniversityRole(["UNIVERSITY_ADMIN", "REVIEWER"] as Role[]);
  const roles = user.roles.filter((role) => role.universityId === user.universityId).map((role) => role.role);
  const isAdmin = roles.includes("UNIVERSITY_ADMIN");
  const pendingCount = await tenantDb(user.universityId).verificationRequest.count({ where: { status: "PENDING" } });

  return (
    <div
      style={accentCssVars(user.university.accentColor) as React.CSSProperties}
      className="min-h-dvh bg-bg"
    >
      <AdminShell
        university={user.university}
        user={{ fullName: user.fullName, photoUrl: user.photoUrl }}
        pendingCount={pendingCount}
        isAdmin={isAdmin}
      >
        {children}
      </AdminShell>
    </div>
  );
}
