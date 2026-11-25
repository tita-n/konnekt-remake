import type { Metadata } from "next";
import { requireUniversityRole } from "@/lib/auth/guards";
import { loadSocialViewer } from "@/lib/services/social";
import { listAdminAnnouncements } from "@/lib/services/announcements";
import { getOfficialPostingContext } from "@/lib/services/official";
import { AnnouncementConsole } from "@/components/admin/announcement-console";

export const metadata: Metadata = { title: "Announcements" };
export const dynamic = "force-dynamic";

export default async function AdminAnnouncementsPage() {
  const user = await requireUniversityRole(["UNIVERSITY_ADMIN", "MODERATOR"]);
  const viewer = await loadSocialViewer(user);
  if (!viewer) return null;
  const [{ announcements }, posting] = await Promise.all([
    listAdminAnnouncements(viewer),
    getOfficialPostingContext(viewer),
  ]);

  return (
    <div className="px-4 py-5">
      <AnnouncementConsole
        initialAnnouncements={announcements}
        timezone={viewer.timezone}
        canCompose={posting.accounts.length > 0}
      />
    </div>
  );
}
