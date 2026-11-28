"use client";

import { useActionState, useState } from "react";
import { AlertCircle, Check, X } from "lucide-react";
import { decideVerificationAction } from "@/app/admin/actions";
import { emptyFormState } from "@/lib/action-state";
import { DECISION_REASON_LABELS } from "@/lib/validation/schemas";
import { Button } from "@/components/ui/button";

const REASONS = Object.entries(DECISION_REASON_LABELS);

export function DecisionForm({ requestId }: { requestId: string }) {
  const [state, formAction, pending] = useActionState(decideVerificationAction, emptyFormState);
  const [decision, setDecision] = useState<"approve" | "reject">("approve");
  const [note, setNote] = useState("");

  if (state.ok) {
    return (
      <div role="status" className="rounded-card border border-success/30 bg-success-soft p-4">
        <p className="flex items-center gap-2 text-small font-semibold text-success">
          <Check aria-hidden="true" className="size-4" /> {state.message}
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="decision" value={decision} />

      <fieldset>
        <legend className="text-small font-semibold text-fg">Decision</legend>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label
            className={`flex cursor-pointer items-center justify-center gap-2 rounded-button border px-3 py-2.5 text-small font-semibold transition ${
              decision === "approve" ? "border-success bg-success-soft text-success" : "border-border bg-surface text-fg-muted"
            }`}
          >
            <input
              type="radio"
              name="decisionChoice"
              value="approve"
              checked={decision === "approve"}
              onChange={() => setDecision("approve")}
              className="sr-only"
            />
            <Check aria-hidden="true" className="size-4" /> Approve
          </label>
          <label
            className={`flex cursor-pointer items-center justify-center gap-2 rounded-button border px-3 py-2.5 text-small font-semibold transition ${
              decision === "reject" ? "border-danger bg-danger-soft text-danger" : "border-border bg-surface text-fg-muted"
            }`}
          >
            <input
              type="radio"
              name="decisionChoice"
              value="reject"
              checked={decision === "reject"}
              onChange={() => setDecision("reject")}
              className="sr-only"
            />
            <X aria-hidden="true" className="size-4" /> Decline
          </label>
        </div>
      </fieldset>

      {decision === "reject" ? (
        <div>
          <label htmlFor="reason" className="mb-1.5 block text-small font-semibold text-fg">
            Reason <span className="text-danger">*</span>
          </label>
          <select
            id="reason"
            name="reason"
            required
            className="h-11 w-full rounded-input border border-border bg-surface px-3 text-[0.9375rem] text-fg"
          >
            <option value="">Choose a reason…</option>
            {REASONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[0.75rem] text-fg-subtle">The student sees this reason in their email.</p>
        </div>
      ) : null}

      <div>
        <label htmlFor="note" className="mb-1.5 block text-small font-semibold text-fg">
          Note to the student <span className="font-normal text-fg-subtle">(optional)</span>
        </label>
        <textarea
          id="note"
          name="note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={300}
          rows={3}
          className="w-full rounded-input border border-border bg-surface px-3.5 py-2.5 text-[0.9375rem] text-fg placeholder:text-fg-subtle"
          placeholder={
            decision === "approve"
              ? "Anything they should know?"
              : "e.g. The name on the card is cut off — send a clearer photo."
          }
        />
        <p className="mt-1 text-right text-[0.6875rem] text-fg-subtle">{note.length}/300</p>
      </div>

      {state.error ? (
        <p role="alert" className="flex items-start gap-2 rounded-input border border-danger/30 bg-danger-soft px-3 py-2 text-small text-danger">
          <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> {state.error}
        </p>
      ) : null}

      <Button type="submit" loading={pending} fullWidth variant={decision === "reject" ? "destructive" : "primary"}>
        {decision === "approve" ? "Approve student" : "Decline request"}
      </Button>
      <p className="text-center text-[0.6875rem] text-fg-subtle">
        The ID image is permanently deleted when you submit. This decision is audited.
      </p>
    </form>
  );
}
