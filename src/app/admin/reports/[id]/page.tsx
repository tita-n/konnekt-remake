import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, ShieldAlert, UserRound } from "lucide-react";
import { requireUniversityRole } from "@/lib/auth/guards";
import { getReportDetail } from "@/lib/services/moderation";
import { ReportActionForm } from "@/components/admin/report-action-form";
import { cn, formatDate, timeAgo } from "@/lib/utils";

export const metadata: Metadata = { title: "Report" };
export const dynamic = "force-dynamic";

export default async function AdminReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUniversityRole(["UNIVERSITY_ADMIN", "MODERATOR"]);
  const { id } = await params;
  const report = await getReportDetail(user, id);
  if (!report) notFound();

  return (
    <div className="space-y-5">
      <Link href="/admin/reports" className="inline-flex items-center gap-1.5 text-small font-semibold text-fg-muted hover:text-fg">
        <ArrowLeft aria-hidden="true" className="size-4" /> Reports
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-small font-semibold text-accent">Report {report.id.slice(-8)}</p>
          <h1 className="mt-0.5 text-h1 text-fg">{report.reasonLabel}</h1>
          <p className="mt-1 text-small text-fg-muted">
            {report.reporterCount} {report.reporterCount === 1 ? "report" : "reports"} · {timeAgo(report.createdAt)}
          </p>
        </div>
        <span
          className={cn(
            "rounded-chip px-3 py-1.5 text-small font-bold uppercase tracking-wide",
            report.severity === "high" ? "bg-danger-soft text-danger" : report.severity === "medium" ? "bg-warning-soft text-warning" : "bg-surface-2 text-fg-muted",
          )}
        >
          {report.severity} severity
        </span>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <section className="rounded-card border border-border bg-surface p-4">
            <h2 className="text-h3 text-fg">{report.targetType === "POST" ? "Reported post" : "Reported comment"}</h2>
            {report.target ? (
              <>
                <div className="mt-3 flex items-center gap-2 text-small">
                  <span className="flex size-8 items-center justify-center rounded-full bg-surface-2 text-tiny font-bold text-fg-muted">
                    {report.target.authorName.slice(0, 1)}
                  </span>
                  <span className="font-semibold text-fg">{report.target.authorName}</span>
                  <span className="text-fg-subtle">@{report.target.authorUsername}</span>
                  <span className="ml-auto text-tiny text-fg-subtle">{formatDate(report.target.createdAt)}</span>
                </div>
                <p className="mt-3 whitespace-pre-line rounded-input bg-surface-2 px-3 py-2.5 text-small text-fg">{report.target.body}</p>
                {report.target.media.length > 0 ? (
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {report.target.media.map((media) => (
                      <li key={media.url}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={media.url} alt="Reported media" width={media.width} height={media.height} className="h-24 w-24 rounded-input object-cover" />
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="mt-3 flex flex-wrap items-center gap-2 text-small">
                  <Link href={`/admin/students/${report.target.authorId}/moderation`} className="inline-flex items-center gap-1 font-semibold text-accent hover:underline">
                    <UserRound aria-hidden="true" className="size-4" /> Moderation history
                  </Link>
                  <span className="text-fg-subtle">·</span>
                  <span className="text-fg-muted">{report.target.activeStrikes} active {report.target.activeStrikes === 1 ? "strike" : "strikes"}</span>
                </div>
              </>
            ) : (
              <p className="mt-2 text-small text-fg-muted">This content no longer exists.</p>
            )}
          </section>

          <section className="rounded-card border border-border bg-surface p-4">
            <h2 className="text-h3 text-fg">Reports</h2>
            <ul className="mt-2 space-y-2 text-small">
              <li className="flex items-center justify-between gap-3 rounded-input bg-surface-2 px-3 py-2">
                <span className="flex items-center gap-2 text-fg-muted"><ShieldAlert aria-hidden="true" className="size-4" /> {report.reasonLabel}</span>
                <span className="font-semibold text-fg">× {report.reporterCount}</span>
              </li>
              <li className="flex items-center justify-between gap-3 rounded-input bg-surface-2 px-3 py-2">
                <span className="text-fg-muted">Author&apos;s previous reports</span>
                <span className="font-semibold text-fg">{report.target?.previousReports ?? 0}</span>
              </li>
            </ul>
            {report.details ? <p className="mt-3 rounded-input border border-border px-3 py-2 text-small text-fg-muted">{report.details}</p> : null}
            <p className="mt-3 text-tiny text-fg-subtle">Reporter identities are never shown to authors or in this console.</p>
          </section>

          <section className="rounded-card border border-border bg-surface p-4">
            <h2 className="text-h3 text-fg">Activity log</h2>
            {report.activity.length === 0 ? (
              <p className="mt-2 text-small text-fg-muted">No moderation action has been recorded for this content yet.</p>
            ) : (
              <ol className="mt-3 space-y-3">
                {report.activity.map((action) => (
                  <li key={action.id} className="flex gap-3">
                    <span className="mt-1 size-2 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                    <div>
                      <p className="text-small font-semibold text-fg">{action.action.toLowerCase()} · {action.moderatorName}</p>
                      <p className="text-tiny text-fg-subtle">{timeAgo(action.createdAt)} · {action.reason}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
            <p className="mt-3 flex items-center gap-1.5 text-tiny text-fg-subtle">
              <Clock aria-hidden="true" className="size-3" /> All decisions are append-only in the audit log.
            </p>
          </section>
        </div>

        <section className="rounded-card border border-border bg-surface p-4 lg:sticky lg:top-20 lg:self-start">
          <h2 className="text-h3 text-fg">Decide</h2>
          <p className="mb-4 mt-1 text-small text-fg-muted">The author is told when content is removed and why.</p>
          {report.status === "PENDING" ? (
            <ReportActionForm reportId={report.id} />
          ) : (
            <p role="status" className="rounded-input bg-success-soft px-3 py-2 text-small font-semibold text-success">
              This report has been resolved.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
