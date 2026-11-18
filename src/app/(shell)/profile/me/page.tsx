import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStudent } from "@/lib/auth/guards";
import { getOwnProfile } from "@/lib/services/profile";
import { getAuthorPosts, getAuthorReplies, getBookmarks } from "@/lib/services/posts";
import { loadSocialViewer } from "@/lib/services/social";
import { parseLabels } from "@/lib/services/universities";
import { ProfileView } from "@/components/student/profile-view";

export const metadata: Metadata = { title: "Your profile" };

export default async function OwnProfilePage() {
  const user = await requireStudent("/profile/me");
  const profile = await getOwnProfile(user.universityId, user.id);
  if (!profile) notFound();
  const viewer = await loadSocialViewer(user);
  const [posts, replies, bookmarkPage] = viewer
    ? await Promise.all([
        getAuthorPosts(viewer, user.id),
        getAuthorReplies(viewer, user.id),
        getBookmarks(viewer),
      ])
    : [[], [], { posts: [] }];

  return (
    <ProfileView
      profile={profile}
      university={user.university}
      labels={parseLabels(user.university.labels)}
      isSelf
      canViewDepartment
      canViewLevel
      posts={posts}
      replies={replies}
      bookmarks={bookmarkPage.posts}
    />
  );
}
