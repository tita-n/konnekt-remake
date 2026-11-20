import Link from "next/link";
import type { Metadata } from "next";
import type { VerificationMethod } from "@prisma/client";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { requireUniversityRole } from "@/lib/auth/guards";
import { listVerificationQueue } from "@/lib/services/admin";
import { Card } from "@/components/ui/display";
import { Badge, RequestStatusBadge } from "@/components/admin/status-badge";
import { buttonStyles } from "@/components/ui/button-styles";

export const metadata: Metadata = { title: "Verification queue" };

const STATUSES = ["PENDING", "APPROVED", "REJECTED", "ALL"] as const;
const METHODS = ["ALL", "ID_CARD", "STUDENT_EMAIL", "VOUCH"] as const;

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(value);
}

export default async function VerificationQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; method?: string; q?: string; page?: string }>;
}) {
  const user = await requireUniversityRole(["UNIVERSITY_ADMIN", "REVIEWER"]);
  const params = await searchParams;
  const status = STATUSES.includes((params.status ?? "PENDING") as (typeof STATUSES)[number])
    ? ((params.status ?? "PENDING") as (typeof STATUSES)[number])
    : "PENDING";
  const method = METHODS.includes((params.method ?? "ALL") as (typeof METHODS)[number])
    ? ((params.method ?? "ALL") as (typeof METHODS)[number])
    : "ALL";
  const page = Number.parseInt(params.page ?? "1", 10) || 1;
  const q = params.q ?? "";

  const result = await listVerificationQueue(user.universityId, {
    status,
    method: method as VerificationMethod | "ALL",
    q,
    page,
  });

  const query = (overrides: Record<string, string | number>) => {
    const next = new URLSearchParams();
    if (status !== "PENDING") next.set("status", status);
    if (method !== "ALL") next.set("method", method);
    if (q) next.set("q", q);
    Object.entries(overrides).forEach(([key, value]) => next.set(key, String(value)));
    next.delete("page");
    const pageValue = overrides.page;
    if (pageValue) next.set("page", String(pageValue));
    const string = next.toString();
    return string ? `/admin/verification?${string}` : "/admin/verification";
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-h1 text-fg">Verification queue</h1>
        <p className="mt-1 text-small text-fg-muted">
          Check the document against the matric number, then approve or decline. Images are destroyed on decision.
        </p>
      </header>

      <Card className="p-3">
        <form action="/admin/verification" method="get" className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label htmlFor="q" className="mb-1 block text-small font-semibold text-fg">
              Search
            </label>
            <div className="relative">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
              <input
                id="q"
                name="q"
                defaultValue={q}
                placeholder="Name, username or matric number"
                className="h-10 w-full rounded-input border border-border bg-surface pl-9 pr-3 text-small text-fg placeholder:text-fg-subtle"
              />
            </div>
          </div>
          <div>
            <label htmlFor="status" className="mb-1 block text-small font-semibold text-fg">
              Status
            </label>
            <select id="status" name="status" defaultValue={status} className="h-10 rounded-input border border-border bg-surface px-3 text-small text-fg">
              {STATUSES.map((value) => (
                <option key={value} value={value}>
                  {value === "ALL" ? "All statuses" : value.charAt(0) + value.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="method" className="mb-1 block text-small font-semibold text-fg">
              Method
            </label>
            <select id="method" name="method" defaultValue={method} className="h-10 rounded-input border border-border bg-surface px-3 text-small text-fg">
              {METHODS.map((value) => (
                <option key={value} value={value}>
                  {value === "ALL" ? "All methods" : value.replaceAll("_", " ").toLowerCase()}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className={buttonStyles({ variant: "secondary", size: "md" })}>
            Filter
          </button>
        </form>
      </Card>

      <p className="text-small text-fg-muted" role="status">
        {result.total} {result.total === 1 ? "request" : "requests"}
      </p>

      {result.rows.length === 0 ? (
        <Card className="px-4 py-12 text-center">
          <p className="text-h3 text-fg">Nothing here.</p>
          <p className="mt-1 text-small text-fg-muted">Try another filter, or wait for new submissions.</p>
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden overflow-hidden md:block">
            <table className="w-full text-left text-small">
              <caption className="sr-only">Verification requests</caption>
              <thead className="border-b border-border bg-surface-2 text-[0.6875rem] uppercase tracking-wide text-fg-subtle">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Student</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Matric</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Method</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Submitted</th>
                  <th scope="col" className="px-4 py-2.5 font-semibold">Status</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-semibold">Open</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {result.rows.map((request) => (
                  <tr key={request.id} className="hover:bg-surface-2/60">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-fg">{request.user.fullName}</p>
                      <p className="text-[0.75rem] text-fg-subtle">@{request.user.username}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-[0.75rem] text-fg-muted">{request.matricNumber}</td>
                    <td className="px-4 py-3">
                      <Badge>{request.method.replaceAll("_", " ").toLowerCase()}</Badge>
                    </td>
                    <td className="px-4 py-3 text-fg-muted">{formatDate(request.createdAt)}</td>
                    <td className="px-4 py-3"><RequestStatusBadge status={request.status} /></td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/admin/verification/${request.id}`} className="font-semibold text-accent-ink hover:underline">
                        Review
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Mobile list */}
          <ul className="space-y-2 md:hidden">
            {result.rows.map((request) => (
              <li key={request.id}>
                <Link href={`/admin/verification/${request.id}`} className="block rounded-card border border-border bg-surface p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-fg">{request.user.fullName}</p>
                      <p className="truncate text-[0.75rem] text-fg-subtle">@{request.user.username} · {request.matricNumber}</p>
                    </div>
                    <RequestStatusBadge status={request.status} />
                  </div>
                  <p className="mt-2 text-[0.75rem] text-fg-muted">
                    {request.method.replaceAll("_", " ").toLowerCase()} · {formatDate(request.createdAt)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      {result.pageCount > 1 ? (
        <nav aria-label="Pagination" className="flex items-center justify-between gap-3">
          {result.page > 1 ? (
            <Link href={query({ page: result.page - 1 })} className={buttonStyles({ variant: "secondary", size: "sm" })}>
              <ChevronLeft aria-hidden="true" className="size-4" /> Newer
            </Link>
          ) : <span />}
          <span className="text-small text-fg-muted">Page {result.page} of {result.pageCount}</span>
          {result.page < result.pageCount ? (
            <Link href={query({ page: result.page + 1 })} className={buttonStyles({ variant: "secondary", size: "sm" })}>
              Older <ChevronRight aria-hidden="true" className="size-4" />
            </Link>
          ) : <span />}
        </nav>
      ) : null}
    </div>
  );
}
