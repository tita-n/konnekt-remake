import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, ExternalLink, ShieldAlert } from "lucide-react";
import { requireUniversityRole } from "@/lib/auth/guards";
import { getVerificationDetail } from "@/lib/services/admin";
import { DECISION_REASON_LABELS } from "@/lib/validation/schemas";
import { Card } from "@/components/ui/display";
import { Badge, RequestStatusBadge } from "@/components/admin/status-badge";
import { DecisionForm } from "@/components/admin/decision-form";
import { validateMatric } from "@/lib/domain/matric";

export const metadata: Metadata = { title: "Review request" };

export default async function VerificationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUniversityRole(["UNIVERSITY_ADMIN", "REVIEWER"]);
  const { id } = await params;
  const detail = await getVerificationDetail(user.universityId, id);
  if (!detail) notFound();

  const { request } = detail;
  const matric = validateMatric(request.matricNumber ?? "", detail.matricPattern);

  return (
    <div className="space-y-5">
      <Link href="/admin/verification" className="inline-flex items-center gap-1.5 text-small font-semibold text-fg-muted hover:text-fg">
        <ArrowLeft aria-hidden="true" className="size-4" /> Queue
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-h1 text-fg">{request.user.fullName}</h1>
          <p className="mt-1 text-small text-fg-muted">
            @{request.user.username} · {request.user.email}
          </p>
        </div>
        <RequestStatusBadge status={request.status} />
      </header>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <Card className="overflow-hidden">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-h3 text-fg">Submitted document</h2>
            <p className="text-small text-fg-muted">Only reviewers at your university can open this image.</p>
          </div>
          {request.idImageRef ? (
            <a
              href={`/api/admin/verification/${request.id}/image`}
              target="_blank"
              rel="noreferrer"
              className="group block bg-surface-2 p-3"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/admin/verification/${request.id}/image`}
                alt={`Student ID submitted by ${request.user.fullName}`}
                className="mx-auto max-h-[520px] w-auto rounded-input border border-border bg-surface object-contain"
              />
              <span className="mt-2 flex items-center justify-center gap-1.5 text-small font-semibold text-accent">
                Open full size <ExternalLink aria-hidden="true" className="size-3.5" />
              </span>
            </a>
          ) : (
            <div className="px-4 py-14 text-center text-small text-fg-muted">
              {request.method === "VOUCH" ? "Vouched request — no document." : "The document was removed after a decision."}
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card className="p-4">
            <h2 className="text-h3 text-fg">Check the details</h2>
            <dl className="mt-3 space-y-2.5 text-small">
              <div className="flex items-start justify-between gap-4">
                <dt className="text-fg-muted">Method</dt>
                <dd className="font-semibold text-fg">{request.method.replaceAll("_", " ").toLowerCase()}</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-fg-muted">Matric number</dt>
                <dd className="text-right">
                  <span className="block font-mono font-semibold text-fg">{request.matricNumber}</span>
                  <span className="mt-1 inline-block">
                    {matric.ok ? <Badge tone="success">Matches format</Badge> : <Badge tone="danger">Does not match format</Badge>}
                  </span>
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-fg-muted">{detail.labels.department}</dt>
                <dd className="text-right font-semibold text-fg">{detail.department?.name ?? "Not set yet"}</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-fg-muted">Submitted</dt>
                <dd className="text-right font-semibold text-fg">
                  {new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(request.createdAt)}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-fg-muted">Account since</dt>
                <dd className="text-right font-semibold text-fg">
                  {new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(request.user.createdAt)}
                </dd>
              </div>
              {request.method === "VOUCH" ? (
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-fg-muted">Vouched by</dt>
                  <dd className="text-right font-semibold text-fg">{request.voucher?.fullName ?? "Unknown"}</dd>
                </div>
              ) : null}
            </dl>

            {detail.duplicateMatric ? (
              <div className="mt-4 flex items-start gap-2 rounded-input border border-warning/30 bg-warning-soft px-3 py-2 text-small text-fg">
                <ShieldAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
                <p>
                  This matric number is already verified on{" "}
                  <Link href={`/admin/students?q=${encodeURIComponent(request.matricNumber ?? "")}`} className="font-semibold underline">
                    another account
                  </Link>
                  . Use the duplicate reason if this is the same person.
                </p>
              </div>
            ) : null}

            {detail.priorDecision ? (
              <p className="mt-4 rounded-input bg-surface-2 px-3 py-2 text-[0.75rem] text-fg-muted">
                Previous request {detail.priorDecision.status.toLowerCase()}
                {detail.priorDecision.decisionReason
                  ? `: ${DECISION_REASON_LABELS[detail.priorDecision.decisionReason]}`
                  : ""}
                .
              </p>
            ) : null}
          </Card>

          {request.status === "PENDING" ? (
            <Card className="p-4">
              <h2 className="text-h3 text-fg">Decide</h2>
              <p className="mb-3 mt-1 text-small text-fg-muted">
                Approving unlocks the app and lets them finish onboarding.
              </p>
              <DecisionForm requestId={request.id} />
            </Card>
          ) : (
            <Card className="p-4">
              <h2 className="text-h3 text-fg">Decision recorded</h2>
              <p className="mt-1 text-small text-fg-muted">
                {request.decidedAt
                  ? new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(request.decidedAt)
                  : ""}
                {request.reviewer ? ` · by ${request.reviewer.fullName}` : ""}
              </p>
              {request.decisionReason ? (
                <p className="mt-2 text-small text-fg">Reason: {DECISION_REASON_LABELS[request.decisionReason]}</p>
              ) : null}
              {request.decisionNote ? <p className="mt-1 text-small text-fg-muted">“{request.decisionNote}”</p> : null}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
