"use client";

import { useState } from "react";
import { BadgeCheck, Plus, Search, ShieldCheck, UserPlus } from "lucide-react";
import { Avatar } from "@/components/ui/display";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/overlays";
import { FormMessage } from "@/components/auth/auth-shell";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/posts/client";
import { cn } from "@/lib/utils";
import { OFFICIAL_ACCOUNT_CATEGORIES, officialCategoryLabel, type OfficialAccountCategory } from "@/lib/domain/official";
import type { OfficialAccountView } from "@/lib/services/official";

type StaffMember = {
  id: string;
  canPublishCritical: boolean;
  user: { id: string; username: string; fullName: string; photoUrl: string | null; level: number | null };
};
type Candidate = { id: string; username: string; fullName: string; photoUrl: string | null; level: number | null };

export function OfficialConsole({ initialAccounts }: { initialAccounts: OfficialAccountView[] }) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<OfficialAccountCategory>("OTHER");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [staffAccount, setStaffAccount] = useState<OfficialAccountView | null>(null);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [staffQuery, setStaffQuery] = useState("");
  const [staffError, setStaffError] = useState<string | null>(null);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await apiPost<{ id: string; slug: string }>("/api/admin/official-accounts", {
        name,
        category,
        description,
      });
      setAccounts((current) => [
        ...current,
        {
          id: created.id,
          name,
          slug: created.slug,
          category,
          avatarPublicId: null,
          description,
          status: "ACTIVE",
          staffCount: 0,
          canPost: true,
          canCritical: true,
        },
      ]);
      setName("");
      setDescription("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create that account.");
    } finally {
      setBusy(false);
    }
  };

  const toggleStatus = async (account: OfficialAccountView) => {
    setError(null);
    try {
      const next = account.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
      await apiPatch(`/api/admin/official-accounts/${account.id}`, { status: next });
      setAccounts((current) => current.map((entry) => (entry.id === account.id ? { ...entry, status: next } : entry)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update that account.");
    }
  };

  const openStaff = async (account: OfficialAccountView) => {
    setStaffAccount(account);
    setStaffError(null);
    setCandidates([]);
    setStaffQuery("");
    try {
      const { data } = await apiGet<{ staff: StaffMember[] }>(`/api/admin/official-accounts/${account.id}/staff`);
      setStaff(data.staff);
    } catch (err) {
      setStaffError(err instanceof Error ? err.message : "Couldn't load staff.");
    }
  };

  const searchStaff = async (query: string) => {
    setStaffQuery(query);
    if (!staffAccount || query.trim().length < 2) {
      setCandidates([]);
      return;
    }
    try {
      const { data } = await apiGet<{ candidates: Candidate[] }>(
        `/api/admin/official-accounts/${staffAccount.id}/staff?q=${encodeURIComponent(query)}`,
      );
      setCandidates(data.candidates);
    } catch {
      setCandidates([]);
    }
  };

  const addStaff = async (candidate: Candidate, canCritical: boolean) => {
    if (!staffAccount) return;
    try {
      await apiPost(`/api/admin/official-accounts/${staffAccount.id}/staff`, {
        userId: candidate.id,
        canPublishCritical: canCritical,
      });
      setStaff((current) => [
        ...current.filter((entry) => entry.user.id !== candidate.id),
        { id: candidate.id, canPublishCritical: canCritical, user: candidate },
      ]);
      setCandidates((current) => current.filter((entry) => entry.id !== candidate.id));
    } catch (err) {
      setStaffError(err instanceof Error ? err.message : "Couldn't add staff.");
    }
  };

  const removeStaff = async (userId: string) => {
    if (!staffAccount) return;
    try {
      await apiDelete(`/api/admin/official-accounts/${staffAccount.id}/staff/${userId}`);
      setStaff((current) => current.filter((entry) => entry.user.id !== userId));
    } catch (err) {
      setStaffError(err instanceof Error ? err.message : "Couldn't remove staff.");
    }
  };

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-h1 text-fg">Official accounts</h1>
        <p className="mt-1 text-small text-fg-muted">
          Verified university voices. Staff can post announcements; only designated staff may post critical notices.
        </p>
      </header>

      <form onSubmit={create} className="space-y-3 rounded-card border border-border bg-surface p-4">
        <h2 className="text-h3 text-fg">Create an account</h2>
        <div>
          <label htmlFor="official-name" className="text-small font-semibold text-fg">
            Name
          </label>
          <input
            id="official-name"
            value={name}
            onChange={(change) => setName(change.target.value)}
            required
            maxLength={80}
            className="mt-1 min-h-11 w-full rounded-button border border-border bg-bg px-3 text-small text-fg"
          />
        </div>
        <div>
          <label htmlFor="official-category" className="text-small font-semibold text-fg">
            Category
          </label>
          <select
            id="official-category"
            value={category}
            onChange={(change) => setCategory(change.target.value as OfficialAccountCategory)}
            className="mt-1 min-h-11 w-full rounded-button border border-border bg-bg px-3 text-small text-fg"
          >
            {OFFICIAL_ACCOUNT_CATEGORIES.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="official-description" className="text-small font-semibold text-fg">
            Description
          </label>
          <textarea
            id="official-description"
            value={description}
            onChange={(change) => setDescription(change.target.value)}
            rows={2}
            maxLength={500}
            className="mt-1 w-full rounded-button border border-border bg-bg px-3 py-2 text-small text-fg"
          />
        </div>
        <Button type="submit" loading={busy} disabled={name.trim().length < 2}>
          <Plus aria-hidden="true" className="size-4" />
          Create account
        </Button>
        <FormMessage error={error} message={null} />
      </form>

      <ul className="space-y-3">
        {accounts.map((account) => (
          <li key={account.id} className="rounded-card border border-border bg-surface p-4">
            <div className="flex items-start gap-3">
              <span className="flex size-10 items-center justify-center rounded-full bg-accent-soft text-accent-ink">
                <BadgeCheck aria-hidden="true" className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 text-small font-bold text-fg">
                  {account.name}
                  <span className={cn("rounded-chip px-2 py-0.5 text-[0.625rem] font-bold", account.status === "ACTIVE" ? "bg-success-soft text-success" : "bg-danger-soft text-danger")}>
                    {account.status === "ACTIVE" ? "Active" : "Suspended"}
                  </span>
                </p>
                <p className="text-tiny text-fg-muted">
                  {officialCategoryLabel(account.category)} · {account.staffCount} staff · /official/{account.slug}
                </p>
                <p className="mt-1 line-clamp-2 text-tiny text-fg-subtle">{account.description}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => void openStaff(account)}>
                <UserPlus aria-hidden="true" className="size-4" />
                Manage staff
              </Button>
              <Button size="sm" variant={account.status === "ACTIVE" ? "ghost" : "secondary"} onClick={() => void toggleStatus(account)}>
                {account.status === "ACTIVE" ? "Suspend" : "Reactivate"}
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <BottomSheet
        open={Boolean(staffAccount)}
        onClose={() => setStaffAccount(null)}
        title={staffAccount ? `Staff · ${staffAccount.name}` : "Staff"}
      >
        <div className="space-y-3 px-1 pb-4">
          <ul className="divide-y divide-border">
            {staff.map((member) => (
              <li key={member.user.id} className="flex items-center gap-2 py-2">
                <Avatar name={member.user.fullName} src={member.user.photoUrl} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-small font-semibold text-fg">{member.user.fullName}</p>
                  <p className="flex items-center gap-1 text-tiny text-fg-muted">
                    <ShieldCheck aria-hidden="true" className="size-3" />
                    {member.canPublishCritical ? "Can post critical" : "Standard poster"}
                  </p>
                </div>
                <Button size="sm" variant="ghost" className="min-h-11" onClick={() => void removeStaff(member.user.id)}>
                  Remove
                </Button>
              </li>
            ))}
            {staff.length === 0 ? <li className="py-2 text-small text-fg-muted">No staff yet.</li> : null}
          </ul>
          <div className="flex items-center gap-2 rounded-button border border-border bg-bg px-3">
            <Search aria-hidden="true" className="size-4 text-fg-subtle" />
            <label htmlFor="official-staff-search" className="sr-only">
              Search verified students
            </label>
            <input
              id="official-staff-search"
              value={staffQuery}
              onChange={(change) => void searchStaff(change.target.value)}
              placeholder="Search a verified student"
              className="min-h-11 flex-1 bg-transparent text-small text-fg focus:outline-none"
            />
          </div>
          <ul className="divide-y divide-border">
            {candidates.map((candidate) => (
              <li key={candidate.id} className="flex items-center gap-2 py-2">
                <Avatar name={candidate.fullName} src={candidate.photoUrl} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-small font-semibold text-fg">{candidate.fullName}</p>
                  <p className="truncate text-tiny text-fg-muted">@{candidate.username}</p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => void addStaff(candidate, false)}>
                  Add
                </Button>
                <Button size="sm" variant="ghost" className="min-h-11" onClick={() => void addStaff(candidate, true)}>
                  + critical
                </Button>
              </li>
            ))}
          </ul>
          <FormMessage error={staffError} message={null} />
        </div>
      </BottomSheet>
    </div>
  );
}
