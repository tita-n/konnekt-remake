"use client";

import { useActionState, useState } from "react";
import {
  AlertTriangle,
  Ban,
  Check,
  CheckCircle2,
  ChevronDown,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { moderateReportAction, type ModerationFormState } from "@/app/admin/reports/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Decision = "REMOVE" | "KEEP" | "WARN" | "SUSPEND";
type Duration = "1" | "7" | "30" | "permanent";

const emptyModerationState: ModerationFormState = { ok: false, error: null, message: null };

const DURATIONS: Array<{ value: Duration; label: string }> = [
  { value: "1", label: "1 day" },
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "permanent", label: "Permanent" },
];

export function ReportActionForm({ reportId, previewOnly = false }: { reportId: string; previewOnly?: boolean }) {
  const [state, formAction, pending] = useActionState(moderateReportAction, emptyModerationState);
  const [decision, setDecision] = useState<Decision>("REMOVE");
  const [duration, setDuration] = useState<Duration>("7");
  const [suspendMenuOpen, setSuspendMenuOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [previewMessage, setPreviewMessage] = useState<string | null>(null);

  const effectiveMessage = state.ok ? state.message : previewMessage;

  if (effectiveMessage) {
    return (
      <div role="status" className="rounded-[12px] border border-success/30 bg-success-soft p-4">
        <p className="flex items-start gap-2 text-small font-semibold text-success">
          <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {effectiveMessage}
        </p>
      </div>
    );
  }

  return (
    <form
      action={previewOnly ? undefined : formAction}
      onSubmit={
        previewOnly
          ? (event) => {
              event.preventDefault();
              if (reason.trim().length >= 8) {
                setPreviewMessage(`Action recorded (${decision.toLowerCase()}).`);
              }
            }
          : undefined
      }
      className="space-y-4"
    >
      <input type="hidden" name="reportId" value={reportId} />
      <input type="hidden" name="decision" value={decision} />
      <input type="hidden" name="duration" value={duration} />

      <div>
        <div className="flex items-baseline justify-between">
          <label htmlFor="moderation-reason" className="text-small font-semibold text-fg">
            Reason <span className="font-normal text-fg-muted">(required)</span>
          </label>
        </div>
        <div className="relative mt-1.5">
          <textarea
            id="moderation-reason"
            name="reason"
            required
            minLength={8}
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            placeholder="Provide a reason for your action (e.g. violates community guidelines, harassment, spam, etc.)."
            className="w-full resize-y rounded-[12px] border border-border bg-surface px-3.5 py-2.5 pb-6 text-small text-fg placeholder:text-fg-subtle focus:border-accent"
          />
          <span className="pointer-events-none absolute bottom-2 right-3 text-[0.6875rem] tabular-nums text-fg-subtle">
            {reason.length} / 500
          </span>
        </div>
      </div>

      <fieldset>
        <legend className="sr-only">Action</legend>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-pressed={decision === "REMOVE"}
            onClick={() => { setDecision("REMOVE"); setSuspendMenuOpen(false); }}
            className={cn(
              "inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-button border px-3 text-small font-semibold transition",
              decision === "REMOVE"
                ? "border-danger bg-danger-soft text-danger"
                : "border-danger/30 bg-surface text-danger hover:bg-danger-soft/60",
            )}
          >
            <Trash2 aria-hidden="true" className="size-4" />
            Remove
          </button>

          <button
            type="button"
            aria-pressed={decision === "KEEP"}
            onClick={() => { setDecision("KEEP"); setSuspendMenuOpen(false); }}
            className={cn(
              "inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-button border px-3 text-small font-semibold transition",
              decision === "KEEP"
                ? "border-accent bg-accent-soft text-accent-ink"
                : "border-border bg-surface text-fg hover:bg-surface-2",
            )}
          >
            <Check aria-hidden="true" className="size-4" />
            Keep
          </button>

          <button
            type="button"
            aria-pressed={decision === "WARN"}
            onClick={() => { setDecision("WARN"); setSuspendMenuOpen(false); }}
            className={cn(
              "inline-flex h-11 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-button border px-3 text-small font-semibold transition",
              decision === "WARN"
                ? "border-accent bg-accent-soft text-accent-ink"
                : "border-border bg-surface text-fg hover:bg-surface-2",
            )}
          >
            <AlertTriangle aria-hidden="true" className="size-4" />
            Warn author
          </button>

          <div className="relative flex-1">
            <button
              type="button"
              aria-pressed={decision === "SUSPEND"}
              aria-expanded={suspendMenuOpen}
              onClick={() => {
                setDecision("SUSPEND");
                setSuspendMenuOpen((current) => !current);
              }}
              className={cn(
                "inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-button border px-3 text-small font-semibold transition",
                decision === "SUSPEND"
                  ? "border-accent bg-accent-soft text-accent-ink"
                  : "border-border bg-surface text-fg hover:bg-surface-2",
              )}
            >
              <Ban aria-hidden="true" className="size-4" />
              <span>Suspend</span>
              <ChevronDown aria-hidden="true" className="size-3.5 opacity-70" />
            </button>

            {suspendMenuOpen ? (
              <div
                role="menu"
                aria-label="Suspension length"
                className="absolute right-0 top-12 z-20 w-36 overflow-hidden rounded-[12px] border border-border bg-surface p-1 shadow-floating"
              >
                {DURATIONS.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    role="menuitemradio"
                    aria-checked={duration === item.value}
                    onClick={() => {
                      setDecision("SUSPEND");
                      setDuration(item.value);
                      setSuspendMenuOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between rounded-[8px] px-3 py-2 text-left text-small font-medium",
                      duration === item.value ? "bg-accent-soft text-accent-ink font-semibold" : "text-fg hover:bg-surface-2",
                    )}
                  >
                    <span>{item.label}</span>
                    {duration === item.value ? <Check aria-hidden="true" className="size-3.5" /> : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </fieldset>

      {decision === "SUSPEND" ? (
        <p className="text-tiny text-fg-muted">
          Selected suspension: <strong className="text-fg">{DURATIONS.find((d) => d.value === duration)?.label}</strong>
        </p>
      ) : null}

      {state.error ? (
        <p role="alert" className="flex items-start gap-2 rounded-[10px] border border-danger/30 bg-danger-soft px-3 py-2 text-small text-danger">
          <ShieldAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> {state.error}
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <p className="text-tiny text-fg-subtle">
          Written to the append-only audit log.
        </p>
        <Button
          type="submit"
          loading={pending}
          variant={decision === "REMOVE" || decision === "SUSPEND" ? "destructive" : "primary"}
          className="rounded-full px-5"
        >
          Record action
        </Button>
      </div>
    </form>
  );
}

