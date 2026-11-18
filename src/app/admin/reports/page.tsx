import Link from "next/link";
import type { Metadata } from "next";
import { ArrowUpRight, Flag } from "lucide-react";
import { requireUniversityRole } from "@/lib/auth/guards";
import { listReports, reportSeverity } from "@/lib/services/moderation";
import { timeAgo } from "@/lib/utils";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Reports" };
export const dynamic = "force-dynamic";

const SEVERITY_STYLE = {
  high: "bg-danger-soft text-danger",
  medium: "bg-warning-soft text-warning",
  low: "bg-surface-2 text-fg-muted",
} as const;

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; type?: string }>;
}) {
  const user = await requireUniversityRole(["UNIVERSITY_ADMIN", "MODERATOR"]);
  const params = await searchParams;
  const status = params.status === "RESOLVED" ? "RESOLVED" : "PENDING";
  const type = params.type === "COMMENT" ? "COMMENT" : params.type === "POST" ? "POST" : "ALL";
  const reports = await listReports(user, { status, type });
  const pending = status === "PENDING" ? reports.length : undefined;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-small font-semibold text-accent">Moderation</p>
          <h1 className="mt-0.5 text-h1 text-fg">Reports</h1>
          <p className="mt-1 text-small text-fg-muted">Reviewed by severity, with the full context and author history.</p>
        </div>
        {pending !== undefined ? (
          <span className="inline-flex items-center gap-2 rounded-chip bg-accent-soft px-3 py-1.5 text-small font-semibold text-accent-soft-fg">
            <Flag aria-hidden="true" className="size-4" /> {pending} pending
          </span>
        ) : null}
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-chip border border-border bg-surface-2 p-1" role="group" aria-label="Report status">
          {(["PENDING", "RESOLVED"] as const).map((value) => (
            <Link
              key={value}
              href={`/admin/reports?status=${value}&type=${type}`}
              aria-current={status === value ? "page" : undefined}
              className={cn(
                "flex h-8 items-center rounded-chip px-3 text-small font-semibold capitalize",
                status === value ? "bg-surface text-fg shadow-card" : "text-fg-muted",
              )}
            >
              {value.toLowerCase()}
            </Link>
          ))}
        </div>
        <div className="inline-flex rounded-chip border border-border bg-surface-2 p-1" role="group" aria-label="Report type">
          {(["ALL", "POST", "COMMENT"] as const).map((value) => (
            <Link
              key={value}
              href={`/admin/reports?status=${status}&type=${value}`}
              aria-current={type === value ? "page" : undefined}
              className={cn(
                "flex h-8 items-center rounded-chip px-3 text-small font-semibold capitalize",
                type === value ? "bg-surface text-fg shadow-card" : "text-fg-muted",
              )}
            >
              {value.toLowerCase()}
            </Link>
          ))}
        </div>
      </div>

      {reports.length === 0 ? (
        <div className="rounded-card border border-border bg-surface px-5 py-12 text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-success-soft text-success">
            <Flag aria-hidden="true" className="size-6" />
          </span>
          <h2 className="mt-3 text-h3 text-fg">Nothing waiting</h2>
          <p className="mt-1 text-small text-fg-muted">{status === "PENDING" ? "The queue is clear." : "No resolved reports in this view."}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {reports.map((report) => (
            <li key={report.id}>
              <Link
                href={`/admin/reports/${report.id}`}
                className="block rounded-card border border-border bg-surface p-4 transition hover:border-accent/50 hover:bg-surface-2/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn("rounded-chip px-2 py-0.5 text-tiny font-bold uppercase tracking-wide", SEVERITY_STYLE[report.severity])}>
                        {report.severity}
                      </span>
                      <span className="text-small font-semibold text-fg">{report.reasonLabel}</span>
                      <span className="text-tiny text-fg-subtle">{report.reporterCount} {report.reporterCount === 1 ? "report" : "reports"}</span>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-small text-fg-muted">{report.excerpt || "Content unavailable"}</p>
                    <p className="mt-1 text-tiny text-fg-subtle">
                      {report.authorName} · @{report.authorUsername} · {timeAgo(report.createdAt)}
                    </p>
                  </div>
                  <ArrowUpRight aria-hidden="true" className="size-4 shrink-0 text-fg-subtle" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
