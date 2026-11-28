import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight, ClipboardCheck, GraduationCap, Network, ShieldCheck, UserRoundCheck } from "lucide-react";
import { requireUniversityRole } from "@/lib/auth/guards";
import { getAdminOverview, listVerificationQueue } from "@/lib/services/admin";
import { isPlatformAdmin } from "@/lib/auth/guards";
import { Card } from "@/components/ui/display";
import { buttonStyles } from "@/components/ui/button-styles";

export const metadata = { title: "Overview" };

export default async function AdminOverviewPage() {
  const user = await requireUniversityRole(["UNIVERSITY_ADMIN", "REVIEWER", "MODERATOR"]);
  const isAdmin = user.roles.some(
    (role) => role.universityId === user.universityId && role.role === "UNIVERSITY_ADMIN",
  );
  const isReviewer = user.roles.some(
    (role) => role.universityId === user.universityId && role.role === "REVIEWER",
  );
  if (!isAdmin && !isReviewer) redirect("/admin/reports");
  const [stats, queue] = await Promise.all([
    getAdminOverview(user.universityId),
    listVerificationQueue(user.universityId, { status: "PENDING", method: "ALL", page: 1 }),
  ]);

  const cards = [
    { label: "Verified students", value: stats.verified, icon: UserRoundCheck, hint: `${stats.newThisWeek} in the last 7 days` },
    { label: "Waiting for review", value: stats.pending, icon: ClipboardCheck, hint: stats.pending === 0 ? "Queue is clear" : "Oldest first" },
    { label: "Departments", value: stats.departments, icon: Network, hint: "Active academic tree" },
    { label: "Reviewers & admins", value: stats.reviewers, icon: ShieldCheck, hint: "Staff with console access" },
    { label: "Alumni", value: stats.alumni, icon: GraduationCap, hint: "Keep their access, marked as alumni" },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-small font-semibold text-accent-ink">{user.university.shortName}</p>
          <h1 className="mt-0.5 text-h1 text-fg">University console</h1>
          <p className="mt-1 text-small text-fg-muted">
            {isAdmin ? "Verification, students and the shape of your campus space." : "The verification queue for your university."}
          </p>
        </div>
        <Link href="/admin/verification" className={buttonStyles({ variant: "primary" })}>
          Open queue
        </Link>
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
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

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3.5">
            <div>
              <h2 className="text-h3 text-fg">Next in the queue</h2>
              <p className="text-small text-fg-muted">Requests are shown oldest first.</p>
            </div>
            <Link href="/admin/verification" className="text-small font-semibold text-accent-ink hover:underline">
              See all
            </Link>
          </div>
          {queue.rows.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-small font-semibold text-fg">No requests waiting.</p>
              <p className="mt-1 text-small text-fg-muted">New submissions land here automatically.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {queue.rows.slice(0, 5).map((request) => (
                <li key={request.id}>
                  <Link
                    href={`/admin/verification/${request.id}`}
                    className="flex items-center gap-3 px-4 py-3 transition hover:bg-surface-2"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-bold text-fg-muted">
                      {request.user.fullName.slice(0, 1)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-small font-semibold text-fg">{request.user.fullName}</span>
                      <span className="block truncate text-[0.75rem] text-fg-subtle">
                        @{request.user.username} · {request.method.replaceAll("_", " ").toLowerCase()} ·{" "}
                        {request.matricNumber}
                      </span>
                    </span>
                    <ArrowUpRight aria-hidden="true" className="size-4 text-fg-subtle" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-4">
          <h2 className="text-h3 text-fg">Set up your space</h2>
          <p className="mt-1 text-small text-fg-muted">
            The academic tree drives the signup picker. Add faculties and departments before inviting students.
          </p>
          <ul className="mt-4 space-y-2 text-small">
            <li className="flex items-center justify-between gap-3 rounded-button bg-surface-2 px-3 py-2">
              <span className="text-fg-muted">Academic tree</span>
              <span className="font-semibold text-fg">{stats.departments} departments</span>
            </li>
            <li className="flex items-center justify-between gap-3 rounded-button bg-surface-2 px-3 py-2">
              <span className="text-fg-muted">Reviewers</span>
              <span className="font-semibold text-fg">{stats.reviewers}</span>
            </li>
            <li className="flex items-center justify-between gap-3 rounded-button bg-surface-2 px-3 py-2">
              <span className="text-fg-muted">Verification methods</span>
              <span className="font-semibold text-fg">
                {[user.university.idCardEnabled ? "ID card" : null, user.university.vouchingEnabled ? "Vouch" : null]
                  .filter(Boolean)
                  .join(" · ") || "Student email"}
              </span>
            </li>
          </ul>
          {isAdmin ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/admin/academic" className={buttonStyles({ variant: "secondary", size: "sm" })}>
                Edit tree
              </Link>
              <Link href="/admin/team" className={buttonStyles({ variant: "secondary", size: "sm" })}>
                Invite staff
              </Link>
              {isPlatformAdmin(user) ? (
                <Link href="/platform" className={buttonStyles({ variant: "ghost", size: "sm" })}>
                  Platform console
                </Link>
              ) : null}
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
