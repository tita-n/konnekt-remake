"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { Mail } from "lucide-react";
import { studentEmailAction } from "@/app/(auth)/signup/[slug]/email/actions";
import { emptyFormState } from "@/lib/action-state";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/form-controls";
import { CodeInput } from "@/components/ui/code-input";
import { FormMessage } from "./auth-shell";

export function StudentEmailForm({
  slug,
  shortName,
  domains,
}: {
  slug: string;
  shortName: string;
  domains: string[];
}) {
  const [state, action, pending] = useActionState(studentEmailAction, emptyFormState);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [restarting, setRestarting] = useState(false);

  useEffect(() => {
    if (!state.sentAt) return;
    setCooldown(60);
    const timer = window.setInterval(() => {
      setCooldown((value) => {
        if (value <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [state.sentAt]);

  const showingCode = state.step === "code" && !restarting;
  const activeEmail = state.email ?? email;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="email" value={activeEmail} />

      {showingCode ? (
        <>
          <div className="flex items-start gap-2.5 rounded-card bg-surface-2 px-3.5 py-3 text-small text-fg-muted">
            <Mail aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-accent-ink" />
            <p>
              We sent a 6-digit code to <span className="font-semibold text-fg">{activeEmail}</span>. It expires in 10 minutes.
            </p>
          </div>
          <input type="hidden" name="code" value={code} />
          <CodeInput
            value={code}
            onChange={setCode}
            label="Email code"
            hint="Paste the whole code if that's easier."
            error={state.error && state.step === "code" ? state.error : null}
            autoFocus
          />
          <Button
            type="submit"
            name="intent"
            value="verify"
            fullWidth
            loading={pending}
            loadingLabel="Checking…"
            disabled={code.length !== 6}
          >
            Verify my student email
          </Button>
          <div className="flex items-center justify-between gap-3 text-small">
            <button
              type="submit"
              name="intent"
              value="send"
              disabled={pending || cooldown > 0}
              className="font-semibold text-accent-ink underline-offset-2 hover:underline disabled:text-fg-subtle disabled:no-underline"
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
            </button>
            <button
              type="button"
              onClick={() => {
                setCode("");
                setRestarting(true);
              }}
              className="font-semibold text-fg-muted underline-offset-2 hover:text-fg hover:underline"
            >
              Use a different email
            </button>
          </div>
        </>
      ) : (
        <>
          <TextField
            label={`${shortName} student email`}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={`you@${domains[0] ?? "student.edu.ng"}`}
            hint={`Must end in ${domains.map((domain) => `@${domain}`).join(" or ")}.`}
            error={state.error && state.field === "email" ? state.error : null}
          />
          <Button type="submit" name="intent" value="send" fullWidth loading={pending} loadingLabel="Sending code…">
            Send my code
          </Button>
          <FormMessage error={state.error && !state.field ? state.error : null} />
          <p className="text-center text-small text-fg-muted">
            Can&apos;t get into your school email?{" "}
            <Link
              href={`/signup/${slug}/id`}
              className="font-semibold text-accent-ink underline-offset-2 hover:underline"
            >
              Use your ID card instead
            </Link>
          </p>
        </>
      )}
    </form>
  );
}
