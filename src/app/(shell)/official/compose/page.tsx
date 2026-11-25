import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireStudent } from "@/lib/auth/guards";
import { loadSocialViewer } from "@/lib/services/social";
import { getEventComposerOptions } from "@/lib/services/event-options";
import { getOfficialPostingContext } from "@/lib/services/official";
import { AnnouncementComposer } from "@/components/official/announcement-composer";

export const metadata: Metadata = { title: "New announcement" };
export const dynamic = "force-dynamic";

export default async function ComposeAnnouncementPage() {
  const user = await requireStudent("/official/compose");
  const viewer = await loadSocialViewer(user);
  if (!viewer) redirect("/onboarding");
  const [posting, options] = await Promise.all([getOfficialPostingContext(viewer), getEventComposerOptions(viewer)]);
  if (posting.accounts.length === 0) notFound();

  return (
    <div className="mx-auto w-full max-w-2xl px-3 pt-4">
      <AnnouncementComposer
        mode="create"
        accounts={posting.accounts.map((account) => ({
          id: account.id,
          name: account.name,
          slug: account.slug,
          canCritical: account.canCritical,
        }))}
        audiences={options.audiences}
        timezone={viewer.timezone}
      />
    </div>
  );
}
