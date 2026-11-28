"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  Flag,
  Link2,
  PencilLine,
  Plus,
  Send,
  ShieldAlert,
  ShieldQuestion,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import {
  COMMUNITY_CATEGORIES,
  COMMUNITY_PRIVACY_DESCRIPTIONS,
  COMMUNITY_RULE_TEMPLATES,
  MAX_COMMUNITY_RULES,
  type CommunityCategory,
  type CommunityPrivacy,
} from "@/lib/domain/community";
import type {
  CommunityInviteView,
  CommunityMemberView,
  CommunityPageView,
  CommunityReportView,
  JoinRequestView,
} from "@/lib/communities/types";
import { ApiError, apiDelete, apiPatch, apiPost } from "@/lib/posts/client";
import { Button } from "@/components/ui/button";
import { Chip, SelectField, TextArea, TextField } from "@/components/ui/form-controls";
import { Dialog } from "@/components/ui/overlays";
import { useToast } from "@/components/providers/toast-provider";
import { cn } from "@/lib/utils";

/**
 * Raw enums never reach the screen: every status is mapped to a chip with text,
 * never colour alone.
 */
const INVITE_STATUS_LABELS: Record<CommunityInviteView["status"], { label: string; tone: string }> = {
  ACTIVE: { label: "Active", tone: "bg-success-soft text-success" },
  USED: { label: "Used up", tone: "bg-surface-2 text-fg-muted" },
  EXPIRED: { label: "Expired", tone: "bg-surface-2 text-fg-muted" },
  REVOKED: { label: "Revoked", tone: "bg-danger-soft text-danger" },
};

const REPORT_REASON_LABELS: Record<string, string> = {
  SPAM: "Spam or a scam",
  HARASSMENT: "Harassment or bullying",
  CHEATING: "Cheating or exam leaks",
  PERSONAL_INFO: "Someone's personal details",
  NSFW: "Inappropriate content",
  MISINFORMATION: "False information",
  OTHER: "Something else",
};

function reportReasonLabel(reason: string): string {
  return REPORT_REASON_LABELS[reason] ?? reason.toLowerCase().replace(/_/g, " ");
}

