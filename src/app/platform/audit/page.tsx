import Link from "next/link";
import type { Metadata } from "next";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { queryAudit } from "@/lib/services/platform";
import { Card } from "@/components/ui/display";
import { Badge } from "@/components/admin/status-badge";
import { buttonStyles } from "@/components/ui/button-styles";

export const metadata: Metadata = { title: "Audit log" };

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; universityId?: string; page?: string }>;
}) {
  await requirePlatformAdmin();
  const params = await searchParams;
  const action = params.action ?? "";
  const universityId = params.universityId ?? "";
  const page = Number.parseInt(params.page ?? "1", 10) || 1;
  const result = await queryAudit({ action, universityId: universityId || undefined, page });

  const href = (nextPage: number) => {
    const search = new URLSearchParams();
    if (action) search.set("action", action);
    if (universityId) search.set("universityId", universityId);
    if (nextPage > 1) search.set("page", String(nextPage));
    const string = search.toString();
    return string ? `/platform/audit?${string}` : "/platform/audit";
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-h1 text-fg">Audit log</h1>
        <p className="mt-1 max-w-2xl text-small text-fg-muted">
          Append-only by database trigger. Admin and security actions, with no personal data in the metadata.
        </p>
      </header>

      <Card className="p-3">
        <form action="/platform/audit" method="get" className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label htmlFor="action" className="mb-1 block text-small font-semibold text-fg">Action contains</label>
            <div className="relative">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
              <input id="action" name="action" defaultValue={action} placeholder="verification, student.suspended…" className="h-10 w-full rounded-input border border-border bg-surface pl-9 pr-3 text-small" />
            </div>
          </div>
          <div>
            <label htmlFor="universityId" className="mb-1 block text-small font-semibold text-fg">University</label>
            <select id="universityId" name="universityId" defaultValue={universityId} className="h-11 rounded-input border border-border bg-surface px-3 text-small">
              <option value="">All universities</option>
              {result.universities.map((university) => (
                <option key={university.id} value={university.id}>{university.shortName}</option>
              ))}
            </select>
          </div>
          <button type="submit" className={buttonStyles({ variant: "secondary", size: "md" })}>Filter</button>
        </form>
      </Card>

      <p className="text-small text-fg-muted" role="status">{result.total} events</p>

      {result.rows.length === 0 ? (
        <Card className="px-4 py-12 text-center">
          <p className="text-h3 text-fg">No events match.</p>
          <p className="mt-1 text-small text-fg-muted">Try a broader action filter.</p>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-small">
            <caption className="sr-only">Audit events</caption>
            <thead className="border-b border-border bg-surface-2 text-[0.6875rem] uppercase tracking-wide text-fg-subtle">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-semibold">When</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Action</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Actor</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">University</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Target</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Metadata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {result.rows.map((event) => (
                <tr key={event.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-3 text-fg-muted">
                    {new Intl.DateTimeFormat("en-NG", { dateStyle: "short", timeStyle: "medium" }).format(event.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={event.action.startsWith("verification") || event.action.includes("suspended") ? "warning" : "neutral"}>
                      {event.action}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-fg">{event.actor?.fullName ?? "System"}</p>
                    <p className="text-[0.6875rem] text-fg-subtle">{event.actor?.email ?? "—"}</p>
                  </td>
                  <td className="px-4 py-3 text-fg-muted">{event.university?.shortName ?? "Platform"}</td>
                  <td className="px-4 py-3 text-fg-muted">
                    {event.targetType}
                    {/* Ids are opaque and never wrap usefully, so the cell truncates and carries the
                    full value as a title instead. */}
                    {event.targetId ? (
                      <span className="block max-w-[160px] truncate font-mono text-[0.6875rem]" title={event.targetId}>
                        {event.targetId}
                      </span>
                    ) : null}
                  </td>
                  <td className="max-w-[240px] px-4 py-3">
                    <code className="block break-all text-[0.6875rem] text-fg-subtle">{JSON.stringify(event.metadata)}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {result.pageCount > 1 ? (
        <nav aria-label="Pagination" className="flex items-center justify-between gap-3">
          {result.page > 1 ? (
            <Link href={href(result.page - 1)} className={buttonStyles({ variant: "secondary", size: "sm" })}>
              <ChevronLeft aria-hidden="true" className="size-4" /> Newer
            </Link>
          ) : <span />}
          <span className="text-small text-fg-muted">Page {result.page} of {result.pageCount}</span>
          {result.page < result.pageCount ? (
            <Link href={href(result.page + 1)} className={buttonStyles({ variant: "secondary", size: "sm" })}>
              Older <ChevronRight aria-hidden="true" className="size-4" />
            </Link>
          ) : <span />}
        </nav>
      ) : null}
    </div>
  );
}
