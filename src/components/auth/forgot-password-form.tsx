"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { MailCheck } from "lucide-react";
import { forgotPasswordAction } from "@/app/(auth)/forgot-password/actions";
import { emptyFormState } from "@/lib/action-state";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/form-controls";
import { Turnstile } from "./turnstile";
import { FormMessage } from "./auth-shell";

export function ForgotPasswordForm({ siteKey }: { siteKey: string }) {
  const [state, action, pending] = useActionState(forgotPasswordAction, emptyFormState);
  const [token, setToken] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    if (state.error) setResetKey((value) => value + 1);
  }, [state.error]);

  if (state.ok) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-card border border-border bg-surface p-6 text-center" role="status">
        <MailCheck aria-hidden="true" className="size-9 text-accent" />
        <p className="text-[0.9375rem] font-semibold text-fg">Check your inbox</p>
        <p className="text-small text-fg-muted">{state.message}</p>
        <Link href="/login" className="mt-1 text-small font-semibold text-accent underline-offset-2 hover:underline">
          Back to log in
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="cf-turnstile-response" value={token ?? ""} />
      <TextField
        label="Email address"
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="you@student.edu.ng"
        error={state.field === "email" ? state.error : null}
        hint="We'll email a single-use link that expires in 30 minutes."
      />
      <Turnstile siteKey={siteKey} onToken={setToken} resetKey={resetKey} />
      <FormMessage error={state.error} />
      <Button type="submit" size="lg" fullWidth loading={pending} loadingLabel="Sending link…" disabled={Boolean(siteKey) && !token}>
        Send reset link
      </Button>
    </form>
  );
}
