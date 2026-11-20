"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { createAccountAction } from "@/app/(auth)/signup/[slug]/account/actions";
import { emptyFormState } from "@/lib/action-state";
import { usernameSchema } from "@/lib/validation/schemas";
import { Button } from "@/components/ui/button";
import {
  Checkbox,
  PasswordField,
  PasswordStrengthMeter,
  TextField,
} from "@/components/ui/form-controls";
import { Turnstile } from "./turnstile";
import { FormMessage } from "./auth-shell";

type Availability = "idle" | "checking" | "available" | "taken" | "invalid";

export function AccountForm({
  slug,
  initialEmail,
  lockedEmail,
  siteKey,
  universityName,
  policyVersion,
}: {
  slug: string;
  initialEmail: string;
  lockedEmail: boolean;
  siteKey: string;
  universityName: string;
  policyVersion: string;
}) {
  const [state, action, pending] = useActionState(createAccountAction, emptyFormState);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [availability, setAvailability] = useState<Availability>("idle");
  const [availabilityMessage, setAvailabilityMessage] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    if (state.error) {
      setResetKey((value) => value + 1);
    }
  }, [state.error]);

  useEffect(() => {
    const parsed = usernameSchema.safeParse(username);
    if (!username) {
      setAvailability("idle");
      setAvailabilityMessage("");
      return;
    }
    if (!parsed.success) {
      setAvailability("invalid");
      setAvailabilityMessage(parsed.error.issues[0]?.message ?? "That username is not valid.");
      return;
    }

    setAvailability("checking");
    const timer = window.setTimeout(async () => {
      abort.current?.abort();
      const controller = new AbortController();
      abort.current = controller;
      try {
        const response = await fetch(`/api/signup/username?username=${encodeURIComponent(username)}`, {
          signal: controller.signal,
        });
        const data = (await response.json()) as { available: boolean; reason?: string };
        setAvailability(data.available ? "available" : "taken");
        setAvailabilityMessage(data.available ? "That username is free." : (data.reason ?? "That username is taken."));
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setAvailability("idle");
          setAvailabilityMessage("Couldn't check that username — we'll confirm when you submit.");
        }
      }
    }, 450);

    return () => window.clearTimeout(timer);
  }, [username]);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="cf-turnstile-response" value={token ?? ""} />

      <TextField
        label="Full name"
        name="fullName"
        required
        autoComplete="name"
        value={fullName}
        onChange={(event) => setFullName(event.target.value)}
        placeholder="Chinedu Okafor"
        error={state.field === "fullName" ? state.error : null}
      />

      <TextField
        label="Username"
        name="username"
        required
        autoComplete="username"
        value={username}
        onChange={(event) => setUsername(event.target.value.replace(/\s/g, ""))}
        placeholder="chinedu_okafor"
        leading={<span className="text-small text-fg-subtle">@</span>}
        trailing={
          availability === "checking" ? (
            <Loader2 aria-hidden="true" className="mr-2 size-4 animate-spin text-fg-subtle" />
          ) : availability === "available" ? (
            <CheckCircle2 aria-hidden="true" className="mr-2 size-4 text-success" />
          ) : availability === "taken" || availability === "invalid" ? (
            <XCircle aria-hidden="true" className="mr-2 size-4 text-danger" />
          ) : null
        }
        hint={availabilityMessage || "Letters, numbers and underscores. This is how classmates find you."}
        error={state.field === "username" ? state.error : null}
      />

      <TextField
        label="Email address"
        name="email"
        type="email"
        required
        readOnly={lockedEmail}
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        autoComplete="email"
        hint={
          lockedEmail
            ? "Verified with your student email. This is also your login."
            : "We'll send a 6-digit code to confirm this address."
        }
        error={state.field === "email" ? state.error : null}
      />

      <div>
        <PasswordField
          label="Password"
          name="password"
          required
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={state.field === "password" ? state.error : null}
        />
        <PasswordStrengthMeter password={password} userInputs={[fullName, username, email]} />
      </div>

      <Checkbox
        name="consent"
        value="on"
        required
        label={
          <>
            I agree to the{" "}
            <Link href="/legal/terms" target="_blank" className="font-semibold text-accent-ink underline-offset-2 hover:underline">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/legal/privacy" target="_blank" className="font-semibold text-accent-ink underline-offset-2 hover:underline">
              Privacy Policy
            </Link>
            .
          </>
        }
        description={`We record that you accepted policy version ${policyVersion} on ${new Date().toLocaleDateString("en-NG")}, and nothing more.`}
        error={state.field === "consent" ? state.error : null}
      />

      <Turnstile siteKey={siteKey} onToken={setToken} resetKey={resetKey} />

      <FormMessage error={state.error && !state.field ? state.error : null} />

      <Button
        type="submit"
        size="lg"
        fullWidth
        loading={pending}
        loadingLabel="Creating your account…"
        disabled={availability === "taken" || availability === "invalid" || (Boolean(siteKey) && !token)}
      >
        Create account
      </Button>
      <p className="text-center text-tiny leading-relaxed text-fg-subtle">
        Your account belongs to {universityName}. You can delete it at any time from Settings.
      </p>
    </form>
  );
}
