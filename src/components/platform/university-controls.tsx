"use client";

import { useActionState, useState } from "react";
import { AlertCircle, Check, MailPlus, Power, PowerOff } from "lucide-react";
import {
  cancelPlatformInviteAction,
  inviteAdminAction,
  setStatusAction,
  updateFeaturesAction,
} from "@/app/platform/actions";
import { emptyFormState } from "@/lib/action-state";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/overlays";

export function StatusControls({ universityId, status }: { universityId: string; status: string }) {
  const [state, action, pending] = useActionState(setStatusAction, emptyFormState);
  const [confirming, setConfirming] = useState<"ACTIVE" | "OFF" | null>(null);

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {status !== "ACTIVE" ? (
          <Button size="sm" onClick={() => setConfirming("ACTIVE")}>
            <Power aria-hidden="true" className="size-4" /> Switch on
          </Button>
        ) : (
          <Button size="sm" variant="destructive" onClick={() => setConfirming("OFF")}>
            <PowerOff aria-hidden="true" className="size-4" /> Switch off
          </Button>
        )}
      </div>
      {state.error ? <p role="alert" className="mt-2 text-small text-danger">{state.error}</p> : null}
      {state.ok ? (
        <p role="status" className="mt-2 flex items-center gap-1.5 text-small font-semibold text-success">
          <Check aria-hidden="true" className="size-4" /> {state.message}
        </p>
      ) : null}

      <Dialog
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        title={confirming === "ACTIVE" ? "Switch this university on?" : "Switch this university off?"}
        description={
          confirming === "ACTIVE"
            ? "Students can sign up and sessions become valid again."
            : "Every session at this university is revoked immediately and signup closes. Existing data is kept."
        }
        destructive={confirming === "OFF"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(null)}>Cancel</Button>
            <form action={action}>
              <input type="hidden" name="universityId" value={universityId} />
              <input type="hidden" name="status" value={confirming ?? "ACTIVE"} />
              <Button type="submit" loading={pending} variant={confirming === "OFF" ? "destructive" : "primary"}>
                {confirming === "ACTIVE" ? "Switch on" : "Switch off"}
              </Button>
            </form>
          </>
        }
      >
        <p className="text-small text-fg-muted">This action is written to the audit log.</p>
      </Dialog>
    </div>
  );
}

const FLAGS = [
  { key: "feed", label: "Feed" },
  { key: "communities", label: "Communities" },
  { key: "events", label: "Events" },
  { key: "messaging", label: "Messaging" },
  { key: "campusVoice", label: "Campus Voice" },
  { key: "marketplace", label: "Marketplace" },
];

export function FeaturesForm({
  universityId,
  idCardEnabled,
  vouchingEnabled,
  featureFlags,
}: {
  universityId: string;
  idCardEnabled: boolean;
  vouchingEnabled: boolean;
  featureFlags: Record<string, boolean>;
}) {
  const [state, action, pending] = useActionState(updateFeaturesAction, emptyFormState);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="universityId" value={universityId} />
      <label className="flex items-center justify-between gap-3 rounded-input border border-border px-3 py-2 text-small">
        <span>
          <span className="block font-semibold text-fg">ID card review</span>
          <span className="block text-[0.6875rem] text-fg-subtle">Manual approval with private image.</span>
        </span>
        <input type="checkbox" name="idCardEnabled" defaultChecked={idCardEnabled} className="size-4 accent-[var(--accent)]" />
      </label>
      <label className="flex items-center justify-between gap-3 rounded-input border border-border px-3 py-2 text-small">
        <span>
          <span className="block font-semibold text-fg">Vouching</span>
          <span className="block text-[0.6875rem] text-fg-subtle">Reviewers can vouch for students.</span>
        </span>
        <input type="checkbox" name="vouchingEnabled" defaultChecked={vouchingEnabled} className="size-4 accent-[var(--accent)]" />
      </label>
      <fieldset>
        <legend className="text-small font-semibold text-fg">Phase flags</legend>
        <p className="text-[0.6875rem] text-fg-subtle">Features that do not exist yet stay off. The flag is ready for its phase.</p>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {FLAGS.map((flag) => (
            <label key={flag.key} className="min-h-11 flex items-center gap-2 rounded-input bg-surface-2 px-2.5 py-1.5 text-[0.75rem] font-semibold text-fg">
              <input type="checkbox" name={flag.key} defaultChecked={featureFlags[flag.key]} className="size-3.5 accent-[var(--accent)]" />
              {flag.label}
            </label>
          ))}
        </div>
      </fieldset>
      {state.error ? <p role="alert" className="text-small text-danger">{state.error}</p> : null}
      {state.ok ? (
        <p role="status" className="flex items-center gap-1.5 text-small font-semibold text-success">
          <Check aria-hidden="true" className="size-4" /> {state.message}
        </p>
      ) : null}
      <Button type="submit" loading={pending} fullWidth variant="secondary">Save capabilities</Button>
    </form>
  );
}

export function InviteAdminForm({ universityId, disabled }: { universityId: string; disabled: boolean }) {
  const [state, action, pending] = useActionState(inviteAdminAction, emptyFormState);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="universityId" value={universityId} />
      <label htmlFor="admin-email" className="block text-small font-semibold text-fg">Invite a university admin</label>
      <input
        id="admin-email"
        name="email"
        type="email"
        required
        disabled={disabled}
        placeholder="registrar@university.edu.ng"
        className="h-11 w-full rounded-input border border-border bg-surface px-3 text-small disabled:bg-surface-2"
      />
      {disabled ? <p className="text-[0.6875rem] text-warning">Switch the university on before inviting staff.</p> : null}
      {state.error ? <p role="alert" className="text-small text-danger">{state.error}</p> : null}
      {state.ok ? (
        <p role="status" className="flex items-center gap-1.5 text-small font-semibold text-success">
          <Check aria-hidden="true" className="size-4" /> {state.message}
        </p>
      ) : null}
      <Button type="submit" loading={pending} disabled={disabled} fullWidth>
        <MailPlus aria-hidden="true" className="size-4" /> Send invite
      </Button>
    </form>
  );
}

export function PlatformInviteCancel({ inviteId, universityId }: { inviteId: string; universityId: string }) {
  const [state, action, pending] = useActionState(cancelPlatformInviteAction, emptyFormState);
  return (
    <form action={action} className="inline-flex items-center gap-1">
      <input type="hidden" name="inviteId" value={inviteId} />
      <input type="hidden" name="universityId" value={universityId} />
      <button type="submit" disabled={pending} className="text-[0.6875rem] font-semibold text-fg-muted hover:text-danger disabled:opacity-50">
        Cancel
      </button>
      {state.error ? <span role="alert" className="text-[0.6875rem] text-danger">{state.error}</span> : null}
    </form>
  );
}
