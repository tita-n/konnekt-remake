import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireStudent } from "@/lib/auth/guards";
import { loadSocialViewer } from "@/lib/services/social";
import { getAnnouncementBanners, listOfficialFeed } from "@/lib/services/announcements";
import { listOfficialAccountsForViewer } from "@/lib/services/official";
import { OfficialChannel } from "@/components/official/official-channel";

export const metadata: Metadata = { title: "Official channel" };
export const dynamic = "force-dynamic";

export default async function OfficialPage() {
  const user = await requireStudent("/official");
  const viewer = await loadSocialViewer(user);
  if (!viewer) redirect("/onboarding");
  const [feed, banners, accounts] = await Promise.all([
    listOfficialFeed(viewer),
    getAnnouncementBanners(viewer),
    listOfficialAccountsForViewer(viewer),
  ]);

  return (
    <div className="mx-auto w-full max-w-2xl px-3 pt-4">
      <OfficialChannel
        initialFeed={feed}
        banners={banners}
        accounts={accounts.map((account) => ({
          id: account.id,
          name: account.name,
          slug: account.slug,
          canPost: account.canPost,
        }))}
        canPost={accounts.some((account) => account.canPost)}
        timezone={viewer.timezone}
      />
    </div>
  );
}
