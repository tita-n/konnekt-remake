import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireStudent } from "@/lib/auth/guards";
import { listDiscoverCommunities } from "@/lib/services/communities";
import { loadSocialViewer } from "@/lib/services/social";
import { CommunitySearch } from "@/components/communities/community-search";

export const metadata: Metadata = { title: "Search" };
export const dynamic = "force-dynamic";

export default async function SearchPage() {
  const user = await requireStudent("/search");
  const viewer = await loadSocialViewer(user);
  if (!viewer) redirect("/onboarding");
  const initial = await listDiscoverCommunities(viewer);
  return <CommunitySearch initial={initial} />;
}
