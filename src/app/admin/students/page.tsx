import Link from "next/link";
import type { Metadata } from "next";
import type { UserStatus } from "@prisma/client";
import { ChevronLeft, ChevronRight, Search, SlidersHorizontal } from "lucide-react";
import { requireUniversityRole } from "@/lib/auth/guards";
import { tenantDb } from "@/lib/db/tenant";
import { getStudentDetail, getUniversitySettings, listStudents, PAGE_SIZE } from "@/lib/services/admin";
import { getStudentModerationHistory } from "@/lib/services/moderation";
import { maskMatricNumber } from "@/lib/posts/card-presentation";
import { Avatar, Card, VerifiedTick } from "@/components/ui/display";
import { StudentDetailsDrawer } from "@/components/admin/student-details-drawer";
import { buttonStyles } from "@/components/ui/button-styles";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Students" };

const STATUSES = ["ALL", "VERIFIED", "SUSPENDED", "PENDING", "ALUMNI", "UNVERIFIED", "REJECTED"] as const;

function tableStatusBadge(status: UserStatus) {
  switch (status) {
    case "VERIFIED":
      return { label: "Active", badge: "bg-success-soft text-success", dot: "bg-success-solid" };
    case "SUSPENDED":
      return { label: "Suspended", badge: "bg-danger-soft text-danger", dot: "bg-danger" };
    case "PENDING":
      return { label: "Pending", badge: "bg-highlight-soft highlight-ink", dot: "bg-highlight" };
    case "ALUMNI":
      return { label: "Alumni", badge: "bg-accent-soft text-accent-ink", dot: "bg-accent" };
    default:
      return { label: status.charAt(0) + status.slice(1).toLowerCase(), badge: "bg-surface-2 text-fg-muted", dot: "bg-fg-subtle" };
  }
}

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string; selected?: string }>;
}) {
  const user = await requireUniversityRole(["UNIVERSITY_ADMIN"]);
  const params = await searchParams;
  const q = params.q ?? "";
  const status = STATUSES.includes((params.status ?? "ALL") as (typeof STATUSES)[number])
    ? ((params.status ?? "ALL") as (typeof STATUSES)[number])
    : "ALL";
  const page = Number.parseInt(params.page ?? "1", 10) || 1;
  const selectedId = params.selected?.trim() || null;

  const [result, university, statusGroups, selectedHistory, selectedDetail] = await Promise.all([
    listStudents(user.universityId, { q, status: status as UserStatus | "ALL", page }),
    getUniversitySettings(user.universityId),
    tenantDb(user.universityId).user.groupBy({ by: ["status"], _count: { id: true } }),
    selectedId ? getStudentModerationHistory(user, selectedId) : Promise.resolve(null),
    selectedId ? getStudentDetail(user.universityId, selectedId) : Promise.resolve(null),
  ]);

  const countsByStatus = new Map<UserStatus, number>(statusGroups.map((row) => [row.status, row._count.id]));
  const totalAccounts = statusGroups.reduce((sum, row) => sum + row._count.id, 0);

  const buildHref = (opts: { nextPage?: number; nextStatus?: string; nextSelected?: string | null }) => {
    const search = new URLSearchParams();
    if (q) search.set("q", q);
    const targetStatus = opts.nextStatus ?? status;
    if (targetStatus !== "ALL") search.set("status", targetStatus);
    const targetPage = opts.nextPage ?? page;
    if (targetPage > 1) search.set("page", String(targetPage));
    const targetSelected = opts.nextSelected === undefined ? selectedId : opts.nextSelected;
    if (targetSelected) search.set("selected", targetSelected);
    const query = search.toString();
    return query ? `/admin/students?${query}` : "/admin/students";
  };

  const filterPills = [
    { key: "ALL", label: "All students", count: totalAccounts },
    { key: "VERIFIED", label: "Active", count: countsByStatus.get("VERIFIED") ?? 0 },
    { key: "SUSPENDED", label: "Suspended", count: countsByStatus.get("SUSPENDED") ?? 0 },
    { key: "PENDING", label: "Pending", count: countsByStatus.get("PENDING") ?? 0 },
  ] as const;

  const startIndex = result.total === 0 ? 0 : (result.page - 1) * PAGE_SIZE + 1;
  const endIndex = Math.min(result.total, result.page * PAGE_SIZE);

  return (
    <div className="relative space-y-5">
      <header>
        <h1 className="font-display text-h1 text-fg">Students</h1>
        <p className="mt-1 text-small text-fg-muted">
          Manage {university?.name ?? "university"} students on Konnekt.
        </p>
      </header>

      {/* Search + Filter bar */}
      <form action="/admin/students" method="get" className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        {status !== "ALL" ? <input type="hidden" name="status" value={status} /> : null}
        <div className="relative min-w-0 flex-1">
          <Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
          <input
            id="q"
            name="q"
            defaultValue={q}
            aria-label="Search students"
            placeholder="Search by name, matric number or department..."
            className="h-11 w-full rounded-full border border-border bg-surface pl-10 pr-4 text-small text-fg placeholder:text-fg-subtle focus:border-accent"
          />
        </div>
        <button
          type="submit"
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full border border-border bg-surface px-4 text-small font-semibold text-fg transition hover:bg-surface-2"
        >
          <SlidersHorizontal aria-hidden="true" className="size-4 text-fg-muted" />
          Filter
        </button>
      </form>

      {/* Status filter pills */}
      <div className="flex flex-wrap items-center gap-2" role="navigation" aria-label="Filter students by status">
        {filterPills.map((pill) => {
          const active = status === pill.key;
          return (
            <Link
              key={pill.key}
              href={buildHref({ nextStatus: pill.key, nextPage: 1, nextSelected: null })}
              className={cn(
                "inline-flex -my-1 min-h-11 items-center rounded-full px-3.5 text-small font-semibold transition",
                active
                  ? "bg-accent text-accent-fg shadow-sm"
                  : "border border-border bg-surface text-fg-muted hover:bg-surface-2 hover:text-fg",
              )}
            >
              {pill.label} ({pill.count.toLocaleString()})
            </Link>
          );
        })}
      </div>

      {result.rows.length === 0 ? (
        <Card className="px-4 py-12 text-center">
          <p className="text-h3 text-fg">No students match.</p>
          <p className="mt-1 text-small text-fg-muted">Try clearing the search or status filters.</p>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-[18px] border border-border bg-surface shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-small">
              <thead>
                <tr className="border-b border-border bg-surface-2/50 text-tiny font-semibold text-fg-muted">
                  <th className="w-10 px-4 py-3">
                    <span className="sr-only">Select</span>
                    <span aria-hidden="true" className="block size-4 rounded border border-border bg-surface" />
                  </th>
                  <th className="px-3 py-3">Student</th>
                  <th className="px-3 py-3">Matric No.</th>
                  <th className="px-3 py-3">Department</th>
                  <th className="px-3 py-3">Level</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {result.rows.map((student) => {
                  const isSelected = selectedHistory?.user.id === student.id;
                  const badge = tableStatusBadge(student.status);
                  return (
                    <tr
                      key={student.id}
                      className={cn(
                        "transition-colors",
                        isSelected ? "bg-accent-soft/65 ring-1 ring-inset ring-accent" : "hover:bg-surface-2/50",
                      )}
                    >
                      <td className="px-4 py-3.5">
                        <Link
                          href={buildHref({ nextSelected: isSelected ? null : student.id })}
                          aria-label={isSelected ? `Deselect ${student.fullName}` : `Select ${student.fullName}`}
                          className={cn(
                            "flex size-11 -m-3.5 items-center justify-center rounded border transition",
                            isSelected ? "border-accent bg-accent" : "border-border bg-surface",
                          )}
                        >
                          {isSelected ? <span className="size-1.5 rounded-full bg-white" /> : null}
                        </Link>
                      </td>
                      <td className="px-3 py-3.5">
                        <Link
                          href={buildHref({ nextSelected: student.id })}
                          className="flex min-h-11 items-center gap-3 focus:outline-none"
                        >
                          <Avatar name={student.fullName} seed={student.username} src={student.photoUrl} size="sm" />
                          <span className="min-w-0">
                            <span className="flex items-center gap-1 font-semibold text-fg">
                              <span className="truncate">{student.fullName}</span>
                              {student.status === "VERIFIED" || student.status === "ALUMNI" ? (
                                <VerifiedTick className="size-3.5" />
                              ) : null}
                            </span>
                            <span className="block truncate text-tiny text-fg-subtle">@{student.username}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3.5 font-mono text-tiny font-medium text-fg-muted">
                        {maskMatricNumber(student.matricNumber)}
                      </td>
                      <td className="px-3 py-3.5 text-fg-muted">{student.departmentName ?? "—"}</td>
                      <td className="whitespace-nowrap px-3 py-3.5 text-fg-muted">
                        {student.level ? `${student.level}L` : "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-tiny font-semibold", badge.badge)}>
                          <span className={cn("size-1.5 rounded-full", badge.dot)} aria-hidden="true" />
                          {badge.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Footer pagination */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <p className="text-small text-fg-muted" role="status">
          Showing {startIndex} – {endIndex} of {result.total.toLocaleString()} students
        </p>
        {result.pageCount > 1 ? (
          <nav aria-label="Pagination" className="flex items-center gap-1.5">
            {result.page > 1 ? (
              <Link
                href={buildHref({ nextPage: result.page - 1, nextSelected: null })}
                aria-label="Previous page"
                className={cn(buttonStyles({ variant: "secondary", size: "sm" }), "size-11 rounded-lg px-0")}
              >
                <ChevronLeft aria-hidden="true" className="size-4" />
              </Link>
            ) : null}
            {Array.from({ length: Math.min(3, result.pageCount) }, (_, idx) => idx + 1).map((pageNum) => (
              <Link
                key={pageNum}
                href={buildHref({ nextPage: pageNum, nextSelected: null })}
                aria-current={result.page === pageNum ? "page" : undefined}
                className={cn(
                  "flex size-11 items-center justify-center rounded-lg text-small font-semibold transition",
                  result.page === pageNum
                    ? "bg-accent text-accent-fg"
                    : "border border-border bg-surface text-fg-muted hover:bg-surface-2",
                )}
              >
                {pageNum}
              </Link>
            ))}
            {result.pageCount > 3 ? (
              <>
                <span className="px-1 text-small text-fg-subtle">…</span>
                <Link
                  href={buildHref({ nextPage: result.pageCount, nextSelected: null })}
                  className={cn(
                    "flex size-11 items-center justify-center rounded-lg text-small font-semibold transition",
                    result.page === result.pageCount
                      ? "bg-accent text-accent-fg"
                      : "border border-border bg-surface text-fg-muted hover:bg-surface-2",
                  )}
                >
                  {result.pageCount}
                </Link>
              </>
            ) : null}
            {result.page < result.pageCount ? (
              <Link
                href={buildHref({ nextPage: result.page + 1, nextSelected: null })}
                aria-label="Next page"
                className={cn(buttonStyles({ variant: "secondary", size: "sm" }), "size-11 rounded-lg px-0")}
              >
                <ChevronRight aria-hidden="true" className="size-4" />
              </Link>
            ) : null}
          </nav>
        ) : null}
      </div>

      {/* Slide-over student details drawer */}
      {selectedHistory ? (
        <div className="fixed inset-0 z-40 flex justify-end">
          <Link
            href={buildHref({ nextSelected: null })}
            aria-label="Dismiss student details backdrop"
            className="flex-1 bg-fg/25 backdrop-blur-[1px]"
          />
          <StudentDetailsDrawer
            history={selectedHistory}
            matricNumber={selectedDetail?.student.matricNumber ?? null}
            closeHref={buildHref({ nextSelected: null })}
          />
        </div>
      ) : null}
    </div>
  );
}

