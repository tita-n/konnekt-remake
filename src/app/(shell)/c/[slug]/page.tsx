import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireStudent } from "@/lib/auth/guards";
import { getCommunityPage, listCommunityMembers, listCommunityResources } from "@/lib/services/communities";
import { getCommunityFeed } from "@/lib/services/posts";
import { loadSocialViewer } from "@/lib/services/social";
import { CommunityPage } from "@/components/communities/community-page";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: slug.replace(/-/g, " ") };
}

export default async function CommunityDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ invite?: string }>;
}) {
  const { slug } = await params;
  const { invite } = await searchParams;
  const user = await requireStudent(`/c/${slug}`);
  const viewer = await loadSocialViewer(user);
  if (!viewer) redirect("/onboarding");
  const community = await getCommunityPage(viewer, slug, invite ?? null);
  if (!community) notFound();

  const [feed, resources, members] = await Promise.all([
    getCommunityFeed(viewer, community.id, "latest"),
    community.viewer.isMember ? listCommunityResources(viewer, community.id).catch(() => []) : Promise.resolve(null),
    community.viewer.isMember
      ? listCommunityMembers(viewer, community.id).catch(() => [])
      : Promise.resolve(null),
  ]);

  return (
    <CommunityPage
      community={community}
      initialPosts={feed?.posts ?? []}
      initialPinned={feed?.pinned ?? []}
      initialResources={resources}
      initialMembers={members}
      inviteToken={invite}
    />
  );
}
