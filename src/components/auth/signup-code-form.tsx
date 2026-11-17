"use client";

import { useActionState, useEffect, useState } from "react";
import {
  confirmAccountCodeAction,
  resendSignupCodeAction,
} from "@/app/(auth)/signup/[slug]/account/actions";
import { emptyFormState } from "@/lib/action-state";
import { Button } from "@/components/ui/button";
import { CodeInput } from "@/components/ui/code-input";
import { FormMessage } from "./auth-shell";

export function SignupCodeForm() {
  const [state, action, pending] = useActionState(confirmAccountCodeAction, emptyFormState);
  const [resendState, resendAction, resending] = useActionState(resendSignupCodeAction, emptyFormState);
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(60);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  useEffect(() => {
    if (resendState.ok) setCooldown(60);
  }, [resendState.ok, resendState.sentAt]);

  return (
    <div className="space-y-4">
      <form action={action} className="space-y-4">
        <input type="hidden" name="code" value={code} />
        <CodeInput
          value={code}
          onChange={setCode}
          label="Confirmation code"
          error={state.error}
          autoFocus
          onComplete={() => undefined}
        />
        <Button type="submit" fullWidth size="lg" loading={pending} loadingLabel="Confirming…" disabled={code.length !== 6}>
          Confirm and continue
        </Button>
      </form>

      <form action={resendAction} className="flex flex-col items-center gap-2">
        <Button
          type="submit"
          variant="ghost"
          size="sm"
          loading={resending}
          loadingLabel="Sending…"
          disabled={cooldown > 0}
        >
          {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
        </Button>
        {resendState.error ? <p className="text-small text-danger">{resendState.error}</p> : null}
        {resendState.ok ? <p className="text-small text-success">{resendState.message}</p> : null}
      </form>

      <FormMessage error={state.error} />
    </div>
  );
}
