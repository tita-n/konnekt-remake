import Link from "next/link";
import type { Metadata } from "next";
import type { UniversityStatus } from "@prisma/client";
import { Search } from "lucide-react";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { listPlatformUniversities } from "@/lib/services/platform";
import { Card } from "@/components/ui/display";
import { UniversityStatusBadge } from "@/components/admin/status-badge";
import { CreateUniversityForm } from "@/components/platform/create-university-form";
import { buttonStyles } from "@/components/ui/button-styles";

export const metadata: Metadata = { title: "Universities" };

const STATUSES = ["ALL", "ACTIVE", "WAITLIST", "OFF"] as const;

export default async function UniversitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  await requirePlatformAdmin();
  const params = await searchParams;
  const q = params.q ?? "";
  const status = STATUSES.includes((params.status ?? "ALL") as (typeof STATUSES)[number])
    ? ((params.status ?? "ALL") as (typeof STATUSES)[number])
    : "ALL";
  const universities = await listPlatformUniversities({ q, status: status as UniversityStatus | "ALL" });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-h1 text-fg">Universities</h1>
        <p className="mt-1 text-small text-fg-muted">Create spaces, switch them on, and control what each campus can do.</p>
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[1.35fr_1fr]">
        <div className="space-y-3">
          <Card className="p-3">
            <form action="/platform/universities" method="get" className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <label htmlFor="q" className="mb-1 block text-small font-semibold text-fg">Search</label>
                <div className="relative">
                  <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
                  <input id="q" name="q" defaultValue={q} placeholder="Name or slug" className="h-11 w-full rounded-input border border-border bg-surface pl-9 pr-3 text-small" />
                </div>
              </div>
              <div>
                <label htmlFor="status" className="mb-1 block text-small font-semibold text-fg">Status</label>
                <select id="status" name="status" defaultValue={status} className="h-11 rounded-input border border-border bg-surface px-3 text-small">
                  {STATUSES.map((value) => <option key={value} value={value}>{value === "ALL" ? "All" : value.toLowerCase()}</option>)}
                </select>
              </div>
              <button type="submit" className={buttonStyles({ variant: "secondary", size: "md" })}>Filter</button>
            </form>
          </Card>

          {universities.length === 0 ? (
            <Card className="px-4 py-12 text-center">
              <p className="text-h3 text-fg">No universities match.</p>
              <p className="mt-1 text-small text-fg-muted">Create the first one on the right.</p>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <ul className="divide-y divide-border">
                {universities.map((university) => (
                  <li key={university.id}>
                    <Link href={`/platform/universities/${university.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] text-[0.6875rem] font-bold" style={{ backgroundColor: university.accentColor, color: "#fff" }}>
                        {university.shortName.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-small font-semibold text-fg">{university.name}</span>
                        <span className="block truncate text-[0.75rem] text-fg-subtle">
                          {university.slug} · {university.userCount} accounts · {university.pendingCount} requests
                        </span>
                      </span>
                      <span className="hidden text-[0.75rem] text-fg-muted sm:block">
                        {[university.idCardEnabled ? "ID" : null, university.vouchingEnabled ? "Vouch" : null].filter(Boolean).join(" · ") || "Email"}
                      </span>
                      <UniversityStatusBadge status={university.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <Card className="h-fit p-4">
          <h2 className="text-h3 text-fg">Create a university</h2>
          <p className="mt-1 text-small text-fg-muted">It goes live immediately. Add its academic tree before inviting students.</p>
          <div className="mt-3">
            <CreateUniversityForm />
          </div>
        </Card>
      </div>
    </div>
  );
}
