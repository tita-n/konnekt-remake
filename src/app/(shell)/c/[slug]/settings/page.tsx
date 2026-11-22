import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireStudent } from "@/lib/auth/guards";
import {
  getCommunityPage,
  listCommunityInvites,
  listCommunityMembers,
  listCommunityReports,
  listJoinRequests,
} from "@/lib/services/communities";
import { loadSocialViewer } from "@/lib/services/social";
import { CommunitySettings } from "@/components/communities/community-settings";

export const metadata: Metadata = { title: "Community settings" };
export const dynamic = "force-dynamic";

export default async function CommunitySettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireStudent(`/c/${slug}/settings`);
  const viewer = await loadSocialViewer(user);
  if (!viewer) redirect("/onboarding");
  const community = await getCommunityPage(viewer, slug);
  if (!community) notFound();
  if (!community.viewer.canModerate) redirect(`/c/${community.slug}`);

  const [requests, invites, reports, members] = await Promise.all([
    listJoinRequests(viewer, community.id).catch(() => []),
    listCommunityInvites(viewer, community.id).catch(() => []),
    listCommunityReports(viewer, community.id).catch(() => []),
    listCommunityMembers(viewer, community.id).catch(() => []),
  ]);

  return (
    <CommunitySettings
      community={community}
      requests={requests}
      invites={invites}
      reports={reports}
      members={members}
    />
  );
}
