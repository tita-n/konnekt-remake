"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { loginAction } from "@/app/(auth)/login/actions";
import { emptyFormState } from "@/lib/action-state";
import { Button } from "@/components/ui/button";
import { PasswordField, TextField } from "@/components/ui/form-controls";
import { Turnstile } from "./turnstile";
import { FormMessage } from "./auth-shell";

export function LoginForm({ siteKey, next }: { siteKey: string; next?: string }) {
  const [state, action, pending] = useActionState(loginAction, emptyFormState);
  const [token, setToken] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    if (state.error) setResetKey((value) => value + 1);
  }, [state.error]);

  return (
    <form action={action} className="space-y-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <input type="hidden" name="cf-turnstile-response" value={token ?? ""} />

      <TextField
        label="Email or username"
        name="identifier"
        required
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        placeholder="you@student.edu.ng or @username"
        error={state.field === "identifier" ? state.error : null}
      />
      <div>
        <PasswordField
          label="Password"
          name="password"
          required
          autoComplete="current-password"
          error={state.field === "password" ? state.error : null}
        />
        <div className="mt-1.5 text-right">
          <Link href="/forgot-password" className="text-small font-semibold text-accent-ink underline-offset-2 hover:underline">
            Forgot password?
          </Link>
        </div>
      </div>

      <Turnstile siteKey={siteKey} onToken={setToken} resetKey={resetKey} />

      <FormMessage error={state.error} />

      <Button
        type="submit"
        size="lg"
        fullWidth
        loading={pending}
        loadingLabel="Logging in…"
        disabled={Boolean(siteKey) && !token}
      >
        Log in
      </Button>
    </form>
  );
}
