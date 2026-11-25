import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireStudent } from "@/lib/auth/guards";
import { loadSocialViewer } from "@/lib/services/social";
import { getMyEvents } from "@/lib/services/events";
import { MyEvents } from "@/components/events/my-events";

export const metadata: Metadata = { title: "My events" };
export const dynamic = "force-dynamic";

const TABS = ["going", "interested", "waitlisted", "past"] as const;
type Tab = (typeof TABS)[number];

export default async function MyEventsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const active: Tab = TABS.includes(tab as Tab) ? (tab as Tab) : "going";
  const user = await requireStudent("/events/mine");
  const viewer = await loadSocialViewer(user);
  if (!viewer) redirect("/onboarding");
  const { events } = await getMyEvents(viewer, active);

  return (
    <div className="px-3 pt-4">
      <MyEvents initialTab={active} initialEvents={events} />
    </div>
  );
}
