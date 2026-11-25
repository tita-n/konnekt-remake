import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireStudent } from "@/lib/auth/guards";
import { loadSocialViewer } from "@/lib/services/social";
import { listEvents } from "@/lib/services/events";
import { EventsHub } from "@/components/events/events-hub";

export const metadata: Metadata = { title: "Events" };
export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const user = await requireStudent("/events");
  const viewer = await loadSocialViewer(user);
  if (!viewer) redirect("/onboarding");
  const feed = await listEvents(viewer, { tab: "for-you" });

  return (
    <EventsHub
      initial={feed}
      timezone={viewer.timezone}
      canCreate={viewer.accountAgeHours >= 24}
    />
  );
}
