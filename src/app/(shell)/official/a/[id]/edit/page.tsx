import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireStudent } from "@/lib/auth/guards";
import { loadSocialViewer } from "@/lib/services/social";
import { getAnnouncementDetail } from "@/lib/services/announcements";
import { getOfficialPostingContext } from "@/lib/services/official";
import { getEventComposerOptions } from "@/lib/services/event-options";
import { AnnouncementComposer } from "@/components/official/announcement-composer";

export const metadata: Metadata = { title: "Edit announcement", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function EditAnnouncementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireStudent(`/official/a/${id}/edit`);
  const viewer = await loadSocialViewer(user);
  if (!viewer) redirect("/onboarding");
  const [detail, posting, options] = await Promise.all([
    getAnnouncementDetail(viewer, id).catch(() => null),
    getOfficialPostingContext(viewer),
    getEventComposerOptions(viewer),
  ]);
  if (!detail) notFound();
  const account = posting.accounts.find((entry) => entry.id === detail.announcement.officialAccount.id);
  if (!account) notFound();

  return (
    <div className="mx-auto w-full max-w-2xl px-3 pt-4">
      <AnnouncementComposer
        mode="edit"
        announcement={detail.announcement}
        accounts={[{ id: account.id, name: account.name, slug: account.slug, canCritical: account.canCritical }]}
        audiences={options.audiences}
        timezone={viewer.timezone}
      />
    </div>
  );
}
