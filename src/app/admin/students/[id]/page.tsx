import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { requireUniversityRole } from "@/lib/auth/guards";
import { getStudentDetail } from "@/lib/services/admin";
import { DECISION_REASON_LABELS } from "@/lib/validation/schemas";
import { Card } from "@/components/ui/display";
import { UserStatusBadge } from "@/components/admin/status-badge";
import { StudentActions } from "@/components/admin/student-actions";

export const metadata: Metadata = { title: "Student" };

export default async function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUniversityRole(["UNIVERSITY_ADMIN"]);
  const { id } = await params;
  const detail = await getStudentDetail(user.universityId, id);
  if (!detail) notFound();
  const { student } = detail;

  const date = (value: Date | null) =>
    value ? new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(value) : "—";

  return (
    <div className="space-y-5">
      <Link href="/admin/students" className="inline-flex items-center gap-1.5 text-small font-semibold text-fg-muted hover:text-fg">
        <ArrowLeft aria-hidden="true" className="size-4" /> Students
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-14 items-center justify-center overflow-hidden rounded-full bg-surface-2 text-h3 font-bold text-fg-muted">
            {student.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={student.photoUrl} alt="" className="size-full object-cover" />
            ) : (
              student.fullName.slice(0, 1)
            )}
          </span>
          <div>
            <h1 className="text-h1 text-fg">{student.fullName}</h1>
            <p className="text-small text-fg-muted">@{student.username} · {student.email}</p>
          </div>
        </div>
        <UserStatusBadge status={student.status} />
      </header>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card className="p-4">
          <h2 className="text-h3 text-fg">Student record</h2>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-small">
            <div>
              <dt className="text-fg-subtle">Matric number</dt>
              <dd className="font-mono font-semibold text-fg">{student.matricNumber ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-fg-subtle">{detail.departmentName ?? "Department"}</dt>
              <dd className="font-semibold text-fg">{detail.departmentName ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-fg-subtle">Level</dt>
              <dd className="font-semibold text-fg">{student.level ? `${student.level}L` : "—"}</dd>
            </div>
            <div>
              <dt className="text-fg-subtle">Postgraduate</dt>
              <dd className="font-semibold text-fg">{student.isPostgraduate ? "Yes" : "No"}</dd>
            </div>
            <div>
              <dt className="text-fg-subtle">Joined</dt>
              <dd className="font-semibold text-fg">{date(student.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-fg-subtle">Verified</dt>
              <dd className="font-semibold text-fg">{date(student.verifiedAt)}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-fg-subtle">Bio</dt>
              <dd className="text-fg">{student.bio || "No bio yet."}</dd>
            </div>
          </dl>
        </Card>

        <div className="space-y-4">
          <Card className="p-4">
            <h2 className="text-h3 text-fg">Account actions</h2>
            <p className="mb-3 mt-1 text-small text-fg-muted">Every change is audited and revokes live sessions where needed.</p>
            <StudentActions userId={student.id} status={student.status} name={student.fullName} />
            {detail.lastAudit ? (
              <p className="mt-3 border-t border-border pt-3 text-[0.75rem] text-fg-subtle">
                Last admin action: {detail.lastAudit.action.replaceAll(".", " ").replaceAll("_", " ")} · {date(detail.lastAudit.createdAt)}
              </p>
            ) : null}
          </Card>

          <Card className="p-4">
            <h2 className="text-h3 text-fg">Verification history</h2>
            {student.verificationRequests.length === 0 ? (
              <p className="mt-2 text-small text-fg-muted">No requests yet.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {student.verificationRequests.map((request) => (
                  <li key={request.id} className="rounded-input bg-surface-2 px-3 py-2 text-small">
                    <div className="flex items-center justify-between gap-3">
                      <Link href={`/admin/verification/${request.id}`} className="font-semibold text-accent hover:underline">
                        {request.method.replaceAll("_", " ").toLowerCase()}
                      </Link>
                      <span className="font-semibold text-fg">{request.status.toLowerCase()}</span>
                    </div>
                    <p className="mt-0.5 text-[0.75rem] text-fg-subtle">
                      {date(request.createdAt)}
                      {request.decisionReason ? ` · ${DECISION_REASON_LABELS[request.decisionReason]}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
