import Link from "next/link";
import type { Metadata } from "next";
import type { UserStatus } from "@prisma/client";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { requireUniversityRole } from "@/lib/auth/guards";
import { listStudents } from "@/lib/services/admin";
import { Card } from "@/components/ui/display";
import { UserStatusBadge } from "@/components/admin/status-badge";
import { buttonStyles } from "@/components/ui/button-styles";

export const metadata: Metadata = { title: "Students" };

const STATUSES = ["ALL", "VERIFIED", "PENDING", "SUSPENDED", "ALUMNI", "UNVERIFIED", "REJECTED"] as const;

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const user = await requireUniversityRole(["UNIVERSITY_ADMIN"]);
  const params = await searchParams;
  const q = params.q ?? "";
  const status = STATUSES.includes((params.status ?? "ALL") as (typeof STATUSES)[number])
    ? ((params.status ?? "ALL") as (typeof STATUSES)[number])
    : "ALL";
  const page = Number.parseInt(params.page ?? "1", 10) || 1;

  const result = await listStudents(user.universityId, {
    q,
    status: status as UserStatus | "ALL",
    page,
  });

  const pageHref = (nextPage: number) => {
    const search = new URLSearchParams();
    if (q) search.set("q", q);
    if (status !== "ALL") search.set("status", status);
    if (nextPage > 1) search.set("page", String(nextPage));
    const string = search.toString();
    return string ? `/admin/students?${string}` : "/admin/students";
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-h1 text-fg">Students</h1>
        <p className="mt-1 text-small text-fg-muted">Everyone with an account at your university, and where they stand.</p>
      </header>

      <Card className="p-3">
        <form action="/admin/students" method="get" className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label htmlFor="q" className="mb-1 block text-small font-semibold text-fg">Search</label>
            <div className="relative">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
              <input
                id="q"
                name="q"
                defaultValue={q}
                placeholder="Name, email, username or matric"
                className="h-10 w-full rounded-input border border-border bg-surface pl-9 pr-3 text-small text-fg placeholder:text-fg-subtle"
              />
            </div>
          </div>
          <div>
            <label htmlFor="status" className="mb-1 block text-small font-semibold text-fg">Status</label>
            <select id="status" name="status" defaultValue={status} className="h-10 rounded-input border border-border bg-surface px-3 text-small text-fg">
              {STATUSES.map((value) => (
                <option key={value} value={value}>
                  {value === "ALL" ? "All statuses" : value.charAt(0) + value.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className={buttonStyles({ variant: "secondary", size: "md" })}>Filter</button>
        </form>
      </Card>

      <p className="text-small text-fg-muted" role="status">
        {result.total} {result.total === 1 ? "account" : "accounts"}
      </p>

      {result.rows.length === 0 ? (
        <Card className="px-4 py-12 text-center">
          <p className="text-h3 text-fg">No students match.</p>
          <p className="mt-1 text-small text-fg-muted">Try clearing the filters.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-border">
            {result.rows.map((student) => (
              <li key={student.id}>
                <Link href={`/admin/students/${student.id}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-surface-2">
                  <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-2 text-small font-bold text-fg-muted">
                    {student.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={student.photoUrl} alt="" className="size-full object-cover" />
                    ) : (
                      student.fullName.slice(0, 1)
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-small font-semibold text-fg">
                      {student.fullName}
                      {student.roles.length > 0 ? (
                        <span className="ml-2 rounded-chip bg-surface-2 px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-wide text-fg-muted">
                          {student.roles[0]?.role.replaceAll("_", " ").toLowerCase()}
                        </span>
                      ) : null}
                    </span>
                    <span className="block truncate text-[0.75rem] text-fg-subtle">
                      @{student.username} · {student.departmentName ?? "No department"} · {student.level ? `${student.level}L` : "—"}
                    </span>
                  </span>
                  <span className="hidden shrink-0 sm:block">
                    <UserStatusBadge status={student.status} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {result.pageCount > 1 ? (
        <nav aria-label="Pagination" className="flex items-center justify-between gap-3">
          {result.page > 1 ? (
            <Link href={pageHref(result.page - 1)} className={buttonStyles({ variant: "secondary", size: "sm" })}>
              <ChevronLeft aria-hidden="true" className="size-4" /> Previous
            </Link>
          ) : <span />}
          <span className="text-small text-fg-muted">Page {result.page} of {result.pageCount}</span>
          {result.page < result.pageCount ? (
            <Link href={pageHref(result.page + 1)} className={buttonStyles({ variant: "secondary", size: "sm" })}>
              Next <ChevronRight aria-hidden="true" className="size-4" />
            </Link>
          ) : <span />}
        </nav>
      ) : null}
    </div>
  );
}
