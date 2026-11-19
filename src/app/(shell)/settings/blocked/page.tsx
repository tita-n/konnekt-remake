import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireStudent } from "@/lib/auth/guards";
import { listRestrictedStudents } from "@/lib/services/moderation";
import { loadSocialViewer } from "@/lib/services/social";
import { RestrictedPeople } from "@/components/settings/restricted-people";

export const metadata: Metadata = { title: "Blocked and muted" };
export const dynamic = "force-dynamic";

export default async function BlockedSettingsPage() {
  const user = await requireStudent("/settings/blocked");
  const viewer = await loadSocialViewer(user);
  const data = viewer ? await listRestrictedStudents(viewer) : { blocked: [], muted: [] };
  return (
    <div className="pb-4">
      <header className="sticky top-14 z-20 flex h-14 items-center border-b border-border bg-surface px-2">
        <Link href="/settings" aria-label="Back to settings" className="flex size-10 items-center justify-center rounded-full text-fg hover:bg-surface-2">
          <ArrowLeft aria-hidden="true" className="size-5" />
        </Link>
        <h1 className="flex-1 text-center text-h2 text-fg">Blocked and muted</h1>
        <span className="size-10" aria-hidden="true" />
      </header>
      <div className="px-3 pt-3">
        <RestrictedPeople initialBlocked={data.blocked} initialMuted={data.muted} />
      </div>
    </div>
  );
}
