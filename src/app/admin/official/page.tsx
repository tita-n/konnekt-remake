import type { Metadata } from "next";
import { requireUniversityRole } from "@/lib/auth/guards";
import { loadSocialViewer } from "@/lib/services/social";
import { listOfficialAccountsForViewer } from "@/lib/services/official";
import { OfficialConsole } from "@/components/admin/official-console";

export const metadata: Metadata = { title: "Official accounts" };
export const dynamic = "force-dynamic";

export default async function AdminOfficialPage() {
  const user = await requireUniversityRole(["UNIVERSITY_ADMIN"]);
  const viewer = await loadSocialViewer(user);
  if (!viewer) return null;
  const accounts = await listOfficialAccountsForViewer(viewer);
  return (
    <div className="px-4 py-5">
      <OfficialConsole initialAccounts={accounts} />
    </div>
  );
}
