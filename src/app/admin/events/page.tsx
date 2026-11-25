import type { Metadata } from "next";
import { requireUniversityRole } from "@/lib/auth/guards";
import { loadSocialViewer } from "@/lib/services/social";
import { listEventsForModeration } from "@/lib/services/event-admin";
import { EventModerationConsole } from "@/components/admin/event-moderation-console";

export const metadata: Metadata = { title: "Events" };
export const dynamic = "force-dynamic";

export default async function AdminEventsPage() {
  const user = await requireUniversityRole(["UNIVERSITY_ADMIN", "MODERATOR"]);
  const viewer = await loadSocialViewer(user);
  if (!viewer) return null;
  const events = await listEventsForModeration(viewer);

  return (
    <div className="px-4 py-5">
      <EventModerationConsole initialEvents={events} timezone={viewer.timezone} />
    </div>
  );
}
