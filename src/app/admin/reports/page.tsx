import type { Metadata } from "next";
import { requireUniversityRole } from "@/lib/auth/guards";
import { tenantDb } from "@/lib/db/tenant";
import { getReportDetail, listReports } from "@/lib/services/moderation";
import { ReportsWorkspace } from "@/components/admin/reports-workspace";

export const metadata: Metadata = { title: "Reports" };
export const dynamic = "force-dynamic";

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; type?: string; selected?: string }>;
}) {
  const user = await requireUniversityRole(["UNIVERSITY_ADMIN", "MODERATOR"]);
  const params = await searchParams;
  const status = params.status === "RESOLVED" ? "RESOLVED" : "PENDING";
  const type = params.type === "COMMENT" ? "COMMENT" : params.type === "POST" ? "POST" : "ALL";
  const db = tenantDb(user.universityId);

  const [reports, pendingCount, resolvedCount] = await Promise.all([
    listReports(user, { status, type }),
    db.report.count({ where: { status: "PENDING" } }),
    db.report.count({ where: { status: "RESOLVED" } }),
  ]);

  const activeId = params.selected && reports.some((r) => r.id === params.selected) ? params.selected : reports[0]?.id;
  const selectedDetail = activeId ? await getReportDetail(user, activeId) : null;

  return (
    <ReportsWorkspace
      reports={reports}
      selectedDetail={selectedDetail}
      status={status}
      type={type}
      pendingCount={pendingCount}
      resolvedCount={resolvedCount}
    />
  );
}

