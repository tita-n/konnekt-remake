"use client";

import { useActionState } from "react";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { reinstateStudentAction, type ModerationFormState } from "@/app/admin/reports/actions";
import { Button } from "@/components/ui/button";

const emptyModerationState: ModerationFormState = { ok: false, error: null, message: null };

export function ReinstateForm({ studentId }: { studentId: string }) {
  const [state, formAction, pending] = useActionState(reinstateStudentAction, emptyModerationState);
  if (state.ok) {
    return (
      <p role="status" className="flex items-center gap-2 rounded-input bg-success-soft px-3 py-2 text-small font-semibold text-success">
        <CheckCircle2 aria-hidden="true" className="size-4" /> {state.message}
      </p>
    );
  }
  return (
    <form action={formAction}>
      <input type="hidden" name="studentId" value={studentId} />
      {state.error ? <p role="alert" className="mb-2 text-small text-danger">{state.error}</p> : null}
      <Button type="submit" variant="secondary" loading={pending} leftIcon={<ShieldCheck aria-hidden="true" className="size-4" />}>
        Reinstate account
      </Button>
    </form>
  );
}
