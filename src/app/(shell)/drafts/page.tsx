import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, FilePenLine } from "lucide-react";
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
    <div className="pb-4">
      <header className="sticky top-14 z-20 flex h-14 items-center border-b border-border bg-surface px-2">
        <Link href="/profile/me" aria-label="Back to profile" className="flex size-11 items-center justify-center rounded-full text-fg hover:bg-surface-2">
          <ArrowLeft aria-hidden="true" className="size-5" />
        </Link>
        <h1 className="flex-1 text-center text-h2 text-fg">Drafts</h1>
        <span className="size-10" aria-hidden="true" />
      </header>

      <div className="px-3 pt-3">
        <p className="flex items-start gap-2.5 rounded-[12px] bg-accent-soft px-3.5 py-3 text-small leading-relaxed text-accent-soft-fg">
          <FilePenLine aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          Your saved drafts are here. Continue editing and post them any time.
        </p>
        <div className="mt-3">
          <DraftsList initialDrafts={drafts} />
        </div>
      </div>
    </div>
  );
}
