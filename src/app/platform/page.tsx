import Link from "next/link";
import type { Metadata } from "next";
import { Building2, ClipboardList, GraduationCap, HeartPulse, Inbox } from "lucide-react";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { getPlatformHealth, getPlatformOverview } from "@/lib/services/platform";
import { Card } from "@/components/ui/display";
import { UniversityStatusBadge } from "@/components/admin/status-badge";
import { buttonStyles } from "@/components/ui/button-styles";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Overview" };

const STATUS_TONE = {
  ok: "bg-success-soft text-success",
  warn: "bg-warning-soft text-warning",
  fail: "bg-danger-soft text-danger",
} as const;

export default async function PlatformOverviewPage() {
  await requirePlatformAdmin();
  const [overview, health] = await Promise.all([getPlatformOverview(), getPlatformHealth()]);

  const stats = [
    { label: "Live universities", value: overview.active, icon: Building2, hint: `${overview.universities} total` },
    { label: "Active students", value: overview.students, icon: GraduationCap, hint: "Verified + alumni" },
    { label: "Reviews pending", value: overview.pendingReviews, icon: Inbox, hint: "Across every campus" },
    { label: "Waitlist entries", value: overview.waitlistEntries, icon: ClipboardList, hint: "Universities + students" },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-small font-semibold text-accent-ink">Konnekt platform</p>
          <h1 className="mt-0.5 text-h1 text-fg">Everything, at a glance</h1>
          <p className="mt-1 text-small text-fg-muted">Campus spaces, queues and the health of the foundation.</p>
        </div>
        <Link href="/platform/universities" className={buttonStyles({ variant: "primary" })}>
          Manage universities
        </Link>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((card) => (
          <Card key={card.label} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <span className="flex size-11 items-center justify-center rounded-[10px] bg-accent-soft text-accent-soft-fg">
                <card.icon aria-hidden="true" className="size-[18px]" />
              </span>
              <span className="text-[1.75rem] font-bold leading-none tabular-nums text-fg">{card.value}</span>
            </div>
            <p className="mt-3 text-small font-semibold text-fg">{card.label}</p>
            <p className="text-[0.75rem] text-fg-subtle">{card.hint}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3.5">
            <h2 className="text-h3 text-fg">Campus spaces</h2>
            <Link href="/platform/universities" className="text-small font-semibold text-accent-ink hover:underline">Open list</Link>
          </div>
          <ul className="divide-y divide-border">
            {overview.byUniversity.slice(0, 8).map((university) => (
              <li key={university.id}>
                <Link href={`/platform/universities/${university.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                  <span className="flex size-8 items-center justify-center rounded-[9px] text-[0.6875rem] font-bold text-white" style={{ backgroundColor: university.accentColor }}>
                    {university.shortName.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-small font-semibold text-fg">{university.name}</span>
                    <span className="block text-[0.75rem] text-fg-subtle">
                      {university._count.users} accounts · {university._count.verificationRequests} requests
                    </span>
                  </span>
                  <UniversityStatusBadge status={university.status} />
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <HeartPulse aria-hidden="true" className="size-4 text-accent-ink" />
              <h2 className="text-h3 text-fg">System health</h2>
            </div>
            <p className="mt-1 text-small text-fg-muted">
              Database responds in {health.latencyMs} ms · {health.nodeEnv}
            </p>
            <ul className="mt-3 space-y-1.5">
              {health.checks.map((check) => (
                <li key={check.key} className="flex items-center justify-between gap-3 rounded-input bg-surface-2 px-3 py-2 text-small">
                  <span className="min-w-0">
                    <span className="block font-semibold text-fg">{check.label}</span>
                    <span className="block truncate text-[0.6875rem] text-fg-subtle">{check.detail}</span>
                  </span>
                  <span className={cn("shrink-0 rounded-chip px-2 py-0.5 text-[0.625rem] font-bold uppercase", STATUS_TONE[check.status])}>
                    {check.status}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-4">
            <h2 className="text-h3 text-fg">Recent admin activity</h2>
            {overview.recentAudit.length === 0 ? (
              <p className="mt-2 text-small text-fg-muted">No admin actions yet.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-small">
                {overview.recentAudit.map((event) => (
                  <li key={event.id}>
                    <p className="font-semibold text-fg">{event.action.replaceAll(".", " · ").replaceAll("_", " ")}</p>
                    <p className="text-[0.6875rem] text-fg-subtle">
                      {event.actor?.fullName ?? "System"}
                      {event.university ? ` · ${event.university.shortName}` : ""} ·{" "}
                      {new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(event.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/platform/audit" className={buttonStyles({ variant: "secondary", size: "sm", fullWidth: true, className: "mt-3" })}>
              Open audit log
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
}
