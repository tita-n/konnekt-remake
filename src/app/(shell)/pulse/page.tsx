import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireStudent } from "@/lib/auth/guards";
import { feedFiltersFor } from "@/lib/domain/posts";
import { getFeed, getTrendingTags } from "@/lib/services/posts";
import { loadSocialViewer } from "@/lib/services/social";
import { PulseFeed } from "@/components/pulse/feed";

export const metadata: Metadata = { title: "Pulse" };
export const dynamic = "force-dynamic";

export default async function PulsePage() {
  const user = await requireStudent("/pulse");
  const viewer = await loadSocialViewer(user);
  if (!viewer) redirect("/onboarding");

  const [feed, trending] = await Promise.all([
    getFeed(viewer, "all"),
    getTrendingTags(viewer, "all"),
  ]);

  const filters = feedFiltersFor({
    labels: viewer.labels,
    hasCollege: Boolean(viewer.lineage.college),
    hasFaculty: Boolean(viewer.lineage.faculty),
  });

  return (
    <PulseFeed
      viewerId={viewer.userId}
      initialFeed={feed}
      initialTrending={trending}
      filters={filters}
    />
  );
}
