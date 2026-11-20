"use client";

import { useActionState, useEffect, useState } from "react";
import { CheckCircle2, KeyRound, Mail, Trash2 } from "lucide-react";
import {
  changePasswordAction,
  changeUsernameAction,
  confirmEmailChangeAction,
  deleteAccountAction,
  requestEmailChangeAction,
} from "@/app/(shell)/settings/account/actions";
import { emptyFormState } from "@/lib/action-state";
import { Button } from "@/components/ui/button";
import { Checkbox, PasswordField, TextField } from "@/components/ui/form-controls";
import { Dialog } from "@/components/ui/overlays";
import { FormMessage } from "@/components/auth/auth-shell";

export function AccountSettings({
  email,
  username,
  emailVerified,
}: {
  email: string;
  username: string;
  emailVerified: boolean;
}) {
  const [usernameState, usernameAction, usernamePending] = useActionState(changeUsernameAction, emptyFormState);
  const [passwordState, passwordAction, passwordPending] = useActionState(changePasswordAction, emptyFormState);
  const [emailState, emailAction, emailPending] = useActionState(requestEmailChangeAction, emptyFormState);
  const [confirmState, confirmAction, confirmPending] = useActionState(confirmEmailChangeAction, emptyFormState);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteAccountAction, emptyFormState);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [emailStep, setEmailStep] = useState<"idle" | "code">("idle");

  useEffect(() => {
    if (emailState.step === "code") setEmailStep("code");
  }, [emailState.step]);

  useEffect(() => {
    if (confirmState.ok) setEmailStep("idle");
  }, [confirmState.ok]);

  return (
    <div className="space-y-5">
      <section className="rounded-card border border-border bg-surface p-4">
        <h2 className="flex items-center gap-2 text-h3 text-fg">
          <Mail aria-hidden="true" className="size-4 text-accent-ink" />
          Email
        </h2>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-small text-fg-muted">
          {email}
          {emailVerified ? (
            <span className="inline-flex items-center gap-1 rounded-chip bg-success-soft px-2 py-0.5 text-tiny font-semibold text-success">
              <CheckCircle2 aria-hidden="true" className="size-3" />
              Verified
            </span>
          ) : null}
        </p>

        {emailStep === "idle" ? (
          <details className="mt-3">
            <summary className="cursor-pointer text-small font-semibold text-accent-ink">Change email</summary>
            <form action={emailAction} className="mt-3 space-y-3">
              <TextField label="New email" name="email" type="email" required autoComplete="email" />
              <PasswordField label="Your password" name="password" required autoComplete="current-password" />
              <FormMessage error={emailState.error} />
              <Button type="submit" variant="secondary" size="sm" loading={emailPending} loadingLabel="Sending code…">
                Send confirmation code
              </Button>
            </form>
          </details>
        ) : (
          <form action={confirmAction} className="mt-3 space-y-3 rounded-card bg-surface-2 p-3">
            <p className="text-small text-fg-muted">
              Enter the 6-digit code sent to <span className="font-semibold text-fg">{emailState.email}</span>.
            </p>
            <input type="hidden" name="email" value={emailState.email ?? ""} />
            <TextField label="6-digit code" name="code" inputMode="numeric" maxLength={6} required autoComplete="one-time-code" />
            <FormMessage error={confirmState.error} message={confirmState.ok ? confirmState.message : null} />
            <div className="flex gap-2">
              <Button type="submit" size="sm" loading={confirmPending} loadingLabel="Confirming…">
                Confirm new email
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setEmailStep("idle")}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </section>

      <section className="rounded-card border border-border bg-surface p-4">
        <h2 className="flex items-center gap-2 text-h3 text-fg">
          <KeyRound aria-hidden="true" className="size-4 text-accent-ink" />
          Username
        </h2>
        <form action={usernameAction} className="mt-3 space-y-3">
          <TextField
            label="Username"
            name="username"
            defaultValue={username}
            required
            leading={<span className="text-small text-fg-subtle">@</span>}
            hint="Letters, numbers and underscores. This changes your profile link."
            error={usernameState.field === "username" ? usernameState.error : null}
          />
          <FormMessage error={usernameState.error && !usernameState.field ? usernameState.error : null} message={usernameState.ok ? usernameState.message : null} />
          <Button type="submit" variant="secondary" size="sm" loading={usernamePending} loadingLabel="Saving…">
            Update username
          </Button>
        </form>
      </section>

      <section className="rounded-card border border-border bg-surface p-4">
        <h2 className="text-h3 text-fg">Password</h2>
        <form action={passwordAction} className="mt-3 space-y-3">
          <PasswordField label="Current password" name="current" required autoComplete="current-password" />
          <PasswordField label="New password" name="next" required autoComplete="new-password" hint="At least 10 characters with upper and lower case and a number." />
          <PasswordField label="Repeat new password" name="confirm" required autoComplete="new-password" />
          <FormMessage error={passwordState.error} />
          <Button type="submit" variant="secondary" size="sm" loading={passwordPending} loadingLabel="Changing…">
            Change password
          </Button>
          <p className="text-tiny text-fg-subtle">Changing your password signs you out of every device.</p>
        </form>
      </section>

      <section className="rounded-card border border-danger/40 bg-surface p-4">
        <h2 className="flex items-center gap-2 text-h3 text-danger">
          <Trash2 aria-hidden="true" className="size-4" />
          Delete account
        </h2>
        <p className="mt-1 text-small text-fg-muted">
          Your account is scheduled for deletion after 30 days. You can cancel any time before then by logging back in. On
          day 30 your profile, photo and personal details are permanently removed; verification decision records are kept
          without your ID image.
        </p>
        <Button variant="destructive" size="sm" className="mt-3" onClick={() => setDeleteOpen(true)}>
          Delete my account
        </Button>
      </section>

      <Dialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete your account?"
        description="This starts a 30-day deletion period. You will be signed out everywhere."
        destructive
      >
        <form action={deleteAction} className="space-y-3">
          <TextField
            label={`Type ${username} to confirm`}
            name="confirm"
            required
            autoComplete="off"
            error={deleteState.field === "confirm" ? deleteState.error : null}
          />
          <PasswordField
            label="Your password"
            name="password"
            required
            autoComplete="current-password"
            error={deleteState.field === "password" ? deleteState.error : null}
          />
          <FormMessage error={deleteState.error && !deleteState.field ? deleteState.error : null} />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setDeleteOpen(false)}>
              Keep my account
            </Button>
            <Button type="submit" variant="destructive" loading={deletePending} loadingLabel="Scheduling…">
              Schedule deletion
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
