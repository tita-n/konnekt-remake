import type { Metadata } from "next";
import { requireStudent } from "@/lib/auth/guards";
import { listDrafts } from "@/lib/services/posts";
import { loadSocialViewer } from "@/lib/services/social";
import { DraftsList } from "@/components/pulse/drafts-list";

export const metadata: Metadata = { title: "Drafts" };
export const dynamic = "force-dynamic";

export default async function DraftsPage() {
  const user = await requireStudent("/drafts");
  const viewer = await loadSocialViewer(user);
  const drafts = viewer ? await listDrafts(viewer) : [];
  return (
    <div className="px-3 pb-4">
      <header className="px-1 pt-5">
        <h1 className="text-h1 text-fg">Drafts</h1>
        <p className="mt-1 text-small text-fg-muted">Your saved drafts are here. Continue editing and post them any time.</p>
      </header>
      <div className="mt-4">
        <DraftsList initialDrafts={drafts} />
      </div>
    </div>
  );
}
