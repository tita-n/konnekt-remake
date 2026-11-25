import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireStudent } from "@/lib/auth/guards";
import { loadSocialViewer } from "@/lib/services/social";
import { getEventDetail } from "@/lib/services/events";
import { CheckinScanner } from "@/components/events/checkin-scanner";

export const metadata: Metadata = { title: "Check-in scanner", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function ScanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireStudent(`/events/${id}/scan`);
  const viewer = await loadSocialViewer(user);
  if (!viewer) redirect("/onboarding");
  const detail = await getEventDetail(viewer, id, { recordView: false }).catch(() => null);
  if (!detail || !detail.permissions.canCheckIn) notFound();

  return (
    <div className="mx-auto w-full max-w-md pt-4">
      <CheckinScanner event={detail.event} initialCheckedIn={detail.event.checkedInCount} />
    </div>
  );
}
