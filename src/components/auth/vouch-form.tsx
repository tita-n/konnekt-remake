"use client";

import { useActionState, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { requestVouchAction } from "@/app/(auth)/signup/[slug]/vouch/actions";
import { emptyFormState } from "@/lib/action-state";
import type { Voucher } from "@/lib/services/vouchers";
import { Avatar } from "@/components/ui/display";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/form-controls";
import { FormMessage } from "./auth-shell";
import { cn } from "@/lib/utils";

export function VouchForm({
  slug,
  vouchers,
  matricExample,
}: {
  slug: string;
  vouchers: Voucher[];
  matricExample: string;
}) {
  const [state, action, pending] = useActionState(requestVouchAction, emptyFormState);
  const [selected, setSelected] = useState<string>("");

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="voucherId" value={selected} />

      <fieldset>
        <legend className="mb-2 text-small font-semibold text-fg">Who can vouch for you?</legend>
        <div className="space-y-2">
          {vouchers.map((voucher) => {
            const checked = selected === voucher.id;
            return (
              <label
                key={voucher.id}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-card border p-3 transition",
                  checked ? "border-accent bg-accent-soft/40" : "border-border bg-surface hover:bg-surface-2",
                )}
              >
                <input
                  type="radio"
                  name="voucherChoice"
                  value={voucher.id}
                  checked={checked}
                  onChange={() => setSelected(voucher.id)}
                  className="size-4 accent-[var(--accent)]"
                />
                <Avatar name={voucher.fullName} src={voucher.photoUrl} size="sm" verified />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.9375rem] font-semibold text-fg">{voucher.fullName}</span>
                  <span className="block text-small text-fg-subtle">
                    {voucher.roleLabel}
                    {voucher.departmentName ? ` · ${voucher.departmentName}` : ""}
                    {voucher.level ? ` · ${voucher.level} level` : ""}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
        {state.field === "voucherId" ? (
          <p className="mt-1.5 text-small font-medium text-danger" role="alert">
            {state.error}
          </p>
        ) : null}
      </fieldset>

      <TextField
        label="Matric number"
        name="matricNumber"
        required
        placeholder={matricExample}
        autoCapitalize="characters"
        spellCheck={false}
        error={state.field === "matricNumber" ? state.error : null}
        hint="They'll confirm this matches what they know about you."
      />

      <p className="flex items-start gap-2 rounded-card bg-surface-2 px-3.5 py-3 text-small text-fg-muted">
        <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-accent" />
        Your chosen person gets one email with your name and username. Nothing is posted anywhere.
      </p>

      <FormMessage error={state.error && !state.field ? state.error : null} />

      <Button type="submit" fullWidth loading={pending} loadingLabel="Sending request…" disabled={!selected}>
        Ask for a vouch
      </Button>
    </form>
  );
}
