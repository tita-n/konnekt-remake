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
    <div className="px-3 pb-4">
      <header className="flex items-center gap-2 px-1 pt-3">
        <Link href="/settings" aria-label="Back to settings" className="flex size-10 items-center justify-center rounded-full hover:bg-surface-2">
          <ArrowLeft aria-hidden="true" className="size-5" />
        </Link>
        <h1 className="text-h1 text-fg">Blocked and muted</h1>
      </header>
      <div className="mt-4">
        <RestrictedPeople initialBlocked={data.blocked} initialMuted={data.muted} />
      </div>
    </div>
  );
}
