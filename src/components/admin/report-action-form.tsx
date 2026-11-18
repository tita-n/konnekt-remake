"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, ShieldAlert } from "lucide-react";
import { moderateReportAction, type ModerationFormState } from "@/app/admin/reports/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Decision = "REMOVE" | "KEEP" | "WARN" | "SUSPEND";

const emptyModerationState: ModerationFormState = { ok: false, error: null, message: null };

const ACTIONS: Array<{ value: Decision; label: string; destructive?: boolean }> = [
  { value: "REMOVE", label: "Remove", destructive: true },
  { value: "KEEP", label: "Keep" },
  { value: "WARN", label: "Warn author" },
  { value: "SUSPEND", label: "Suspend" },
];

export function ReportActionForm({ reportId }: { reportId: string }) {
  const [state, formAction, pending] = useActionState(moderateReportAction, emptyModerationState);
  const [decision, setDecision] = useState<Decision>("REMOVE");
  const [reason, setReason] = useState("");

  if (state.ok) {
    return (
      <div role="status" className="rounded-card border border-success/30 bg-success-soft p-4">
        <p className="flex items-start gap-2 text-small font-semibold text-success">
          <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {state.message}
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="reportId" value={reportId} />
      <input type="hidden" name="decision" value={decision} />

      <fieldset>
        <legend className="text-small font-semibold text-fg">Action</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {ACTIONS.map((action) => (
            <button
              key={action.value}
              type="button"
              aria-pressed={decision === action.value}
              onClick={() => setDecision(action.value)}
              className={cn(
                "flex min-h-11 items-center justify-center gap-1.5 rounded-button border px-2 text-small font-semibold transition",
                decision === action.value
                  ? action.destructive
                    ? "border-danger bg-danger-soft text-danger"
                    : "border-accent bg-accent-soft text-accent-soft-fg"
                  : "border-border bg-surface text-fg-muted hover:text-fg",
              )}
            >
              {action.label}
            </button>
          ))}
        </div>
      </fieldset>

      {decision === "SUSPEND" ? (
        <div>
          <label htmlFor="duration" className="text-small font-semibold text-fg">Suspension length</label>
          <select id="duration" name="duration" defaultValue="7" className="mt-1.5 h-11 w-full rounded-input border border-border bg-surface px-3 text-small text-fg">
            <option value="1">1 day</option>
            <option value="7">7 days</option>
            <option value="30">30 days</option>
            <option value="permanent">Permanent</option>
          </select>
        </div>
      ) : null}

      <div>
        <label htmlFor="moderation-reason" className="text-small font-semibold text-fg">Reason (required)</label>
        <textarea
          id="moderation-reason"
          name="reason"
          required
          minLength={8}
          maxLength={500}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={4}
          placeholder="e.g. Violates the community guidelines on harassment. First strike issued."
          className="mt-1.5 w-full resize-y rounded-input border border-border bg-surface px-3 py-2.5 text-small text-fg placeholder:text-fg-subtle focus:border-accent"
        />
        <p className="mt-1 text-right text-tiny text-fg-subtle">{reason.length}/500</p>
      </div>

      {state.error ? (
        <p role="alert" className="flex items-start gap-2 rounded-input border border-danger/30 bg-danger-soft px-3 py-2 text-small text-danger">
          <ShieldAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> {state.error}
        </p>
      ) : null}

      <Button type="submit" loading={pending} fullWidth variant={decision === "REMOVE" || decision === "SUSPEND" ? "destructive" : "primary"}>
        Record action
      </Button>
      <p className="text-tiny leading-relaxed text-fg-subtle">
        Remove and warn issue a strike that expires after 90 days. Three active strikes flag the account for admin
        review — it never auto-bans. Every action is written to the audit log.
      </p>
    </form>
  );
}
