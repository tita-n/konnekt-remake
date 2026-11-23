import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireStudent } from "@/lib/auth/guards";
import { listDiscoverCommunities, listMyCommunities } from "@/lib/services/communities";
import { loadSocialViewer } from "@/lib/services/social";
import { CommunityHub } from "@/components/communities/community-hub";

export const metadata: Metadata = { title: "Communities" };
export const dynamic = "force-dynamic";

export default async function CommunitiesPage() {
  const user = await requireStudent("/communities");
  const viewer = await loadSocialViewer(user);
  if (!viewer) redirect("/onboarding");
  const [mine, discover] = await Promise.all([
    listMyCommunities(viewer),
    listDiscoverCommunities(viewer),
  ]);
  return <CommunityHub mine={mine} discover={discover} />;
}
