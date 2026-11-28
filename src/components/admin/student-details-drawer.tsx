"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Ban,
  BarChart2,
  Check,
  Copy,
  Eye,
  EyeOff,
  Flag,
  GraduationCap,
  MessageSquare,
  UserRound,
  X,
} from "lucide-react";
import { studentStatusAction } from "@/app/admin/actions";
import { emptyFormState } from "@/lib/action-state";
import { maskMatricNumber } from "@/lib/posts/card-presentation";
import type { StudentModerationHistory } from "@/lib/services/moderation";
import { Avatar, VerifiedTick } from "@/components/ui/display";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/overlays";
import { useToast } from "@/components/providers/toast-provider";
import { cn, formatDate } from "@/lib/utils";

function statusPillStyle(status: string): { label: string; badge: string; dot: string } {
  switch (status) {
    case "VERIFIED":
      return { label: "Active", badge: "bg-success-soft text-success", dot: "bg-success-solid" };
    case "SUSPENDED":
      return { label: "Suspended", badge: "bg-danger-soft text-danger", dot: "bg-danger" };
    case "PENDING":
      return { label: "Pending", badge: "bg-highlight-soft highlight-ink", dot: "bg-highlight" };
    case "ALUMNI":
      return { label: "Alumni", badge: "bg-accent-soft text-accent-ink", dot: "bg-accent" };
    default:
      return { label: status.charAt(0) + status.slice(1).toLowerCase(), badge: "bg-surface-2 text-fg-muted", dot: "bg-fg-subtle" };
  }
}

function historyReasonPill(reasonLabel: string): string {
  const lower = reasonLabel.toLowerCase();
  if (lower.includes("harass") || lower.includes("violen")) return "bg-danger-soft text-danger";
  if (lower.includes("hate") || lower.includes("abuse")) return "bg-highlight-soft highlight-ink";
  return "bg-accent-soft text-accent-ink";
}

