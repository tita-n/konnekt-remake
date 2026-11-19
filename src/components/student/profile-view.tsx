import { BadgeCheck, GraduationCap, Pencil, Shield } from "lucide-react";
import type { ProfileView as ProfileData } from "@/lib/services/profile";
import { Avatar } from "@/components/ui/display";
import { ButtonLink } from "@/components/ui/button";
import { ProfileTabs } from "./profile-tabs";
import { ShareProfileButton } from "./share-profile-button";
import type { PostView } from "@/lib/posts/types";
import type { ProfileReply } from "@/lib/services/posts";
import { formatDate } from "@/lib/utils";

export function ProfileView({
  profile,
  university,
  isSelf,
  canViewDepartment,
  canViewLevel,
  posts = [],
  replies = [],
  bookmarks = [],
}: {
  profile: ProfileData;
  university: { name: string; shortName: string; accentColor: string };
  labels: { college?: string; faculty?: string; department?: string };
  isSelf: boolean;
  canViewDepartment: boolean;
  canViewLevel: boolean;
  posts?: PostView[];
  replies?: ProfileReply[];
  bookmarks?: PostView[];
}) {
  const academicChips = [
    canViewDepartment && profile.facultyName ? profile.facultyName : null,
    canViewDepartment && profile.departmentName ? profile.departmentName : null,
    canViewLevel && profile.level ? `${profile.level} Level` : !canViewLevel ? "Level hidden" : null,
  ].filter((value): value is string => Boolean(value));

  return (
    <div className="pb-4">
      <div className="relative h-28 overflow-hidden bg-accent-soft">
        <div
          className="absolute inset-0"
          style={{ backgroundImage: "linear-gradient(115deg, color-mix(in srgb, var(--accent) 28%, #ffffff) 0%, color-mix(in srgb, var(--accent) 12%, #ffffff) 48%, color-mix(in srgb, #7c6cf6 20%, #ffffff) 100%)" }}
          aria-hidden="true"
        />
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/8 to-transparent" aria-hidden="true" />
        <div className="absolute right-5 top-5 inline-flex items-center gap-2 rounded-[12px] border border-white/60 bg-white/72 px-3 py-2 text-xs font-bold uppercase tracking-[0.08em] text-accent shadow-sm backdrop-blur-sm">
          <Shield aria-hidden="true" className="size-4" />
          {university.shortName}
        </div>
      </div>

      <div className="px-4">
        <div className="-mt-11 flex items-end justify-between gap-3">
          <Avatar name={profile.fullName} src={profile.photoUrl} size="xl" verified className="ring-4 ring-bg" priority />
          {profile.isPostgraduate ? (
            <span className="mb-1 inline-flex items-center gap-1 rounded-chip bg-accent-soft px-2.5 py-1 text-tiny font-semibold text-accent-soft-fg">
              <GraduationCap aria-hidden="true" className="size-3.5" />
              Postgraduate
            </span>
          ) : null}
        </div>

        <div className="mt-3">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h1 className="text-h1 text-fg">{profile.fullName}</h1>
            {profile.status === "ALUMNI" ? (
              <span className="rounded-chip bg-surface-2 px-2 py-0.5 text-tiny font-semibold text-fg-muted">Alumni</span>
            ) : (
              <BadgeCheck aria-label="Verified student" className="size-5 text-accent" />
            )}
            {profile.isOfficial ? (
              <span className="rounded-chip border border-border px-2 py-0.5 text-tiny font-semibold text-fg-muted">Official</span>
            ) : null}
          </div>
          <p className="text-small text-fg-muted">@{profile.username}</p>
        </div>

        {profile.bio ? <p className="mt-2.5 whitespace-pre-line text-small leading-relaxed text-fg">{profile.bio}</p> : (
          <p className="mt-2.5 text-small text-fg-subtle">
            {isSelf ? "Add a bio so classmates know who they're meeting." : "No bio yet."}
          </p>
        )}

        {academicChips.length > 0 || profile.interests.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Profile details and interests">
            {academicChips.map((chip) => (
              <li key={chip} className="inline-flex items-center gap-1.5 rounded-chip border border-border bg-surface px-2.5 py-1 text-tiny font-medium text-fg-muted">
                <GraduationCap aria-hidden="true" className="size-3.5" />
                {chip}
              </li>
            ))}
            {profile.interests.map((interest) => (
              <li key={interest} className="rounded-chip border border-border bg-surface px-2.5 py-1 text-tiny font-medium text-fg-muted">
                {interest}
              </li>
            ))}
          </ul>
        ) : null}

        <p className="mt-3 text-tiny text-fg-muted">
          <span className="font-semibold text-fg">{posts.length} {posts.length === 1 ? "post" : "posts"}</span>
          <span aria-hidden="true"> · </span>
          Joined {formatDate(profile.createdAt, { month: "short", year: "numeric" })}
        </p>

        <div className="mt-3 flex items-center gap-2">
          {isSelf ? (
            <>
              <ButtonLink href="/settings/profile" variant="secondary" fullWidth leftIcon={<Pencil aria-hidden="true" className="size-4" />}>
                Edit profile
              </ButtonLink>
              <ShareProfileButton username={profile.username} />
            </>
          ) : (
            <ShareProfileButton username={profile.username} />
          )}
        </div>

        <ProfileTabs initialPosts={posts} replies={replies} bookmarks={bookmarks} isSelf={isSelf} />
      </div>
    </div>
  );
}
