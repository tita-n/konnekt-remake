"use client";

import { useActionState } from "react";
import Link from "next/link";
import { AlertCircle, Check } from "lucide-react";
import { acceptInviteAction } from "@/app/admin/actions";
import { emptyFormState } from "@/lib/action-state";
import { Button, buttonStyles } from "@/components/ui/button";

export function AcceptInviteForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(acceptInviteAction, emptyFormState);

  if (state.ok) {
    return (
      <div className="space-y-3">
        <p role="status" className="flex items-center gap-2 rounded-input border border-success/30 bg-success-soft px-3 py-2 text-small font-semibold text-success">
          <Check aria-hidden="true" className="size-4" /> {state.message}
        </p>
        <Link href="/admin" className={buttonStyles({ fullWidth: true })}>
          Open the console
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="token" value={token} />
      {state.error ? (
        <p role="alert" className="flex items-start gap-2 rounded-input border border-danger/30 bg-danger-soft px-3 py-2 text-small text-danger">
          <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> {state.error}
        </p>
      ) : null}
      <Button type="submit" loading={pending} fullWidth>
        Accept invitation
      </Button>
    </form>
  );
}
