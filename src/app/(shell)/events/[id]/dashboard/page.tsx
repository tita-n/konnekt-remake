import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireStudent } from "@/lib/auth/guards";
import { loadSocialViewer } from "@/lib/services/social";
import { getEventDetail, getOrganiserDashboard, listEventStaff } from "@/lib/services/events";
import { OrganiserDashboard } from "@/components/events/organiser-dashboard";

export const metadata: Metadata = { title: "Organiser dashboard", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function EventDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireStudent(`/events/${id}/dashboard`);
  const viewer = await loadSocialViewer(user);
  if (!viewer) redirect("/onboarding");
  const [dashboard, staff, detail] = await Promise.all([
    getOrganiserDashboard(viewer, id).catch(() => null),
    listEventStaff(viewer, id).catch(() => []),
    getEventDetail(viewer, id, { recordView: false }).catch(() => null),
  ]);
  if (!dashboard) notFound();

  return (
    <div className="mx-auto w-full max-w-2xl pt-4">
      <OrganiserDashboard
        dashboard={dashboard}
        initialStaff={staff}
        canManageStaff={Boolean(detail?.permissions.canManageStaff)}
        canExport={Boolean(detail?.permissions.canExportAttendees)}
      />
    </div>
  );
}
