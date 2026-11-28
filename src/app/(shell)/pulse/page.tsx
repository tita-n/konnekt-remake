import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireStudent } from "@/lib/auth/guards";
import { feedFiltersFor } from "@/lib/domain/posts";
import { getContinueDraft, getFeed, getTrendingTags } from "@/lib/services/posts";
import { loadSocialViewer } from "@/lib/services/social";
import { listEvents } from "@/lib/services/events";
import { getAnnouncementBanners } from "@/lib/services/announcements";
import { PulseFeed } from "@/components/pulse/feed";
import { PulseEventModules } from "@/components/pulse/event-modules";

export const metadata: Metadata = { title: "Pulse" };
export const dynamic = "force-dynamic";

export default async function PulsePage() {
  const user = await requireStudent("/pulse");
  const viewer = await loadSocialViewer(user);
  if (!viewer) redirect("/onboarding");

  const [feed, trending, events, banners, continueDraft] = await Promise.all([
    getFeed(viewer, "all"),
    getTrendingTags(viewer, "all"),
    listEvents(viewer, { tab: "for-you", limit: 4 }).catch(() => null),
    getAnnouncementBanners(viewer).catch(() => ({ critical: null, official: null })),
    getContinueDraft(viewer).catch(() => null),
  ]);
  const upcoming = events?.events.find((event) => !event.ended && !event.live) ?? events?.events[0] ?? null;

  const filters = feedFiltersFor({
    labels: viewer.labels,
    hasCollege: Boolean(viewer.lineage.college),
    hasFaculty: Boolean(viewer.lineage.faculty),
  });

  return (
    <>
      <PulseEventModules
        banners={banners}
        happeningNow={events?.happeningNow ?? []}
        upcoming={upcoming}
        viewerState={events?.viewer ?? {}}
      />
      <PulseFeed
        viewerId={viewer.userId}
        initialFeed={feed}
        initialTrending={trending}
        filters={filters}
        continueDraft={continueDraft}
      />
    </>
  );
}
