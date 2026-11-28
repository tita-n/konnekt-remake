import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUniversityRole } from "@/lib/auth/guards";
import { getReportDetail } from "@/lib/services/moderation";
import { ReportDetailPane } from "@/components/admin/reports-workspace";

export const metadata: Metadata = { title: "Report" };
export const dynamic = "force-dynamic";

export default async function AdminReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUniversityRole(["UNIVERSITY_ADMIN", "MODERATOR"]);
  const { id } = await params;
  const report = await getReportDetail(user, id);
  if (!report) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link href="/admin/reports" className="inline-flex min-h-11 items-center gap-1.5 text-small font-semibold text-fg-muted hover:text-fg">
        <ArrowLeft aria-hidden="true" className="size-4" /> Reports
      </Link>
      <ReportDetailPane report={report} />
    </div>
  );
}

