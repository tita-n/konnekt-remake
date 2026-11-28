import Link from "next/link";
import {
  AlertTriangle,
  Bookmark,
  CheckCircle2,
  Flag,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Repeat2,
  UserRound,
} from "lucide-react";
import type { ReportDetail, ReportQueueItem } from "@/lib/services/moderation";
import { formatReportDisplayId } from "@/lib/posts/card-presentation";
import { ReportActionForm } from "@/components/admin/report-action-form";
import { Avatar, VerifiedTick } from "@/components/ui/display";
import { cn, timeAgo } from "@/lib/utils";

const SEVERITY_STYLE = {
  high: "bg-danger-soft text-danger",
  medium: "bg-highlight-soft highlight-ink",
  low: "bg-success-soft text-success",
} as const;

export function ReportDetailPane({
  report,
  previewOnly = false,
}: {
  report: ReportDetail | null;
  previewOnly?: boolean;
}) {
  if (!report) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center rounded-card border border-border bg-surface p-8 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent-ink">
          <Flag aria-hidden="true" className="size-5" />
        </span>
        <p className="mt-3 font-display text-h3 text-fg">Select a report to review</p>
        <p className="mt-1 max-w-xs text-small text-fg-muted">
          Choose a report from the queue to view full post context, author strike history, and record an action.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-card border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-h2 font-bold text-fg">
          {report.targetType === "POST" ? "Reported post" : "Reported comment"}
        </h2>
        <span className="rounded-chip border border-border bg-surface-2/60 px-3 py-1 text-tiny font-medium text-fg-muted">
          Report ID: <strong className="text-fg">{formatReportDisplayId(report.id, report.createdAt)}</strong>
        </span>
      </div>

      {report.target ? (
        <div className="rounded-card border border-border bg-surface p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <Avatar name={report.target.authorName} seed={report.target.authorUsername} size="sm" />
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <span className="truncate text-small font-bold text-fg">{report.target.authorName}</span>
                  <VerifiedTick className="size-3.5" />
                </div>
                <p className="truncate text-tiny text-fg-subtle">
                  @{report.target.authorUsername} · {timeAgo(report.target.createdAt)}
                </p>
              </div>
            </div>
            <Link
              href={`/admin/students/${report.target.authorId}/moderation`}
              aria-label={`View ${report.target.authorName} moderation history`}
              className="flex size-10 items-center justify-center rounded-full text-fg-subtle hover:bg-surface-2"
            >
              <MoreHorizontal aria-hidden="true" className="size-4" />
            </Link>
          </div>

          <p className="mt-3 whitespace-pre-line text-small leading-relaxed text-fg">{report.target.body}</p>

          {report.target.media.length > 0 ? (
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {report.target.media.map((media) => (
                <li key={media.url} className="overflow-hidden rounded-[12px] border border-border bg-surface-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={media.url}
                    alt="Reported attachment"
                    width={media.width}
                    height={media.height}
                    className="max-h-48 w-full object-cover"
                  />
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-3 flex items-center justify-between border-t border-border/70 pt-2.5 text-tiny text-fg-subtle">
            <div className="flex items-center gap-5">
              <span className="inline-flex items-center gap-1"><MessageCircle aria-hidden="true" className="size-3.5" /> —</span>
              <span className="inline-flex items-center gap-1"><Repeat2 aria-hidden="true" className="size-3.5" /> —</span>
              <span className="inline-flex items-center gap-1"><Heart aria-hidden="true" className="size-3.5" /> —</span>
            </div>
            <Bookmark aria-hidden="true" className="size-3.5" />
          </div>
        </div>
      ) : (
        <div className="rounded-[14px] border border-border bg-surface-2 px-4 py-5 text-small text-fg-muted">
          This content no longer exists.
        </div>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
        <section className="rounded-[14px] border border-border bg-surface p-3.5">
          <h3 className="text-small font-bold text-fg">Reports</h3>
          <div className="mt-2.5 flex items-center justify-between gap-2 text-small">
            <span className="flex items-center gap-2 text-fg-muted">
              <Flag aria-hidden="true" className="size-3.5 text-fg-subtle" />
              {report.reasonLabel}
            </span>
            <span className="font-semibold tabular-nums text-fg">× {report.reporterCount}</span>
          </div>
          {report.details ? (
            <p className="mt-2.5 rounded-[10px] bg-surface-2 px-2.5 py-2 text-tiny text-fg-muted">
              {report.details}
            </p>
          ) : null}
        </section>

        <section className="rounded-[14px] border border-border bg-surface p-3.5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-small font-bold text-fg">Author history</h3>
            {report.target ? (
              <Link
                href={`/admin/students/${report.target.authorId}/moderation`}
                className="inline-flex min-h-11 items-center px-1 text-tiny font-semibold text-accent-ink hover:underline"
              >
                History
              </Link>
            ) : null}
          </div>
          <div className="mt-2.5 space-y-1.5 text-small">
            <p className="flex items-center gap-2 text-fg-muted">
              <UserRound aria-hidden="true" className="size-3.5 text-fg-subtle" />
              Previous reports: <strong className="text-fg">{report.target?.previousReports ?? 0}</strong>
            </p>
            <p className="flex items-center gap-2 text-fg-muted">
              <AlertTriangle aria-hidden="true" className="size-3.5 text-fg-subtle" />
              Strikes: <strong className="text-fg">{report.target?.activeStrikes ?? 0} of 3</strong>
            </p>
          </div>
        </section>
      </div>

      {report.status === "PENDING" ? (
        <ReportActionForm reportId={report.id} previewOnly={previewOnly} />
      ) : (
        <div role="status" className="flex items-center gap-2 rounded-[12px] bg-success-soft px-3.5 py-2.5 text-small font-semibold text-success">
          <CheckCircle2 aria-hidden="true" className="size-4" />
          This report has been resolved.
        </div>
      )}

      <section className="border-t border-border pt-4">
        <h3 className="text-small font-bold text-fg">Activity log</h3>
        <ol className="relative mt-3 space-y-3 pl-5 before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-px before:bg-border">
          <li className="relative">
            <span className="absolute -left-5 top-1.5 size-2.5 rounded-full bg-accent" aria-hidden="true" />
            <p className="text-small font-semibold text-fg">
              Reported <span className="font-normal text-fg-subtle">· {timeAgo(report.createdAt)}</span>
            </p>
            <p className="text-tiny text-fg-muted">
              {report.reporterCount} {report.reporterCount === 1 ? "student" : "students"} reported this content ({report.reasonLabel}).
            </p>
          </li>
          {report.activity.map((action) => (
            <li key={action.id} className="relative">
              <span className="absolute -left-5 top-1.5 size-2.5 rounded-full bg-fg-subtle" aria-hidden="true" />
              <p className="text-small font-semibold text-fg">
                {action.action.toLowerCase()} <span className="font-normal text-fg-subtle">· {timeAgo(action.createdAt)}</span>
              </p>
              <p className="text-tiny text-fg-muted">
                {action.moderatorName} · {action.reason}
              </p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

export function ReportsWorkspace({
  reports,
  selectedDetail,
  status,
  type,
  pendingCount,
  resolvedCount,
  previewOnly = false,
}: {
  reports: ReportQueueItem[];
  selectedDetail: ReportDetail | null;
  status: "PENDING" | "RESOLVED";
  type: "ALL" | "POST" | "COMMENT";
  pendingCount: number;
  resolvedCount: number;
  previewOnly?: boolean;
}) {
  const selectedId = selectedDetail?.id ?? reports[0]?.id ?? null;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start">
      <div className="space-y-3.5">
        <header>
          <h1 className="font-display text-h1 text-fg">Reports</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Report status">
            <Link
              href={`/admin/reports?status=PENDING&type=${type}`}
              aria-current={status === "PENDING" ? "page" : undefined}
              className={cn(
                "inline-flex h-10 items-center rounded-chip px-4 text-small font-semibold transition",
                status === "PENDING"
                  ? "bg-accent text-accent-fg"
                  : "border border-border bg-surface text-fg-muted hover:text-fg",
              )}
            >
              Pending ({pendingCount})
            </Link>
            <Link
              href={`/admin/reports?status=RESOLVED&type=${type}`}
              aria-current={status === "RESOLVED" ? "page" : undefined}
              className={cn(
                "inline-flex h-10 items-center rounded-chip px-4 text-small font-semibold transition",
                status === "RESOLVED"
                  ? "bg-accent text-accent-fg"
                  : "border border-border bg-surface text-fg-muted hover:text-fg",
              )}
            >
              Resolved ({resolvedCount})
            </Link>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5" role="group" aria-label="Report type">
            <span className="mr-1 text-tiny font-semibold text-fg-muted">Type:</span>
            {(
              [
                { value: "ALL", label: "All" },
                { value: "POST", label: "Posts" },
                { value: "COMMENT", label: "Comments" },
              ] as const
            ).map((item) => (
              <Link
                key={item.value}
                href={`/admin/reports?status=${status}&type=${item.value}`}
                aria-current={type === item.value ? "page" : undefined}
                className={cn(
                  "inline-flex -my-1.5 min-h-11 items-center rounded-chip px-3 text-tiny font-semibold transition",
                  type === item.value
                    ? "bg-accent text-accent-fg"
                    : "border border-border bg-surface text-fg-muted hover:text-fg",
                )}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </header>

        {reports.length === 0 ? (
          <div className="rounded-card border border-border bg-surface px-5 py-10 text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-success-soft text-success">
              <Flag aria-hidden="true" className="size-5" />
            </span>
            <h2 className="mt-3 text-h3 text-fg">Nothing waiting</h2>
            <p className="mt-1 text-small text-fg-muted">
              {status === "PENDING" ? "The queue is clear." : "No resolved reports in this view."}
            </p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {reports.map((report) => {
              const active = report.id === selectedId;
              return (
                <li key={report.id}>
                  <Link
                    href={`/admin/reports?status=${status}&type=${type}&selected=${report.id}`}
                    aria-current={active ? "true" : undefined}
                    className={cn(
                      "block rounded-card border bg-surface p-3.5 transition",
                      active
                        ? "border-accent ring-1 ring-accent/25"
                        : "border-border hover:border-border-strong",
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      <Avatar name={report.authorName} seed={report.authorUsername} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={cn("rounded-chip px-2 py-0.5 text-[0.6875rem] font-bold capitalize", SEVERITY_STYLE[report.severity])}>
                            {report.severity}
                          </span>
                          <span className="rounded-chip bg-accent-soft px-2 py-0.5 text-[0.6875rem] font-semibold text-accent-soft-fg">
                            {report.reasonLabel}
                          </span>
                          <span className="ml-auto text-[0.6875rem] font-medium text-fg-muted">
                            {report.reporterCount} {report.reporterCount === 1 ? "report" : "reports"}
                          </span>
                        </div>
                        <p className="mt-1.5 line-clamp-2 text-small leading-snug text-fg">
                          {report.excerpt || "Content unavailable"}
                        </p>
                        <p className="mt-1 text-[0.6875rem] text-fg-subtle">{timeAgo(report.createdAt)}</p>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="min-w-0">
        <ReportDetailPane report={selectedDetail} previewOnly={previewOnly} />
      </div>
    </div>
  );
}
