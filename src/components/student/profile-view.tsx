import Link from "next/link";
import {
  ArrowLeft,
  Camera,
  Code2,
  GraduationCap,
  Headphones,
  Layers,
  Lock,
  Pencil,
  Sparkles,
} from "lucide-react";
import type { ProfileView as ProfileData } from "@/lib/services/profile";
import { Avatar } from "@/components/ui/display";
import { ButtonLink } from "@/components/ui/button";
import { ProfileTabs } from "./profile-tabs";
import { ShareProfileButton } from "./share-profile-button";
import { ProfileActionsMenu } from "./profile-actions-menu";
import type { PostView } from "@/lib/posts/types";
import type { ProfileReply } from "@/lib/services/posts";
import { formatDate } from "@/lib/utils";

function InterestIcon({ label }: { label: string }) {
  const lower = label.toLowerCase();
  if (lower.includes("code") || lower.includes("coding") || lower.includes("tech")) {
    return <Code2 aria-hidden="true" className="size-3.5 text-accent" />;
  }
  if (lower.includes("photo") || lower.includes("camera")) {
    return <Camera aria-hidden="true" className="size-3.5 text-accent" />;
  }
  if (lower.includes("music") || lower.includes("audio")) {
    return <Headphones aria-hidden="true" className="size-3.5 text-accent" />;
  }
  return <Sparkles aria-hidden="true" className="size-3.5 text-accent" />;
}

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
  const academicChips: Array<{ label: string; kind: "faculty" | "department" | "level" | "hidden" }> = [];
  if (canViewDepartment && profile.facultyName) {
    academicChips.push({ label: profile.facultyName, kind: "faculty" });
  }
  if (canViewDepartment && profile.departmentName) {
    academicChips.push({ label: profile.departmentName, kind: "department" });
  }
  if (canViewLevel && profile.level) {
    academicChips.push({ label: `${profile.level} Level`, kind: "level" });
  } else if (!canViewLevel) {
    academicChips.push({ label: "Level hidden", kind: "hidden" });
  }

  return (
    <div className="pb-6">
      {!isSelf ? (
        <header className="sticky top-14 z-20 flex h-12 items-center justify-between border-b border-border bg-surface px-2">
          <Link href="/pulse" aria-label="Back to Pulse" className="flex size-10 items-center justify-center rounded-full text-fg hover:bg-surface-2">
            <ArrowLeft aria-hidden="true" className="size-5" />
          </Link>
          <p className="truncate font-display text-[1rem] font-bold text-fg">{university.name}</p>
          <ProfileActionsMenu
            username={profile.username}
            fullName={profile.fullName}
            latestPostId={posts[0]?.id}
          />
        </header>
      ) : null}

      <div className="relative h-32 overflow-hidden bg-accent-soft">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/assets/illustrations/nova-campus-banner.jpg"
          alt={`${university.name} campus banner`}
          width={900}
          height={280}
          className="size-full object-cover"
        />
        <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/15 to-transparent" aria-hidden="true" />
      </div>

      <div className="px-4">
        <div className="-mt-12 flex items-end justify-between gap-3">
          <Avatar
            name={profile.fullName}
            src={profile.photoUrl}
            size="xl"
            verified={profile.status !== "ALUMNI"}
            official={profile.isOfficial}
            className="ring-4 ring-surface"
            priority
          />
          {profile.isPostgraduate ? (
            <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-accent-soft px-3 py-1 text-tiny font-semibold text-accent-soft-fg">
              <GraduationCap aria-hidden="true" className="size-3.5" />
              Postgraduate
            </span>
          ) : null}
        </div>

        <div className="mt-3">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h1 className="font-display text-[1.375rem] font-bold tracking-tight text-fg">{profile.fullName}</h1>
            {profile.status === "ALUMNI" ? (
              <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-tiny font-semibold text-fg-muted">Alumni</span>
            ) : null}
            {profile.isOfficial ? (
              <span className="rounded-full border border-border px-2.5 py-0.5 text-tiny font-semibold text-fg-muted">Official</span>
            ) : null}
          </div>
          <p className="text-small text-fg-muted">@{profile.username}</p>
        </div>

        {profile.bio ? (
          <p className="mt-2.5 whitespace-pre-line text-small leading-relaxed text-fg">{profile.bio}</p>
        ) : (
          <p className="mt-2.5 text-small text-fg-subtle">
            {isSelf ? "Add a bio so classmates know who they're meeting." : "No bio yet."}
          </p>
        )}

        {academicChips.length > 0 || profile.interests.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Profile details and interests">
            {academicChips.map((chip) => (
              <li
                key={chip.label}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2/60 px-3 py-1 text-tiny font-medium text-fg"
              >
                {chip.kind === "faculty" ? (
                  <GraduationCap aria-hidden="true" className="size-3.5 text-fg-muted" />
                ) : chip.kind === "department" ? (
                  <Code2 aria-hidden="true" className="size-3.5 text-fg-muted" />
                ) : chip.kind === "level" ? (
                  <Layers aria-hidden="true" className="size-3.5 text-fg-muted" />
                ) : (
                  <Lock aria-hidden="true" className="size-3.5 text-fg-subtle" />
                )}
                <span className={chip.kind === "hidden" ? "text-fg-muted" : undefined}>{chip.label}</span>
              </li>
            ))}
            {profile.interests.map((interest) => (
              <li
                key={interest}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-tiny font-medium text-fg"
              >
                <InterestIcon label={interest} />
                {interest}
              </li>
            ))}
          </ul>
        ) : null}

        <p className="mt-3 text-small text-fg-muted">
          <span className="font-semibold text-fg">{posts.length} {posts.length === 1 ? "post" : "posts"}</span>
          <span aria-hidden="true"> · </span>
          Joined {formatDate(profile.createdAt, { month: "short", year: "numeric" })}
        </p>

        {isSelf ? (
          <div className="mt-3.5 flex items-center gap-2.5">
            <ButtonLink
              href="/settings/profile"
              variant="secondary"
              fullWidth
              className="rounded-full"
              leftIcon={<Pencil aria-hidden="true" className="size-4" />}
            >
              Edit profile
            </ButtonLink>
            <ShareProfileButton username={profile.username} />
          </div>
        ) : null}

        <ProfileTabs initialPosts={posts} replies={replies} bookmarks={bookmarks} isSelf={isSelf} />
      </div>
    </div>
  );
}

