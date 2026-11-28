import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { getPlatformUniversity } from "@/lib/services/platform";
import { Card } from "@/components/ui/display";
import { Badge, UniversityStatusBadge } from "@/components/admin/status-badge";
import { FeaturesForm, InviteAdminForm, PlatformInviteCancel, StatusControls } from "@/components/platform/university-controls";
import { buttonStyles } from "@/components/ui/button-styles";

export const metadata: Metadata = { title: "University" };

export default async function PlatformUniversityPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePlatformAdmin();
  const { id } = await params;
  const university = await getPlatformUniversity(id);
  if (!university) notFound();

  return (
    <div className="space-y-5">
      <Link href="/platform/universities" className="inline-flex min-h-11 items-center gap-1.5 text-small font-semibold text-fg-muted hover:text-fg">
        <ArrowLeft aria-hidden="true" className="size-4" /> Universities
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-[14px] text-small font-bold" style={{ backgroundColor: university.accentColor, color: "#fff" }}>
            {university.shortName.slice(0, 2).toUpperCase()}
          </span>
          <div>
            <h1 className="text-h1 text-fg">{university.name}</h1>
            <p className="text-small text-fg-muted">
              {university.slug} · created{" "}
              {new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(university.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <UniversityStatusBadge status={university.status} />
          <Link href={`/signup/${university.slug}`} target="_blank" className={buttonStyles({ variant: "secondary", size: "sm" })}>
            Public page <ExternalLink aria-hidden="true" className="size-3.5" />
          </Link>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <Card className="p-4">
            <h2 className="text-h3 text-fg">Space</h2>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-small sm:grid-cols-3">
              <div>
                <dt className="text-fg-subtle">Accounts</dt>
                <dd className="text-h3 font-bold text-fg">{university.userCount}</dd>
              </div>
              <div>
                <dt className="text-fg-subtle">Requests</dt>
                <dd className="text-h3 font-bold text-fg">{university.pendingCount}</dd>
              </div>
              <div>
                <dt className="text-fg-subtle">Accent</dt>
                <dd className="mt-1 flex items-center gap-1.5 font-mono text-[0.75rem] font-semibold text-fg">
                  <span className="size-3 rounded-full border border-border" style={{ backgroundColor: university.accentColor }} />
                  {university.accentColor}
                </dd>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <dt className="text-fg-subtle">Layers</dt>
                <dd className="font-semibold text-fg">
                  {university.labels.college} / {university.labels.faculty} / {university.labels.department}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-fg-subtle">Student email domains</dt>
                <dd className="font-semibold text-fg">{university.studentEmailDomains.join(", ") || "None"}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-fg-subtle">Matric pattern</dt>
                <dd className="break-all font-mono text-[0.75rem] text-fg">{university.matricPattern}</dd>
              </div>
            </dl>
            <div className="mt-4 border-t border-border pt-3">
              <p className="mb-2 text-small font-semibold text-fg">Status</p>
              <StatusControls universityId={university.id} status={university.status} />
              <p className="mt-2 text-[0.6875rem] text-fg-subtle">
                Accent, labels and verification settings are edited by the university&apos;s own admin.
              </p>
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="text-h3 text-fg">Capabilities</h2>
            <div className="mt-3">
              <FeaturesForm
                universityId={university.id}
                idCardEnabled={university.idCardEnabled}
                vouchingEnabled={university.vouchingEnabled}
                featureFlags={university.featureFlags}
              />
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="text-h3 text-fg">Pending invitations</h2>
            {university.invites.length === 0 ? (
              <p className="mt-2 text-small text-fg-muted">No pending staff invitations.</p>
            ) : (
              <ul className="mt-3 divide-y divide-border">
                {university.invites.map((invite) => (
                  <li key={invite.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0">
                      <span className="block truncate text-small font-semibold text-fg">{invite.email}</span>
                      <span className="block text-[0.6875rem] text-fg-subtle">
                        {invite.role.replaceAll("_", " ").toLowerCase()} · expires{" "}
                        {new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(invite.expiresAt)}
                      </span>
                    </span>
                    <PlatformInviteCancel inviteId={invite.id} universityId={university.id} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-4">
            <h2 className="text-h3 text-fg">Staff</h2>
            {university.staff.length === 0 ? (
              <p className="mt-2 text-small text-fg-muted">No admins yet. Invite the first one below.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {university.staff.map((member) => (
                  <li key={member.id} className="rounded-input bg-surface-2 px-3 py-2">
                    <p className="text-small font-semibold text-fg">{member.fullName}</p>
                    <p className="text-[0.6875rem] text-fg-subtle">{member.email}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {member.roles.map((role) => (
                        <Badge key={role.role} tone={role.role === "UNIVERSITY_ADMIN" ? "accent" : "neutral"}>
                          {role.role.replaceAll("_", " ").toLowerCase()}
                        </Badge>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-4">
            <InviteAdminForm universityId={university.id} disabled={university.status !== "ACTIVE"} />
          </Card>
        </div>
      </div>
    </div>
  );
}
