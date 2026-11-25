import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireStudent } from "@/lib/auth/guards";
import { loadSocialViewer } from "@/lib/services/social";
import { getAnnouncementDetail } from "@/lib/services/announcements";
import { AnnouncementDetail } from "@/components/official/announcement-detail";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: "Official announcement", alternates: { canonical: `/official/a/${id}` } };
}

export default async function AnnouncementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireStudent(`/official/a/${id}`);
  const viewer = await loadSocialViewer(user);
  if (!viewer) redirect("/onboarding");
  const detail = await getAnnouncementDetail(viewer, id).catch(() => null);
  if (!detail) notFound();

  return (
    <div className="mx-auto w-full max-w-2xl px-3 pt-4">
      <AnnouncementDetail announcement={detail.announcement} acknowledged={detail.acknowledged} timezone={viewer.timezone} />
    </div>
  );
}
