"use client";

import { useActionState, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { joinWaitlistAction } from "@/app/(auth)/signup/actions";
import { emptyFormState } from "@/lib/action-state";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/form-controls";
import { SegmentedControl } from "@/components/ui/navigation";
import { FormMessage } from "./auth-shell";

export function WaitlistForm({ defaultUniversity = "" }: { defaultUniversity?: string }) {
  const [state, action, pending] = useActionState(joinWaitlistAction, emptyFormState);
  const [kind, setKind] = useState<"STUDENT" | "UNIVERSITY">("STUDENT");

  if (state.ok) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center" role="status">
        <CheckCircle2 aria-hidden="true" className="size-10 text-success" />
        <p className="text-[0.9375rem] font-semibold text-fg">You&apos;re on the list</p>
        <p className="max-w-xs text-small text-fg-muted">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4 pb-2">
      <SegmentedControl
        label="What are you waiting for?"
        value={kind}
        onChange={setKind}
        options={[
          { value: "STUDENT", label: "My university" },
          { value: "UNIVERSITY", label: "I represent a university" },
        ]}
      />
      <input type="hidden" name="kind" value={kind} />
      {kind === "UNIVERSITY" ? (
        <TextField
          label="University name"
          name="universityName"
          defaultValue={defaultUniversity}
          required
          error={state.field === "universityName" ? state.error : null}
        />
      ) : null}
      <TextField
        label="Email address"
        name="email"
        type="email"
        autoComplete="email"
        required
        placeholder="you@example.com"
        error={state.field === "email" ? state.error : null}
        hint="We only use this to tell you when Konnekt arrives."
      />
      <FormMessage error={state.error && !state.field ? state.error : null} />
      <Button type="submit" fullWidth loading={pending} loadingLabel="Joining…">
        Join the waitlist
      </Button>
      <p className="text-center text-tiny leading-relaxed text-fg-subtle">
        By joining you agree to our Terms and Privacy Policy.
      </p>
    </form>
  );
}
