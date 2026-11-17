"use client";

import { useActionState, useEffect, useState } from "react";
import { AlertCircle, Check, RotateCcw, ShieldOff, GraduationCap } from "lucide-react";
import { studentStatusAction } from "@/app/admin/actions";
import { emptyFormState } from "@/lib/action-state";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/overlays";

type Target = "SUSPENDED" | "VERIFIED" | "ALUMNI";

export function StudentActions({
  userId,
  status,
  name,
}: {
  userId: string;
  status: string;
  name: string;
}) {
  const [state, formAction, pending] = useActionState(studentStatusAction, emptyFormState);
  const [target, setTarget] = useState<Target | null>(null);
  const [reason, setReason] = useState("");

  const open = (next: Target) => {
    setReason("");
    setTarget(next);
  };

  useEffect(() => {
    if (state.ok) setTarget(null);
  }, [state.ok]);

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {status === "VERIFIED" ? (
          <>
            <Button variant="secondary" size="sm" onClick={() => open("ALUMNI")}>
              <GraduationCap aria-hidden="true" className="size-4" /> Mark alumni
            </Button>
            <Button variant="destructive" size="sm" onClick={() => open("SUSPENDED")}>
              <ShieldOff aria-hidden="true" className="size-4" /> Suspend
            </Button>
          </>
        ) : null}
        {status === "SUSPENDED" ? (
          <Button size="sm" onClick={() => open("VERIFIED")}>
            <RotateCcw aria-hidden="true" className="size-4" /> Reinstate
          </Button>
        ) : null}
      </div>

      {state.ok ? (
        <p role="status" className="mt-3 flex items-center gap-2 text-small font-semibold text-success">
          <Check aria-hidden="true" className="size-4" /> {state.message}
        </p>
      ) : null}
      {state.error && !target ? (
        <p role="alert" className="mt-3 rounded-input border border-danger/30 bg-danger-soft px-3 py-2 text-small text-danger">
          {state.error}
        </p>
      ) : null}

      <Dialog
        open={target !== null}
        onClose={() => setTarget(null)}
        title={target === "SUSPENDED" ? `Suspend ${name}?` : target === "ALUMNI" ? `Mark ${name} as alumni?` : `Reinstate ${name}?`}
        description={
          target === "SUSPENDED"
            ? "They lose access immediately and every session is revoked. You can reinstate them later."
            : target === "ALUMNI"
              ? "Their profile stays, but they are labelled alumni. They can still use the app."
              : "Their account returns to verified and they can sign in again."
        }
        destructive={target === "SUSPENDED"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setTarget(null)}>
              Cancel
            </Button>
            <form action={formAction}>
              <input type="hidden" name="userId" value={userId} />
              <input type="hidden" name="target" value={target ?? "VERIFIED"} />
              <input type="hidden" name="reason" value={reason} />
              <Button
                type="submit"
                loading={pending}
                variant={target === "SUSPENDED" ? "destructive" : "primary"}
              >
                {target === "SUSPENDED" ? "Suspend account" : target === "ALUMNI" ? "Mark alumni" : "Reinstate"}
              </Button>
            </form>
          </>
        }
      >
        {target === "SUSPENDED" || target === "ALUMNI" ? (
          <div>
            <label htmlFor="student-reason" className="mb-1.5 block text-small font-semibold text-fg">
              Reason <span className="text-danger">*</span>
            </label>
            <textarea
              id="student-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              required
              maxLength={300}
              placeholder="This is recorded in the audit log and shown to the student."
              className="w-full rounded-input border border-border bg-surface px-3 py-2 text-small text-fg placeholder:text-fg-subtle"
            />
            <p className="mt-1 text-right text-[0.6875rem] text-fg-subtle">{reason.length}/300</p>
          </div>
        ) : (
          <p className="text-small text-fg-muted">No reason needed to restore access.</p>
        )}
        {state.error ? (
          <p role="alert" className="mt-2 flex items-start gap-2 text-small text-danger">
            <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> {state.error}
          </p>
        ) : null}
      </Dialog>
    </div>
  );
}
