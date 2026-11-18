import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireStudent } from "@/lib/auth/guards";
import { tenantDb } from "@/lib/db/tenant";
import { canViewField, getStudentProfile } from "@/lib/services/profile";
import { getAuthorPosts, getAuthorReplies } from "@/lib/services/posts";
import { loadSocialViewer } from "@/lib/services/social";
import { parseLabels } from "@/lib/services/universities";
import { ProfileView } from "@/components/student/profile-view";

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  return { title: `@${username}` };
}

export default async function StudentProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  if (username === "me") redirect("/profile/me");

  const viewer = await requireStudent(`/profile/${username}`);
  const profile = await getStudentProfile(viewer.universityId, username);
  if (!profile) notFound();

  // Blocks are symmetric and invisible: if either student blocked the other,
  // this profile must be indistinguishable from one that never existed.
  if (profile.id !== viewer.id) {
    const block = await tenantDb(viewer.universityId).block.findFirst({
      where: {
        OR: [
          { userId: viewer.id, blockedUserId: profile.id },
          { userId: profile.id, blockedUserId: viewer.id },
        ],
      },
      select: { id: true },
    });
    if (block) notFound();
  }

  const context = { isSelf: profile.id === viewer.id, sameUniversity: true };
  const socialViewer = await loadSocialViewer(viewer);
  const [posts, replies] = socialViewer
    ? await Promise.all([getAuthorPosts(socialViewer, profile.id), getAuthorReplies(socialViewer, profile.id)])
    : [[], []];

  return (
    <ProfileView
      profile={profile}
      university={viewer.university}
      labels={parseLabels(viewer.university.labels)}
      isSelf={context.isSelf}
      canViewDepartment={canViewField(profile.departmentVisibility, context)}
      canViewLevel={canViewField(profile.levelVisibility, context)}
      posts={posts}
      replies={replies}
    />
  );
}
