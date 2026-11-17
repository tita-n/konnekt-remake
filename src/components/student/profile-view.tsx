import Link from "next/link";
import { BadgeCheck, GraduationCap, Pencil, Sparkles } from "lucide-react";
import type { ProfileView as ProfileData } from "@/lib/services/profile";
import { Avatar, Card } from "@/components/ui/display";
import { ButtonLink } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

export function ProfileView({
  profile,
  university,
  labels,
  isSelf,
  canViewDepartment,
  canViewLevel,
}: {
  profile: ProfileData;
  university: { name: string; shortName: string; accentColor: string };
  labels: { college?: string; faculty?: string; department?: string };
  isSelf: boolean;
  canViewDepartment: boolean;
  canViewLevel: boolean;
}) {
  const department = labels.department ?? "Department";
  return (
    <div>
      <div className="relative h-28 overflow-hidden bg-accent-soft sm:rounded-b-card">
        <div
          className="absolute inset-0 opacity-40"
          style={{ backgroundImage: "radial-gradient(circle at 20% 30%, var(--accent) 0, transparent 45%)" }}
          aria-hidden="true"
        />
      </div>
      <div className="px-4">
        <div className="-mt-10 flex items-end justify-between gap-3">
          <Avatar name={profile.fullName} src={profile.photoUrl} size="xl" verified className="ring-4 ring-bg" priority />
          {isSelf ? (
            <ButtonLink href="/settings/profile" variant="secondary" size="sm" leftIcon={<Pencil aria-hidden="true" className="size-3.5" />}>
              Edit profile
            </ButtonLink>
          ) : null}
        </div>

        <div className="mt-3">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-h1 text-fg">{profile.fullName}</h1>
            {profile.status === "ALUMNI" ? (
              <span className="rounded-chip bg-surface-2 px-2 py-0.5 text-tiny font-bold uppercase tracking-wide text-fg-muted">
                Alumni
              </span>
            ) : (
              <BadgeCheck aria-label="Verified student" className="size-5 text-accent" />
            )}
            {profile.isPostgraduate ? (
              <span className="inline-flex items-center gap-1 rounded-chip bg-accent-soft px-2 py-0.5 text-tiny font-bold uppercase tracking-wide text-accent-soft-fg">
                <GraduationCap aria-hidden="true" className="size-3" />
                Postgraduate
              </span>
            ) : null}
            {profile.isOfficial ? (
              <span className="rounded-chip border border-border px-2 py-0.5 text-tiny font-bold uppercase tracking-wide text-fg-muted">
                Official
              </span>
            ) : null}
          </div>
          <p className="text-small text-fg-subtle">@{profile.username}</p>
          <p className="mt-1 text-small text-fg-muted">
            {university.name}
            {canViewDepartment && profile.departmentName ? ` · ${profile.departmentName}` : ""}
            {canViewLevel && profile.level ? ` · ${profile.level} level` : ""}
          </p>
        </div>

        {profile.bio ? <p className="mt-4 whitespace-pre-line text-body text-fg">{profile.bio}</p> : (
          <p className="mt-4 text-small text-fg-subtle">
            {isSelf ? "Add a bio so classmates know who they're meeting." : "No bio yet."}
          </p>
        )}

        {profile.interests.length > 0 ? (
          <div className="mt-4">
            <h2 className="flex items-center gap-1.5 text-small font-semibold text-fg">
              <Sparkles aria-hidden="true" className="size-4 text-accent" />
              Interests
            </h2>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {profile.interests.map((interest) => (
                <li key={interest} className="rounded-chip bg-surface-2 px-2.5 py-1 text-small text-fg-muted">
                  {interest}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <Card className="mt-5 p-4">
          <h2 className="text-h3 text-fg">Campus details</h2>
          <dl className="mt-2 space-y-2 text-small">
            {canViewDepartment ? (
              <div className="flex justify-between gap-4">
                <dt className="text-fg-subtle">{department}</dt>
                <dd className="text-right font-medium text-fg">{profile.departmentName ?? "Not set"}</dd>
              </div>
            ) : null}
            {canViewDepartment && profile.facultyName ? (
              <div className="flex justify-between gap-4">
                <dt className="text-fg-subtle">{labels.faculty ?? "Faculty"}</dt>
                <dd className="text-right font-medium text-fg">{profile.facultyName}</dd>
              </div>
            ) : null}
            {canViewLevel ? (
              <div className="flex justify-between gap-4">
                <dt className="text-fg-subtle">Level</dt>
                <dd className="text-right font-medium text-fg">{profile.level ? `${profile.level} level` : "Not set"}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-4">
              <dt className="text-fg-subtle">Joined</dt>
              <dd className="text-right font-medium text-fg">{formatDate(profile.createdAt, { month: "long", year: "numeric" })}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-fg-subtle">University</dt>
              <dd className="text-right font-medium text-fg">{university.shortName}</dd>
            </div>
          </dl>
          {!canViewDepartment || !canViewLevel ? (
            <p className="mt-3 text-tiny text-fg-subtle">
              Some details are private.{" "}
              {isSelf ? (
                <Link href="/settings/privacy" className="font-semibold text-accent underline-offset-2 hover:underline">
                  Change what others see
                </Link>
              ) : null}
            </p>
          ) : null}
        </Card>

        <p className="mt-4 text-center text-tiny leading-relaxed text-fg-subtle">
          {isSelf
            ? "This is what other verified students at your university see."
            : `Only verified students at ${university.shortName} can see this profile.`}
        </p>
      </div>
    </div>
  );
}
