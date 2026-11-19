import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, ScrollText } from "lucide-react";
import { requireUniversityRole } from "@/lib/auth/guards";
import { tenantDb } from "@/lib/db/tenant";
import { Card } from "@/components/ui/display";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Audit log" };
export const dynamic = "force-dynamic";

function formatMetadata(metadata: unknown): string {
  if (!metadata || typeof metadata !== "object") return "—";
  const entries = Object.entries(metadata as Record<string, unknown>).filter(([, v]) => v !== null && v !== undefined && v !== "");
  if (entries.length === 0) return "—";
  return entries
    .map(([key, value]) => `${key}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`)
    .join(" · ");
}

export default async function AdminAuditPage() {
  const user = await requireUniversityRole(["UNIVERSITY_ADMIN", "MODERATOR"]);
  const logs = await tenantDb(user.universityId).auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      actor: { select: { fullName: true, username: true } },
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin/students" className="inline-flex items-center gap-1.5 text-small font-semibold text-fg-muted hover:text-fg">
            <ArrowLeft aria-hidden="true" className="size-4" /> Students
          </Link>
          <h1 className="mt-2 font-display text-h1 text-fg">Audit log</h1>
          <p className="mt-1 text-small text-fg-muted">
            Chronological record of moderation and administrative actions in this university.
          </p>
        </div>
      </div>

      {logs.length === 0 ? (
        <Card className="px-6 py-12 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent">
            <ScrollText aria-hidden="true" className="size-5" />
          </span>
          <p className="mt-3 font-display text-h3 text-fg">No audit entries yet</p>
          <p className="mt-1 text-small text-fg-muted">Actions taken by admins and moderators appear here automatically.</p>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-[18px] border border-border bg-surface shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-small">
              <thead>
                <tr className="border-b border-border bg-surface-2/60 text-tiny font-semibold uppercase tracking-wide text-fg-muted">
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Target</th>
                  <th className="px-4 py-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.map((entry) => (
                  <tr key={entry.id} className="hover:bg-surface-2/40">
                    <td className="whitespace-nowrap px-4 py-3 text-tiny font-medium text-fg-muted">
                      {formatDate(entry.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      {entry.actor ? (
                        <div>
                          <p className="font-semibold text-fg">{entry.actor.fullName}</p>
                          <p className="text-tiny text-fg-subtle">@{entry.actor.username}</p>
                        </div>
                      ) : (
                        <span className="text-fg-subtle">System</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-tiny font-semibold text-accent">
                        {entry.action.replaceAll(".", " · ")}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-tiny text-fg-muted">
                      {entry.targetType}
                      {entry.targetId ? `:${entry.targetId.slice(0, 8)}` : ""}
                    </td>
                    <td className="max-w-md truncate px-4 py-3 text-tiny text-fg-muted">
                      {formatMetadata(entry.metadata)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
