"use client";

import { useActionState } from "react";
import { AlertCircle, Check, MailPlus, ShieldCheck, X } from "lucide-react";
import { cancelInviteAction, inviteTeamAction, revokeRoleAction } from "@/app/admin/actions";
import { emptyFormState } from "@/lib/action-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/admin/status-badge";

function RoleRemoveForm({ assignmentId, name }: { assignmentId: string; name: string }) {
  const [state, action, pending] = useActionState(revokeRoleAction, emptyFormState);
  return (
    <form action={action} className="inline-flex items-center gap-1">
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <button
        type="submit"
        disabled={pending}
        className="text-[0.75rem] font-semibold text-danger hover:underline disabled:opacity-50"
        aria-label={`Remove role from ${name}`}
      >
        Remove
      </button>
      {state.error ? <span role="alert" className="text-[0.6875rem] text-danger">{state.error}</span> : null}
    </form>
  );
}

function InviteCancelForm({ inviteId }: { inviteId: string }) {
  const [state, action, pending] = useActionState(cancelInviteAction, emptyFormState);
  return (
    <form action={action} className="inline-flex items-center gap-1">
      <input type="hidden" name="inviteId" value={inviteId} />
      <button type="submit" disabled={pending} className="text-[0.75rem] font-semibold text-fg-muted hover:text-danger disabled:opacity-50">
        Cancel
      </button>
      {state.error ? <span role="alert" className="text-[0.6875rem] text-danger">{state.error}</span> : null}
    </form>
  );
}

export function TeamManager({
  members,
  invites,
}: {
  members: Array<{
    id: string;
    role: string;
    createdAt: Date;
    user: { id: string; fullName: string; username: string; email: string; photoUrl: string | null };
  }>;
  invites: Array<{ id: string; email: string; role: string; expiresAt: Date }>;
}) {
  const [state, action, pending] = useActionState(inviteTeamAction, emptyFormState);

  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-4">
        <section className="rounded-card border border-border bg-surface">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-h3 text-fg">Staff with access</h2>
            <p className="text-small text-fg-muted">Admins manage the space; reviewers only see the verification queue.</p>
          </div>
          <ul className="divide-y divide-border">
            {members.length === 0 ? (
              <li className="px-4 py-8 text-center text-small text-fg-muted">No staff yet.</li>
            ) : (
              members.map((member) => (
                <li key={member.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-small font-bold text-fg-muted">
                    {member.user.fullName.slice(0, 1)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-small font-semibold text-fg">{member.user.fullName}</span>
                    <span className="block truncate text-[0.75rem] text-fg-subtle">{member.user.email}</span>
                  </span>
                  <Badge tone={member.role === "UNIVERSITY_ADMIN" ? "accent" : "neutral"}>
                    {member.role.replaceAll("_", " ").toLowerCase()}
                  </Badge>
                  <RoleRemoveForm assignmentId={member.id} name={member.user.fullName} />
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="rounded-card border border-border bg-surface">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-h3 text-fg">Pending invitations</h2>
            <p className="text-small text-fg-muted">Single use, expire after 7 days.</p>
          </div>
          {invites.length === 0 ? (
            <p className="px-4 py-8 text-center text-small text-fg-muted">No pending invitations.</p>
          ) : (
            <ul className="divide-y divide-border">
              {invites.map((invite) => (
                <li key={invite.id} className="flex items-center gap-3 px-4 py-3">
                  <MailPlus aria-hidden="true" className="size-4 shrink-0 text-fg-subtle" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-small font-semibold text-fg">{invite.email}</span>
                    <span className="block text-[0.75rem] text-fg-subtle">
                      {invite.role.replaceAll("_", " ").toLowerCase()} · expires{" "}
                      {new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(invite.expiresAt)}
                    </span>
                  </span>
                  <InviteCancelForm inviteId={invite.id} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="h-fit rounded-card border border-border bg-surface p-4">
        <h2 className="text-h3 text-fg">Invite someone</h2>
        <p className="mt-1 text-small text-fg-muted">
          They must already have a Konnekt account with this email (or create one at your university), then open the link.
        </p>
        <form action={action} className="mt-3 space-y-3">
          <div>
            <label htmlFor="invite-email" className="mb-1 block text-small font-semibold text-fg">Email</label>
            <input
              id="invite-email"
              name="email"
              type="email"
              required
              placeholder="reviewer@university.edu.ng"
              className="h-10 w-full rounded-input border border-border bg-surface px-3 text-small"
            />
          </div>
          <div>
            <label htmlFor="invite-role" className="mb-1 block text-small font-semibold text-fg">Role</label>
            <select id="invite-role" name="role" defaultValue="REVIEWER" className="h-10 w-full rounded-input border border-border bg-surface px-3 text-small">
              <option value="REVIEWER">Reviewer — verification queue only</option>
              <option value="UNIVERSITY_ADMIN">University admin — full console</option>
              <option value="MODERATOR">Moderator — later phases</option>
              <option value="OFFICIAL">Official — can vouch</option>
            </select>
          </div>
          {state.error ? (
            <p role="alert" className="flex items-start gap-1.5 text-small text-danger">
              <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> {state.error}
            </p>
          ) : null}
          {state.ok ? (
            <p role="status" className="flex items-center gap-1.5 text-small font-semibold text-success">
              <Check aria-hidden="true" className="size-4" /> {state.message}
            </p>
          ) : null}
          <Button type="submit" loading={pending} fullWidth>
            <ShieldCheck aria-hidden="true" className="size-4" /> Send invitation
          </Button>
        </form>
      </section>
    </div>
  );
}
