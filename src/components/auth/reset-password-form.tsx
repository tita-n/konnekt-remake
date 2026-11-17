"use client";

import { useActionState, useState } from "react";
import { resetPasswordAction } from "@/app/(auth)/reset-password/actions";
import { emptyFormState } from "@/lib/action-state";
import { Button } from "@/components/ui/button";
import { PasswordField, PasswordStrengthMeter } from "@/components/ui/form-controls";
import { FormMessage } from "./auth-shell";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPasswordAction, emptyFormState);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div>
        <PasswordField
          label="New password"
          name="password"
          required
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={state.field === "password" ? state.error : null}
        />
        <PasswordStrengthMeter password={password} />
      </div>
      <PasswordField
        label="Repeat new password"
        name="confirm"
        required
        autoComplete="new-password"
        value={confirm}
        onChange={(event) => setConfirm(event.target.value)}
        error={state.field === "confirm" ? state.error : null}
      />
      <FormMessage error={state.error && !state.field ? state.error : null} />
      <Button type="submit" size="lg" fullWidth loading={pending} loadingLabel="Saving…">
        Choose new password
      </Button>
      <p className="text-center text-tiny text-fg-subtle">
        Signing in everywhere else will be stopped. You&apos;ll log in again with the new password.
      </p>
    </form>
  );
}
