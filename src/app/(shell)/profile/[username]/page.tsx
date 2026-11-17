import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireStudent } from "@/lib/auth/guards";
import { canViewField, getStudentProfile } from "@/lib/services/profile";
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

  const context = { isSelf: profile.id === viewer.id, sameUniversity: true };

  return (
    <ProfileView
      profile={profile}
      university={viewer.university}
      labels={parseLabels(viewer.university.labels)}
      isSelf={context.isSelf}
      canViewDepartment={canViewField(profile.departmentVisibility, context)}
      canViewLevel={canViewField(profile.levelVisibility, context)}
    />
  );
}