export function CommunitySettings({
  community,
  requests: initialRequests,
  invites: initialInvites,
  reports: initialReports,
  members,
}: {
  community: CommunityPageView;
  requests: JoinRequestView[];
  invites: CommunityInviteView[];
  reports: CommunityReportView[];
  members: CommunityMemberView[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = useState(community.name);
  const [description, setDescription] = useState(community.description);
  const [category, setCategory] = useState<CommunityCategory>(community.category);
  const [privacy, setPrivacy] = useState<CommunityPrivacy>(community.privacy);
  const [allowMemberUploads, setAllowMemberUploads] = useState(community.allowMemberUploads);
  const [rules, setRules] = useState(community.rules.map((rule) => ({ title: rule.title, body: rule.body })));
  const [saving, setSaving] = useState(false);
  const [requests, setRequests] = useState(initialRequests);
  const [invites, setInvites] = useState(initialInvites);
  const [reports, setReports] = useState(initialReports);
  const [inviteKind, setInviteKind] = useState<"LINK" | "USER">("LINK");
  const [inviteUsername, setInviteUsername] = useState("");
  const [inviteDays, setInviteDays] = useState(7);
  const [inviteUses, setInviteUses] = useState(10);
  const [inviting, setInviting] = useState(false);
  const [newLink, setNewLink] = useState<string | null>(null);
  const [targetUserId, setTargetUserId] = useState("");
  const [transferOpen, setTransferOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [officialNote, setOfficialNote] = useState("");
  const [officialPending, setOfficialPending] = useState(false);
  const [working, setWorking] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await apiPatch(`/api/communities/${community.id}`, {
        name,
        description,
        category,
        privacy,
        allowMemberUploads,
        rules,
      });
      toast({ title: "Community updated", variant: "success" });
      router.refresh();
    } catch (error) {
      toast({ title: error instanceof ApiError ? error.message : "Couldn't save changes", variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function decideRequest(request: JoinRequestView, decision: "APPROVE" | "DECLINE") {
    try {
      await apiPatch(`/api/communities/${community.id}/requests/${request.id}`, { decision });
      setRequests((current) => current.filter((item) => item.id !== request.id));
      toast({ title: decision === "APPROVE" ? "Request approved" : "Request declined" });
    } catch (error) {
      toast({ title: error instanceof ApiError ? error.message : "Couldn't handle request", variant: "error" });
    }
  }

  async function createInvite() {
    setInviting(true);
    try {
      const result = await apiPost<{ invite: CommunityInviteView }>(`/api/communities/${community.id}/invites`, {
        kind: inviteKind,
        username: inviteKind === "USER" ? inviteUsername : undefined,
        days: inviteDays,
        maxUses: inviteKind === "LINK" ? inviteUses : null,
      });
      setInvites((current) => [result.invite, ...current]);
      if (result.invite.url) {
        const absolute = `${window.location.origin}${result.invite.url}`;
        setNewLink(absolute);
        await navigator.clipboard?.writeText(absolute).catch(() => undefined);
      }
      setInviteUsername("");
      toast({ title: result.invite.url ? "Invite link copied" : "Invite sent", variant: "success" });
    } catch (error) {
      toast({ title: error instanceof ApiError ? error.message : "Couldn't create invite", variant: "error" });
    } finally {
      setInviting(false);
    }
  }

  async function revokeInvite(invite: CommunityInviteView) {
    try {
      await apiDelete(`/api/communities/${community.id}/invites/${invite.id}`);
      setInvites((current) => current.filter((item) => item.id !== invite.id));
    } catch (error) {
      toast({ title: error instanceof ApiError ? error.message : "Couldn't revoke invite", variant: "error" });
    }
  }

  async function resolveReport(report: CommunityReportView, action: "DISMISS" | "REMOVE_CONTENT") {
    try {
      await apiPatch(`/api/communities/${community.id}/reports`, { reportId: report.id, action });
      setReports((current) => current.filter((item) => item.id !== report.id));
      toast({ title: action === "DISMISS" ? "Report dismissed" : "Content removed" });
    } catch (error) {
      toast({ title: error instanceof ApiError ? error.message : "Couldn't resolve report", variant: "error" });
    }
  }

  async function transfer() {
    if (!targetUserId) return;
    setWorking(true);
    try {
      await apiPost(`/api/communities/${community.id}/transfer`, { targetUserId });
      toast({ title: "Ownership transferred", variant: "success" });
      setTransferOpen(false);
      router.refresh();
    } catch (error) {
      toast({ title: error instanceof ApiError ? error.message : "Couldn't transfer ownership", variant: "error" });
    } finally {
      setWorking(false);
    }
  }

  async function archive() {
    setWorking(true);
    try {
      await apiPatch(`/api/communities/${community.id}`, { action: "archive" });
      toast({ title: "Community archived" });
      router.push(`/c/${community.slug}`);
    } catch (error) {
      toast({ title: error instanceof ApiError ? error.message : "Couldn't archive community", variant: "error" });
      setWorking(false);
    }
  }

  async function remove() {
    setWorking(true);
    try {
      await apiDelete(`/api/communities/${community.id}`);
      toast({ title: "Community deleted" });
      router.push("/communities");
    } catch (error) {
      toast({ title: error instanceof ApiError ? error.message : "Couldn't delete community", variant: "error" });
      setWorking(false);
    }
  }

  async function requestOfficial() {
    setOfficialPending(true);
    try {
      await apiPost(`/api/communities/${community.id}/official`, { note: officialNote });
      toast({ title: "Official request sent", description: "A university admin will review it.", variant: "success" });
      setOfficialNote("");
    } catch (error) {
      toast({ title: error instanceof ApiError ? error.message : "Couldn't send request", variant: "error" });
    } finally {
      setOfficialPending(false);
    }
  }

  const candidates = members.filter((member) => member.status === "ACTIVE" && member.role !== "OWNER");

  return (
    <div className="min-h-dvh bg-surface text-fg">
      <header className="sticky top-0 z-40 border-b border-border bg-surface">
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-2 px-3">
          <Link href={`/c/${community.slug}`} aria-label="Back" className="flex size-11 items-center justify-center rounded-full hover:bg-surface-2">
            <ArrowLeft aria-hidden="true" className="size-5" />
          </Link>
          {/* Two short lines fit inside the 56px bar at 320px; one truncated line loses the
            word that says which page this is. */}
          <h1 className="line-clamp-2 flex-1 text-center font-display text-[0.9375rem] font-bold leading-[1.15] sm:text-[1.0625rem]">
            {community.name} settings
          </h1>
          <span className="size-11" aria-hidden="true" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl space-y-4 px-4 pb-28 pt-5">
        <section aria-labelledby="basics-title" className="rounded-card border border-border bg-surface p-4">
          <div className="flex items-start gap-2.5"><span className="accent-tile flex size-8 shrink-0 items-center justify-center rounded-[10px]"><PencilLine aria-hidden="true" className="size-4" /></span><div className="min-w-0 flex-1"><h2 id="basics-title" className="font-display text-h2 font-bold text-fg">Basics</h2><p className="mt-0.5 text-small text-fg-muted">Name, description and how people find you.</p></div></div>
          <TextField label="Name" value={name} onChange={(event) => setName(event.target.value.slice(0, 40))} />
          <TextArea
            label="Description"
            rows={3}
            value={description}
            onChange={(event) => setDescription(event.target.value.slice(0, 500))}
            hint={`${description.length}/500`}
          />
          <SelectField
            label="Category"
            value={category}
            onChange={(event) => setCategory(event.target.value as CommunityCategory)}
            options={COMMUNITY_CATEGORIES.map((entry) => ({ value: entry.value, label: entry.label }))}
          />
        </section>

        <section aria-labelledby="privacy-title" className="rounded-card border border-border bg-surface p-4">
          <div className="flex items-start gap-2.5"><span className="accent-tile flex size-8 shrink-0 items-center justify-center rounded-[10px]"><Users aria-hidden="true" className="size-4" /></span><div className="min-w-0 flex-1"><h2 id="privacy-title" className="font-display text-h2 font-bold text-fg">Membership</h2><p className="mt-0.5 text-small text-fg-muted">Changing to invite-only hides the community from discovery.</p></div></div>
          <div className="space-y-2">
            {(["PUBLIC", "REQUEST", "INVITE_ONLY"] as CommunityPrivacy[]).map((option) => (
              <label
                key={option}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-[14px] border p-3.5",
                  privacy === option ? "border-accent bg-accent-soft" : "border-border bg-surface",
                )}
              >
                <input
                  type="radio"
                  name="privacy"
                  checked={privacy === option}
                  onChange={() => setPrivacy(option)}
                  className="mt-1 size-4 accent-[var(--accent)]"
                />
                <span>
                  <span className="block text-small font-bold text-fg">
                    {option === "PUBLIC" ? "Public" : option === "REQUEST" ? "Request to join" : "Invite only"}
                  </span>
                  <span className="mt-0.5 block text-tiny leading-relaxed text-fg-muted">
                    {COMMUNITY_PRIVACY_DESCRIPTIONS[option]}
                  </span>
                </span>
              </label>
            ))}
          </div>
          <label className="flex items-start gap-3 rounded-card border border-border bg-surface p-3.5">
            <input
              type="checkbox"
              checked={allowMemberUploads}
              onChange={(event) => setAllowMemberUploads(event.target.checked)}
              className="mt-1 size-4 accent-[var(--accent)]"
            />
            <span>
              <span className="block text-small font-semibold text-fg">Members can add resources</span>
              <span className="block text-tiny text-fg-muted">Moderators can always upload files and links.</span>
            </span>
          </label>
        </section>

        <section aria-labelledby="rules-title" className="rounded-card border border-border bg-surface p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-2.5"><span className="accent-tile flex size-8 shrink-0 items-center justify-center rounded-[10px]"><ShieldQuestion aria-hidden="true" className="size-4" /></span><div className="min-w-0 flex-1"><h2 id="rules-title" className="font-display text-h2 font-bold text-fg">Rules</h2><p className="mt-0.5 text-small text-fg-muted">Shown on the About tab.</p></div></div>
            <span className="text-tiny text-fg-subtle">{rules.length}/{MAX_COMMUNITY_RULES}</span>
          </div>
          {rules.map((rule, index) => (
            <div key={index} className="rounded-card border border-border bg-surface p-3">
              <div className="flex items-center gap-2">
                <input
                  value={rule.title}
                  onChange={(event) =>
                    setRules((current) => current.map((item, i) => (i === index ? { ...item, title: event.target.value.slice(0, 60) } : item)))
                  }
                  aria-label={`Rule ${index + 1} title`}
                  className="min-h-11 -my-2 min-w-0 flex-1 bg-transparent text-small font-semibold text-fg outline-none"
                />
                <button
                  type="button"
                  aria-label={`Remove rule ${index + 1}`}
                  onClick={() => setRules((current) => current.filter((_, i) => i !== index))}
                  className="flex -m-1.5 size-11 items-center justify-center rounded-full text-fg-subtle hover:bg-surface-2 hover:text-danger"
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                </button>
              </div>
              <textarea
                value={rule.body}
                onChange={(event) =>
                  setRules((current) => current.map((item, i) => (i === index ? { ...item, body: event.target.value.slice(0, 300) } : item)))
                }
                aria-label={`Rule ${index + 1} description`}
                rows={2}
                className="mt-1 w-full min-h-11 resize-none bg-transparent text-small text-fg-muted outline-none"
              />
            </div>
          ))}
          {rules.length < MAX_COMMUNITY_RULES ? (
            <Button variant="ghost" size="sm" leftIcon={<Plus className="size-4" />} onClick={() => setRules((current) => [...current, { title: "", body: "" }])}>
              Add rule
            </Button>
          ) : null}
        </section>

        <div className="action-bar action-bar-fixed">
          <div className="mx-auto max-w-2xl">
          <Button fullWidth size="lg" loading={saving} onClick={() => void save()}>
            Save changes
          </Button>
          </div>
        </div>

        <section aria-labelledby="requests-title" className="rounded-card border border-border bg-surface p-4">
          <div className="flex items-start gap-2.5">
            <span className="accent-tile flex size-8 shrink-0 items-center justify-center rounded-[10px]">
              <UserPlus aria-hidden="true" className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id="requests-title" className="font-display text-h2 font-bold text-fg">Join requests</h2>
              <p className="mt-0.5 text-small text-fg-muted">
                {requests.length === 0 ? "Nothing waiting." : `${requests.length} waiting for a decision.`}
              </p>
            </div>
          </div>
          <div className="mt-2 space-y-2">
            {requests.map((request) => (
              <div key={request.id} className="rounded-[12px] border border-border bg-surface p-3">
                <p className="text-small font-semibold text-fg">{request.user.fullName}</p>
                <p className="text-tiny text-fg-muted">
                  @{request.user.username}
                  {request.user.departmentName ? ` · ${request.user.departmentName}` : ""}
                  {request.user.level ? ` · ${request.user.level}L` : ""}
                </p>
                {request.message ? (
                  <p className="mt-1.5 rounded-button border-l-2 border-border bg-surface-2 p-2 text-small italic leading-relaxed text-fg-muted">
                    &ldquo;{request.message}&rdquo;
                  </p>
                ) : null}
                <div className="mt-2.5 flex gap-2">
                  <Button size="sm" className="h-9 flex-1" onClick={() => void decideRequest(request, "APPROVE")} leftIcon={<Check className="size-4" />}>
                    Approve
                  </Button>
                  <Button size="sm" variant="secondary" className="h-9 flex-1" onClick={() => void decideRequest(request, "DECLINE")}>
                    Decline
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="invites-title" className="rounded-card border border-border bg-surface p-4">
          <div className="flex items-start gap-2.5">
            <span className="accent-tile flex size-8 shrink-0 items-center justify-center rounded-[10px]">
              <Link2 aria-hidden="true" className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id="invites-title" className="font-display text-h2 font-bold text-fg">Invites</h2>
              <p className="mt-0.5 text-small text-fg-muted">Links can be forwarded. Users are invited by username.</p>
            </div>
          </div>
          <div className="mt-2 rounded-card border border-border bg-surface p-3.5">
            <div className="flex gap-2">
              <Chip selected={inviteKind === "LINK"} onClick={() => setInviteKind("LINK")} icon={<Link2 className="size-4" />}>
                Link
              </Chip>
              <Chip selected={inviteKind === "USER"} onClick={() => setInviteKind("USER")} icon={<UserPlus className="size-4" />}>
                Student
              </Chip>
            </div>
            {inviteKind === "USER" ? (
              <div className="mt-3">
                <TextField
                  label="Username"
                  value={inviteUsername}
                  onChange={(event) => setInviteUsername(event.target.value.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 30))}
                  placeholder="username"
                />
              </div>
            ) : (
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <SelectField
                  label="Expires"
                  value={String(inviteDays)}
                  onChange={(event) => setInviteDays(Number(event.target.value))}
                  options={[1, 3, 7, 14, 30].map((days) => ({ value: String(days), label: `${days} day${days === 1 ? "" : "s"}` }))}
                />
                <SelectField
                  label="Max uses"
                  value={String(inviteUses)}
                  onChange={(event) => setInviteUses(Number(event.target.value))}
                  options={[1, 5, 10, 25, 50].map((uses) => ({ value: String(uses), label: String(uses) }))}
                />
              </div>
            )}
            <Button className="mt-3" fullWidth loading={inviting} onClick={() => void createInvite()} leftIcon={<Send className="size-4" />}>
              {inviteKind === "LINK" ? "Create link" : "Send invite"}
            </Button>
            {newLink ? (
              <div className="mt-2 flex items-center gap-2 rounded-button bg-accent-soft p-2">
                <p className="min-w-0 flex-1 truncate text-tiny text-accent-soft-fg">{newLink}</p>
                <button
                  type="button"
                  onClick={() => void navigator.clipboard?.writeText(newLink)}
                  className="flex size-11 items-center justify-center rounded-full text-accent-ink hover:bg-surface"
                  aria-label="Copy invite link"
                >
                  <Copy aria-hidden="true" className="size-4" />
                </button>
              </div>
            ) : null}
          </div>
          <ul className="mt-2 space-y-2">
            {invites.map((invite) => (
              <li key={invite.id} className="flex items-center gap-2 rounded-card border border-border bg-surface p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-small font-semibold text-fg">
                    {invite.kind === "USER" ? invite.invitedUser?.fullName ?? "Student invite" : "Invite link"}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-tiny text-fg-muted">
                    <span className={cn("rounded-chip px-2 py-0.5 text-[0.6875rem] font-semibold", INVITE_STATUS_LABELS[invite.status].tone)}>
                      {INVITE_STATUS_LABELS[invite.status].label}
                    </span>
                    <span className="nums">
                      {invite.uses}/{invite.maxUses ?? "∞"} uses
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>ends {new Date(invite.expiresAt).toLocaleDateString()}</span>
                  </p>
                </div>
                {invite.status === "ACTIVE" ? (
                  <button
                    type="button"
                    aria-label="Revoke invite"
                    onClick={() => void revokeInvite(invite)}
                    className="flex size-11 shrink-0 items-center justify-center rounded-full text-fg-subtle transition-colors duration-150 hover:bg-danger-soft hover:text-danger"
                  >
                    <X aria-hidden="true" className="size-4" />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="reports-title" className="rounded-card border border-border bg-surface p-4">
          <h2 id="reports-title" className="flex items-center gap-2 font-display text-h2 font-bold">
            <span className="danger-tile flex size-8 shrink-0 items-center justify-center rounded-[10px]">
              <Flag aria-hidden="true" className="size-4" />
            </span>
            <span>Reports</span>
          </h2>
          <p className="text-small text-fg-muted">{reports.length === 0 ? "No pending reports." : `${reports.length} pending in this community.`}</p>
          <div className="mt-2 space-y-2">
            {reports.map((report) => (
              <div key={report.id} className="rounded-[12px] border border-border bg-surface p-3">
                <p className="flex items-center gap-1.5 text-tiny font-semibold text-danger">
                  <Flag aria-hidden="true" className="size-3.5" />
                  {reportReasonLabel(report.reason)}
                </p>
                <p className="mt-1 line-clamp-3 text-small text-fg-muted">{report.targetExcerpt}</p>
                <p className="mt-1 text-tiny text-fg-subtle">
                  by {report.author ? `@${report.author.username}` : "unknown"} · reported by @{report.reporter.username}
                </p>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" variant="secondary" className="h-9 flex-1" onClick={() => void resolveReport(report, "DISMISS")}>
                    Dismiss
                  </Button>
                  <Button size="sm" variant="destructive" className="h-9 flex-1" onClick={() => void resolveReport(report, "REMOVE_CONTENT")}>
                    Remove content
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="official-title" className="rounded-card border border-border bg-surface p-4">
          <h2 id="official-title" className="flex items-center gap-2 font-display text-h2 font-bold">
            <span className="accent-tile flex size-8 shrink-0 items-center justify-center rounded-[10px]">
              <ShieldAlert aria-hidden="true" className="size-4" />
            </span>
            <ShieldAlert aria-hidden="true" className="size-5 text-accent-ink" />
            Official status
          </h2>
          {community.isOfficial ? (
            <p className="mt-1 text-small text-fg-muted">This community is marked official by your university.</p>
          ) : (
            <div className="mt-2 space-y-2">
              <p className="text-small text-fg-muted">Official communities are managed with the university and can use reserved names.</p>
              <TextArea
                label="Why should this be official?"
                rows={3}
                value={officialNote}
                onChange={(event) => setOfficialNote(event.target.value.slice(0, 1000))}
              />
              <Button variant="secondary" loading={officialPending} onClick={() => void requestOfficial()}>
                Request official status
              </Button>
            </div>
          )}
        </section>

        <section aria-labelledby="ownership-title" className="rounded-card border border-border bg-surface p-4">
          <h2 id="ownership-title" className="flex items-center gap-2 font-display text-h2 font-bold">
            <span className="accent-tile flex size-8 shrink-0 items-center justify-center rounded-[10px]">
              <Users aria-hidden="true" className="size-4" />
            </span>
          </h2>
          <p className="mt-1 text-small text-fg-muted">Transfer to an active member. You become a moderator.</p>
          <Button className="mt-2" variant="secondary" onClick={() => setTransferOpen(true)} disabled={candidates.length === 0}>
            Transfer ownership
          </Button>
        </section>

        <section aria-labelledby="danger-title" className="rounded-card border-[1.5px] border-danger/40 bg-danger-soft p-4">
          <h2 id="danger-title" className="flex items-center gap-2 font-display text-h2 font-bold text-fg">
            <span className="danger-tile flex size-8 shrink-0 items-center justify-center rounded-[10px] border border-danger/30">
              <Trash2 aria-hidden="true" className="size-4" />
            </span>
          </h2>
          <p className="mt-1.5 text-small leading-relaxed text-fg-muted">
            Archiving makes the community read-only for everyone. Deleting removes posts, resources and member history — it cannot be undone after 30 days.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => void archive()} loading={working}>
              Archive community
            </Button>
            <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
              Delete community
            </Button>
          </div>
        </section>
      </main>

      <Dialog
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        title="Transfer ownership"
        description="Choose an active member. This cannot be undone by you alone."
        footer={
          <Button fullWidth loading={working} onClick={() => void transfer()} disabled={!targetUserId}>
            Transfer ownership
          </Button>
        }
      >
        <div className="space-y-2">
          <SelectField
            label="New owner"
            value={targetUserId}
            onChange={(event) => setTargetUserId(event.target.value)}
            options={candidates.map((member) => ({
              value: member.userId,
              label: `${member.fullName} (@${member.username})${member.role === "MODERATOR" ? " · moderator" : ""}`,
            }))}
            placeholder="Choose a member"
          />
        </div>
      </Dialog>

      <Dialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete this community?"
        description="Posts, resources, invites and member roles will be removed. This cannot be undone."
        destructive
        footer={
          <Button fullWidth variant="destructive" loading={working} onClick={() => void remove()}>
            Delete permanently
          </Button>
        }
      >
        <p className="text-small text-fg-muted">The community will disappear from Pulse, search and every member&apos;s list.</p>
      </Dialog>
    </div>
  );
}
