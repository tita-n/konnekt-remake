import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUniversityRole } from "@/lib/auth/guards";
import { listAdminCommunities, type CommunityStaffViewer } from "@/lib/services/communities";
import { CommunityConsole } from "@/components/admin/community-console";

export const metadata: Metadata = { title: "Communities" };
export const dynamic = "force-dynamic";

export default async function AdminCommunitiesPage() {
  const user = await requireUniversityRole(["UNIVERSITY_ADMIN", "MODERATOR"]);
  const roles = user.roles.filter((role) => role.universityId === user.universityId).map((role) => role.role);
  const isAdmin = roles.includes("UNIVERSITY_ADMIN");
  const viewer: CommunityStaffViewer = {
    userId: user.id,
    universityId: user.universityId,
    isUniversityStaff: isAdmin || roles.includes("MODERATOR"),
    isUniversityAdmin: isAdmin,
  };
  if (!viewer.isUniversityStaff) notFound();
  const payload = await listAdminCommunities(viewer);
  return <CommunityConsole initial={payload} isAdmin={isAdmin} />;
}
