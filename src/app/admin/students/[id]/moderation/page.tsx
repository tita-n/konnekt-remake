import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, ShieldAlert, TriangleAlert } from "lucide-react";
import { requireUniversityRole } from "@/lib/auth/guards";
import { getStudentModerationHistory } from "@/lib/services/moderation";
import { ReinstateForm } from "@/components/admin/reinstate-form";
import { AdminAvatar } from "@/components/admin/admin-avatar";
import { formatDate, timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "Moderation history" };
export const dynamic = "force-dynamic";

export default async function StudentModerationPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUniversityRole(["UNIVERSITY_ADMIN", "MODERATOR"]);
  const { id } = await params;
  const history = await getStudentModerationHistory(user, id);
  if (!history) notFound();
  const canReinstate = user.roles.some((role) => role.universityId === user.universityId && role.role === "UNIVERSITY_ADMIN");

  return (
    <div className="space-y-5">
      <Link href="/admin/reports" className="inline-flex min-h-11 items-center gap-1.5 text-small font-semibold text-fg-muted hover:text-fg">
        <ArrowLeft aria-hidden="true" className="size-4" /> Reports
      </Link>

      <header className="flex flex-wrap items-start gap-4 rounded-card border border-border bg-surface p-5">
        <AdminAvatar name={history.user.fullName} seed={history.user.username} src={history.user.photoUrl} size={64} />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-h1 text-fg">{history.user.fullName}</h1>
          <p className="text-small text-fg-muted">
            @{history.user.username} · {history.user.departmentName ?? "Department hidden"}{" "}
            {history.user.level ? `· ${history.user.level} Level` : ""}
          </p>
          <span
            className={
              history.user.status === "SUSPENDED"
                ? "mt-2 inline-flex items-center gap-1.5 rounded-chip bg-danger-soft px-2.5 py-0.5 text-tiny font-semibold text-danger"
                : "mt-2 inline-flex items-center gap-1.5 rounded-chip bg-success-soft px-2.5 py-0.5 text-tiny font-semibold text-success"
            }
          >
            <span
              className={`size-1.5 rounded-full ${history.user.status === "SUSPENDED" ? "bg-danger" : "bg-success-solid"}`}
              aria-hidden="true"
            />
            {history.user.status === "VERIFIED" ? "Active" : history.user.status.toLowerCase()}
          </span>
        </div>
        <div className="grid grid-cols-2 divide-x divide-accent/15 rounded-[14px] border border-accent/15 bg-accent-soft px-4 py-3">
          <div className="pr-4 text-center">
            <p className="text-tiny font-medium text-fg-muted">Reports against</p>
            <p className="mt-0.5 font-display text-h2 tabular-nums text-accent-ink">{history.reportsAgainst}</p>
          </div>
          <div className="pl-4 text-center">
            <p className="text-tiny font-medium text-fg-muted">Strikes</p>
            <p className="mt-0.5 font-display text-h2 tabular-nums text-accent-ink">{history.activeStrikes} of 3</p>
          </div>
        </div>
      </header>

      {history.activeStrikes >= 3 ? (
        <p className="flex items-start gap-2 rounded-[14px] border border-danger/30 bg-danger-soft px-4 py-3 text-small font-semibold text-danger">
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          Three active strikes in 90 days. This account is flagged for admin review; it has not been automatically banned.
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-[18px] border border-border bg-surface p-5 shadow-card">
          <h2 className="font-display text-h3 text-fg">Moderation history</h2>
          {history.history.length === 0 ? (
            <p className="mt-2 text-small text-fg-muted">No moderation actions recorded.</p>
          ) : (
            <ol className="mt-4 space-y-3">
              {history.history.map((action, index) => {
                const isLatest = index === 0;
                const isLast = index === history.history.length - 1;
                return (
                  <li key={action.id} className="relative pl-6">
                    <span
                      className={`absolute left-0 top-3.5 z-10 size-3 rounded-full ring-4 ring-surface ${isLatest ? "bg-accent" : "bg-fg-subtle/45"}`}
                      aria-hidden="true"
                    />
                    {!isLast ? (
                      <span className="absolute bottom-[-1rem] left-[5px] top-6 w-px bg-border" aria-hidden="true" />
                    ) : null}
                    <div className={`rounded-[12px] border p-3.5 ${isLatest ? "border-accent/15 bg-accent-soft/55" : "border-border bg-surface"}`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-tiny font-semibold text-fg-muted">{formatDate(action.createdAt)}</span>
                        <span className="rounded-full bg-danger-soft px-2.5 py-0.5 text-[0.6875rem] font-semibold text-danger">
                          {action.reasonLabel}
                        </span>
                      </div>
                      <p className="mt-1.5 text-small font-semibold text-fg">
                        <span className="font-bold">Action taken:</span> {action.label}
                        {action.durationDays ? ` · ${action.durationDays}-day suspension` : ""}
                      </p>
                      <p className="mt-1 text-tiny text-fg-subtle">Moderator: {action.moderatorName}</p>
                      <p className="mt-1 text-tiny text-fg-muted">Note: {action.reason}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <aside className="space-y-4">
          <section className="rounded-card border border-border bg-surface p-4">
            <h2 className="flex items-center gap-2 text-h3 text-fg"><ShieldAlert aria-hidden="true" className="size-4 text-danger" /> Account</h2>
            <p className="mt-1 text-small text-fg-muted">
              Suspensions revoke live sessions. Strikes expire 90 days after the action; a review decision is separate from an automatic ban.
            </p>
            {canReinstate && history.user.status === "SUSPENDED" ? (
              <div className="mt-3"><ReinstateForm studentId={history.user.id} /></div>
            ) : null}
          </section>
          <p className="text-tiny leading-relaxed text-fg-subtle">
            Reporters stay anonymous. Authors see the removal reason on the post and can link to the community rules.
          </p>
        </aside>
      </div>
    </div>
  );
}
