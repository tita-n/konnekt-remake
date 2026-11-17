import Link from "next/link";
import type { Metadata } from "next";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { listWaitlist } from "@/lib/services/platform";
import { Card } from "@/components/ui/display";
import { Badge } from "@/components/admin/status-badge";
import { buttonStyles } from "@/components/ui/button-styles";

export const metadata: Metadata = { title: "Waitlist" };

const KINDS = ["ALL", "UNIVERSITY", "STUDENT"] as const;

export default async function WaitlistPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; page?: string }>;
}) {
  await requirePlatformAdmin();
  const params = await searchParams;
  const kind = KINDS.includes((params.kind ?? "ALL") as (typeof KINDS)[number])
    ? ((params.kind ?? "ALL") as (typeof KINDS)[number])
    : "ALL";
  const page = Number.parseInt(params.page ?? "1", 10) || 1;
  const result = await listWaitlist({ kind, page });

  const href = (nextPage: number) => {
    const search = new URLSearchParams();
    if (kind !== "ALL") search.set("kind", kind);
    if (nextPage > 1) search.set("page", String(nextPage));
    const string = search.toString();
    return string ? `/platform/waitlist?${string}` : "/platform/waitlist";
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-h1 text-fg">Waitlist</h1>
          <p className="mt-1 text-small text-fg-muted">Universities and students asking to be on Konnekt.</p>
        </div>
        <Link href="/platform/waitlist/export" className={buttonStyles({ variant: "secondary" })} prefetch={false}>
          <Download aria-hidden="true" className="size-4" /> Export CSV
        </Link>
      </header>

      <div className="flex flex-wrap gap-2" role="navigation" aria-label="Waitlist kind">
        {KINDS.map((value) => (
          <Link
            key={value}
            href={value === "ALL" ? "/platform/waitlist" : `/platform/waitlist?kind=${value}`}
            className={buttonStyles({
              variant: kind === value ? "primary" : "secondary",
              size: "sm",
            })}
          >
            {value === "ALL" ? "Everyone" : value === "UNIVERSITY" ? "Universities" : "Students"}
          </Link>
        ))}
      </div>

      <p className="text-small text-fg-muted" role="status">{result.total} entries</p>

      {result.rows.length === 0 ? (
        <Card className="px-4 py-12 text-center">
          <p className="text-h3 text-fg">Nothing on the waitlist yet.</p>
          <p className="mt-1 text-small text-fg-muted">Entries appear when someone asks for a university that is missing.</p>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-left text-small">
            <caption className="sr-only">Waitlist entries</caption>
            <thead className="border-b border-border bg-surface-2 text-[0.6875rem] uppercase tracking-wide text-fg-subtle">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-semibold">Kind</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">University</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Email</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Added</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {result.rows.map((entry) => (
                <tr key={entry.id}>
                  <td className="px-4 py-3">
                    <Badge tone={entry.kind === "UNIVERSITY" ? "accent" : "neutral"}>
                      {entry.kind.toLowerCase()}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-fg">{entry.universityName ?? "—"}</td>
                  <td className="px-4 py-3 text-fg-muted">{entry.email}</td>
                  <td className="px-4 py-3 text-fg-muted">
                    {new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(entry.createdAt)}
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
              <ChevronLeft aria-hidden="true" className="size-4" /> Previous
            </Link>
          ) : <span />}
          <span className="text-small text-fg-muted">Page {result.page} of {result.pageCount}</span>
          {result.page < result.pageCount ? (
            <Link href={href(result.page + 1)} className={buttonStyles({ variant: "secondary", size: "sm" })}>
              Next <ChevronRight aria-hidden="true" className="size-4" />
            </Link>
          ) : <span />}
        </nav>
      ) : null}
    </div>
  );
}