export function StudentDetailsDrawer({
  history,
  matricNumber,
  closeHref,
  onClose,
  previewOnly = false,
}: {
  history: StudentModerationHistory;
  matricNumber: string | null;
  closeHref?: string;
  onClose?: () => void;
  previewOnly?: boolean;
}) {
  const { toast } = useToast();
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [reinstateOpen, setReinstateOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [localStatus, setLocalStatus] = useState(history.user.status);
  const [state, formAction, pending] = useActionState(studentStatusAction, emptyFormState);

  useEffect(() => {
    setLocalStatus(history.user.status);
    setRevealed(false);
    setCopied(false);
  }, [history.user.id, history.user.status]);

  useEffect(() => {
    if (state.ok) {
      setSuspendOpen(false);
      setReinstateOpen(false);
      setReason("");
      toast({ title: state.message ?? "Student status updated", variant: "success" });
    }
  }, [state.ok, state.message, toast]);

  const statusMeta = statusPillStyle(localStatus);
  const displayMatric = revealed ? (matricNumber ?? "—") : maskMatricNumber(matricNumber);
  const canSuspend = localStatus === "VERIFIED" || localStatus === "ALUMNI";
  const canReinstate = localStatus === "SUSPENDED";

  async function copyMatric() {
    if (!matricNumber) return;
    try {
      await navigator.clipboard.writeText(matricNumber);
      setCopied(true);
      toast({ title: "Matric number copied" });
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast({ title: "Couldn't copy matric number", variant: "error" });
    }
  }

  function submitPreview(target: "SUSPENDED" | "VERIFIED") {
    if (target === "SUSPENDED" && !reason.trim()) return;
    setLocalStatus(target);
    setSuspendOpen(false);
    setReinstateOpen(false);
    setReason("");
    toast({
      title: target === "SUSPENDED" ? `${history.user.fullName} suspended` : `${history.user.fullName} reinstated`,
      variant: "success",
    });
  }

  return (
    <aside
      aria-label="Student details"
      className="flex h-full w-full flex-col border-l border-border bg-surface shadow-modal lg:w-[500px] xl:w-[520px]"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h2 className="font-display text-h2 font-bold tracking-tight text-fg">Student details</h2>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close student details"
            className="flex size-11 items-center justify-center rounded-full text-fg-muted hover:bg-surface-2 hover:text-fg"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        ) : closeHref ? (
          <Link
            href={closeHref}
            aria-label="Close student details"
            className="flex size-11 items-center justify-center rounded-full text-fg-muted hover:bg-surface-2 hover:text-fg"
          >
            <X aria-hidden="true" className="size-5" />
          </Link>
        ) : null}
      </div>

      {/* Scrollable body */}
      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
        {/* Identity */}
        <div className="flex items-start gap-4">
          <Avatar name={history.user.fullName} seed={history.user.username} src={history.user.photoUrl} size="xl" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate font-display text-[1.125rem] font-bold text-fg">{history.user.fullName}</h3>
              {localStatus === "VERIFIED" || localStatus === "ALUMNI" ? <VerifiedTick className="size-4" /> : null}
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-small text-fg-muted">
              <span>
                Matric No.: <span className="font-mono font-medium text-fg">{displayMatric}</span>
              </span>
              {matricNumber ? (
                <>
                  <button
                    type="button"
                    onClick={copyMatric}
                    aria-label="Copy matric number"
                    className="inline-flex size-6 items-center justify-center rounded-md text-fg-subtle hover:bg-surface-2 hover:text-fg"
                  >
                    {copied ? <Check aria-hidden="true" className="size-3.5 text-success" /> : <Copy aria-hidden="true" className="size-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRevealed((prev) => !prev)}
                    aria-label={revealed ? "Hide matric number" : "Show matric number"}
                    className="inline-flex size-6 items-center justify-center rounded-md text-fg-subtle hover:bg-surface-2 hover:text-fg"
                  >
                    {revealed ? <EyeOff aria-hidden="true" className="size-3.5" /> : <Eye aria-hidden="true" className="size-3.5" />}
                  </button>
                </>
              ) : null}
            </div>

            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-tiny text-fg-muted">
              <span className="inline-flex items-center gap-1">
                <GraduationCap aria-hidden="true" className="size-3.5 text-fg-subtle" />
                {history.user.departmentName ?? "No department"}
              </span>
              <span aria-hidden="true" className="text-border">|</span>
              <span className="inline-flex items-center gap-1">
                <BarChart2 aria-hidden="true" className="size-3.5 text-fg-subtle" />
                {history.user.level ? `${history.user.level} Level` : "—"}
              </span>
            </p>

            <div className="mt-2.5 flex items-center gap-2">
              <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-tiny font-semibold", statusMeta.badge)}>
                <span className={cn("size-1.5 rounded-full", statusMeta.dot)} aria-hidden="true" />
                {statusMeta.label}
              </span>
              {!previewOnly ? (
                <Link href={`/admin/students/${history.user.id}`} className="text-tiny font-semibold text-accent-ink hover:underline">
                  Full record
                </Link>
              ) : null}
            </div>
          </div>
        </div>

        {/* Lavender 2-column metrics banner */}
        <div className="grid grid-cols-2 divide-x divide-accent/15 rounded-[14px] border border-accent/15 bg-accent-soft px-3 py-3">
          <div className="flex items-start gap-2.5 pr-3">
            <Flag aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-accent-ink" />
            <div>
              <p className="text-tiny font-medium text-fg-muted">Reports against:</p>
              <p className="mt-0.5 font-display text-[1.125rem] font-bold tabular-nums text-accent-ink">
                {history.reportsAgainst}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2.5 pl-4">
            <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-fg-muted" />
            <div>
              <p className="text-tiny font-medium text-fg-muted">Strikes:</p>
              <p className="mt-0.5 font-display text-[1.125rem] font-bold tabular-nums text-accent-ink">
                {history.activeStrikes} of 3
              </p>
            </div>
          </div>
        </div>

        {/* Moderation history timeline */}
        <section>
          <h3 className="font-display text-[1rem] font-bold text-fg">Moderation history</h3>
          {history.history.length === 0 ? (
            <p className="mt-2 rounded-[12px] border border-border bg-surface-2/40 px-3.5 py-4 text-small text-fg-muted">
              No moderation actions recorded for this student.
            </p>
          ) : (
            <ol className="mt-3 space-y-3">
              {history.history.map((action, index) => {
                const isLatest = index === 0;
                const isLast = index === history.history.length - 1;
                return (
                  <li key={action.id} className="relative pl-6">
                    <span
                      aria-hidden="true"
                      className={cn(
                        "absolute left-0 top-3.5 z-10 size-3 rounded-full ring-4 ring-surface",
                        isLatest ? "bg-accent" : "bg-fg-subtle/45",
                      )}
                    />
                    {!isLast ? (
                      <span aria-hidden="true" className="absolute bottom-[-1rem] left-[5px] top-6 w-px bg-border" />
                    ) : null}
                    <div
                      className={cn(
                        "rounded-[12px] border p-3.5",
                        isLatest ? "border-accent/15 bg-accent-soft/55" : "border-border bg-surface",
                      )}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-tiny font-semibold text-fg-muted">{formatDate(action.createdAt)}</span>
                        <span className={cn("rounded-full px-2.5 py-0.5 text-[0.6875rem] font-semibold", historyReasonPill(action.reasonLabel))}>
                          {action.reasonLabel}
                        </span>
                      </div>
                      <p className="mt-1.5 text-small font-semibold text-fg">
                        <span className="font-bold">Action taken:</span> {action.label}
                        {action.durationDays ? ` (${action.durationDays}d)` : ""}
                      </p>
                      <p className="mt-1 flex items-center gap-1.5 text-tiny text-fg-muted">
                        <UserRound aria-hidden="true" className="size-3.5 shrink-0 text-fg-subtle" />
                        <span>Moderator: {action.moderatorName}</span>
                      </p>
                      <p className="mt-1 flex items-start gap-1.5 text-tiny text-fg-muted">
                        <MessageSquare aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-fg-subtle" />
                        <span>Note: {action.reason}</span>
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>

      {/* Footer */}
      <div className="border-t border-border bg-surface px-5 py-4">
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={!canSuspend}
            onClick={() => {
              setReason("");
              setSuspendOpen(true);
            }}
            className="inline-flex h-11 items-center justify-center gap-1.5 rounded-button bg-danger-btn px-4 text-small font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Ban aria-hidden="true" className="size-4" />
            Suspend
          </button>
          <button
            type="button"
            disabled={!canReinstate}
            onClick={() => setReinstateOpen(true)}
            className="inline-flex h-11 items-center justify-center gap-1.5 rounded-button border border-border bg-surface px-4 text-small font-semibold text-accent-ink transition hover:bg-accent-soft/45 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Check aria-hidden="true" className="size-4" />
            Reinstate
          </button>
        </div>
      </div>

      {/* Suspend dialog */}
      <Dialog
        open={suspendOpen}
        onClose={() => setSuspendOpen(false)}
        title={`Suspend ${history.user.fullName}?`}
        description="They lose access immediately and every active session is revoked. You can reinstate them later."
        destructive
        footer={
          <>
            <Button variant="ghost" onClick={() => setSuspendOpen(false)}>
              Cancel
            </Button>
            {previewOnly ? (
              <Button variant="destructive" onClick={() => submitPreview("SUSPENDED")} disabled={!reason.trim()}>
                Suspend account
              </Button>
            ) : (
              <form action={formAction}>
                <input type="hidden" name="userId" value={history.user.id} />
                <input type="hidden" name="target" value="SUSPENDED" />
                <input type="hidden" name="reason" value={reason} />
                <Button type="submit" variant="destructive" loading={pending} disabled={!reason.trim()}>
                  Suspend account
                </Button>
              </form>
            )}
          </>
        }
      >
        <div>
          <label htmlFor="drawer-suspend-reason" className="mb-1.5 block text-small font-semibold text-fg">
            Reason <span className="text-danger">*</span>
          </label>
          <textarea
            id="drawer-suspend-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            required
            maxLength={300}
            placeholder="Recorded in the audit log and shown to the student."
            className="w-full rounded-[12px] border border-border bg-surface px-3 py-2 text-small text-fg placeholder:text-fg-subtle"
          />
          <p className="mt-1 text-right text-tiny text-fg-subtle">{reason.length}/300</p>
        </div>
        {state.error ? (
          <p role="alert" className="mt-2 flex items-start gap-2 text-small text-danger">
            <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> {state.error}
          </p>
        ) : null}
      </Dialog>

      {/* Reinstate dialog */}
      <Dialog
        open={reinstateOpen}
        onClose={() => setReinstateOpen(false)}
        title={`Reinstate ${history.user.fullName}?`}
        description="Their account returns to verified and they can sign in again."
        footer={
          <>
            <Button variant="ghost" onClick={() => setReinstateOpen(false)}>
              Cancel
            </Button>
            {previewOnly ? (
              <Button onClick={() => submitPreview("VERIFIED")}>Reinstate account</Button>
            ) : (
              <form action={formAction}>
                <input type="hidden" name="userId" value={history.user.id} />
                <input type="hidden" name="target" value="VERIFIED" />
                <Button type="submit" loading={pending}>
                  Reinstate account
                </Button>
              </form>
            )}
          </>
        }
      />
    </aside>
  );
}
