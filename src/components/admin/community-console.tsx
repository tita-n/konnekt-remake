"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, Check, Plus, Search, ShieldAlert, Sparkles, X } from "lucide-react";
import type { CommunityAdminPayload, CommunityAdminRow } from "@/lib/communities/types";
import {
  COMMUNITY_CATEGORIES,
  COMMUNITY_PRIVACY_LABELS,
  type CommunityCategory,
  type CommunityPrivacy,
} from "@/lib/domain/community";
import { ApiError, apiGet, apiPatch, apiPost } from "@/lib/posts/client";
import { Button } from "@/components/ui/button";
import { Chip, SelectField, TextArea, TextField } from "@/components/ui/form-controls";
import { Dialog } from "@/components/ui/overlays";
import { useToast } from "@/components/providers/toast-provider";

const CATEGORY_LABELS = new Map(COMMUNITY_CATEGORIES.map((category) => [category.value, category.label]));

export function CommunityConsole({ initial, isAdmin }: { initial: CommunityAdminPayload; isAdmin: boolean }) {
  const { toast } = useToast();
  const [payload, setPayload] = useState(initial);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<CommunityAdminRow | null>(null);
  const [action, setAction] = useState<"SUSPEND" | "REINSTATE" | "ARCHIVE" | null>(null);
  const [reason, setReason] = useState("");
  const [working, setWorking] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createCategory, setCreateCategory] = useState<CommunityCategory>("ACADEMIC");
  const [createPrivacy, setCreatePrivacy] = useState<CommunityPrivacy>("PUBLIC");
  const [creating, setCreating] = useState(false);

  async function refresh(nextQuery = query, nextStatus = status) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (nextQuery.trim()) params.set("q", nextQuery.trim());
      if (nextStatus) params.set("status", nextStatus);
      const { data } = await apiGet<CommunityAdminPayload>(`/api/admin/communities?${params.toString()}`);
      setPayload(data);
    } catch (error) {
      toast({ title: error instanceof ApiError ? error.message : "Couldn't load communities", variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  async function decideOfficial(requestId: string, decision: "APPROVE" | "REJECT") {
    try {
      await apiPatch(`/api/admin/communities/official/${requestId}`, { decision });
      setPayload((current) => ({
        ...current,
        officialRequests: current.officialRequests.filter((request) => request.id !== requestId),
        rows: current.rows.map((row) => ({
          ...row,
          pendingOfficialRequest: false,
          isOfficial: decision === "APPROVE" ? true : row.isOfficial,
        })),
      }));
      toast({ title: decision === "APPROVE" ? "Community marked official" : "Official request rejected" });
    } catch (error) {
      toast({ title: error instanceof ApiError ? error.message : "Couldn't decide request", variant: "error" });
    }
  }

  async function createOfficial() {
    setCreating(true);
    try {
      await apiPost("/api/admin/communities", {
        name: createName,
        description: createDescription,
        category: createCategory,
        privacy: createPrivacy,
      });
      toast({ title: "Official community created", variant: "success" });
      setCreateOpen(false);
      setCreateName("");
      setCreateDescription("");
      await refresh();
    } catch (error) {
      toast({ title: error instanceof ApiError ? error.message : "Couldn't create community", variant: "error" });
    } finally {
      setCreating(false);
    }
  }

  async function moderate() {
    if (!selected || !action) return;
    setWorking(true);
    try {
      await apiPatch(`/api/admin/communities/${selected.id}`, { action, reason });
      toast({ title: "Community updated", variant: "success" });
      setSelected(null);
      setAction(null);
      setReason("");
      await refresh();
    } catch (error) {
      toast({ title: error instanceof ApiError ? error.message : "Couldn't update community", variant: "error" });
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-small font-semibold text-accent-ink">Campus groups</p>
          <h1 className="mt-0.5 text-h1 text-fg">Communities</h1>
          <p className="mt-1 text-small text-fg-muted">
            Official status, reports and safety actions. Community moderators handle day-to-day posts.
          </p>
        </div>
        {isAdmin ? (
          <Button size="sm" leftIcon={<Plus className="size-4" />} onClick={() => setCreateOpen(true)}>
            New official
          </Button>
        ) : null}
      </header>

      <section className="rounded-card border border-border bg-surface p-4">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[220px] flex-1">
            <TextField
              label="Search communities"
              hideLabel
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void refresh();
              }}
              placeholder="Name or description"
              leading={<Search aria-hidden="true" className="size-4" />}
            />
          </div>
          <div className="w-40">
            <SelectField
              label="Status"
              hideLabel
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                void refresh(query, event.target.value);
              }}
              options={[
                { value: "", label: "All statuses" },
                { value: "ACTIVE", label: "Active" },
                { value: "SUSPENDED", label: "Suspended" },
                { value: "ARCHIVED", label: "Archived" },
                { value: "DELETED", label: "Deleted" },
              ]}
            />
          </div>
          <Button variant="secondary" loading={loading} onClick={() => void refresh()}>
            Filter
          </Button>
        </div>
        <p className="mt-2 text-tiny text-fg-subtle">{payload.total} communities</p>
      </section>

      {payload.officialRequests.length > 0 ? (
        <section aria-labelledby="official-requests" className="rounded-card border border-accent/30 bg-accent-soft p-4">
          <h2 id="official-requests" className="flex items-center gap-1.5 font-display text-h2 font-bold text-accent-soft-fg">
            <Sparkles aria-hidden="true" className="size-5" />
            Official requests
          </h2>
          <ul className="mt-2.5 space-y-2">
            {payload.officialRequests.map((request) => (
              <li key={request.id} className="rounded-button bg-surface p-3">
                <p className="text-small font-bold text-fg">{request.community.name}</p>
                <p className="text-tiny text-fg-muted">
                  Requested by {request.requestedBy.fullName} · {new Date(request.createdAt).toLocaleDateString()}
                </p>
                <p className="mt-1.5 whitespace-pre-wrap text-small text-fg-muted">{request.note}</p>
                {isAdmin ? (
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" onClick={() => void decideOfficial(request.id, "APPROVE")} leftIcon={<Check className="size-4" />}>
                      Approve
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => void decideOfficial(request.id, "REJECT")} leftIcon={<X className="size-4" />}>
                      Reject
                    </Button>
                  </div>
                ) : (
                  <p className="mt-1.5 text-tiny text-fg-subtle">Only university admins can decide official status.</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="overflow-hidden rounded-card border border-border bg-surface">
        <div className="sticky top-0 z-10 hidden grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,0.7fr))_auto] gap-3 border-b border-border bg-surface px-4 py-2.5 text-[0.6875rem] font-bold uppercase tracking-wide text-fg-subtle md:grid">
          <span>Community</span>
          <span>Status</span>
          <span>Members</span>
          <span>Reports</span>
          <span>Owner</span>
          <span />
        </div>
        <ul className="divide-y divide-border">
          {payload.rows.map((row) => (
            <li key={row.id} className="px-4 py-3">
              <div className="flex items-start gap-3 md:grid md:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,0.7fr))_auto] md:items-center">
                <div className="min-w-0 flex-1">
                  <Link href={`/c/${row.slug}`} className="truncate text-small font-bold text-fg hover:text-accent-ink">
                    {row.name}
                  </Link>
                  <p className="truncate text-tiny text-fg-muted">
                    {COMMUNITY_PRIVACY_LABELS[row.privacy]} · {CATEGORY_LABELS.get(row.category) ?? row.category}
                    {row.isOfficial ? " · official" : ""}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1 md:hidden">
                    <StatusPill status={row.status} />
                    <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[0.625rem] text-fg-muted">{row.memberCount} members</span>
                    {row.reportCount > 0 ? (
                      <span className="rounded-full bg-danger-soft px-2 py-0.5 text-[0.625rem] font-semibold text-danger">{row.reportCount} reports</span>
                    ) : null}
                  </div>
                </div>
                <div className="hidden md:block">
                  <StatusPill status={row.status} />
                  {row.pendingOfficialRequest ? (
                    <p className="mt-1 text-[0.625rem] font-semibold text-accent-ink">Official pending</p>
                  ) : null}
                </div>
                <span className="hidden text-small tabular-nums text-fg md:block">{row.memberCount}</span>
                <span className={row.reportCount > 0 ? "hidden text-small font-semibold text-danger md:block" : "hidden text-small text-fg-muted md:block"}>
                  {row.reportCount}
                </span>
                <span className="hidden truncate text-tiny text-fg-muted md:block">
                  {row.owner ? `@${row.owner.username}` : "No owner"}
                </span>
                <div className="flex shrink-0 items-center gap-1">
                  <Link
                    href={`/c/${row.slug}`}
                    aria-label={`Open ${row.name}`}
                    className="flex size-11 items-center justify-center rounded-full text-fg-subtle hover:bg-surface-2 hover:text-fg"
                  >
                    <ArrowUpRight aria-hidden="true" className="size-4" />
                  </Link>
                  {row.status !== "DELETED" ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setSelected(row);
                        setAction(row.status === "SUSPENDED" ? "REINSTATE" : "SUSPEND");
                        setReason("");
                      }}
                    >
                      {row.status === "SUSPENDED" ? "Reinstate" : "Moderate"}
                    </Button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
        {payload.rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-small text-fg-muted">No communities match this filter.</p>
        ) : null}
      </div>

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create official community"
        description="Official communities are owned by the university admin account and marked verified everywhere."
        footer={
          <Button fullWidth loading={creating} onClick={() => void createOfficial()}>
            Create community
          </Button>
        }
      >
        <div className="space-y-3">
          <TextField label="Name" value={createName} onChange={(event) => setCreateName(event.target.value.slice(0, 60))} />
          <TextArea
            label="Description"
            rows={3}
            value={createDescription}
            onChange={(event) => setCreateDescription(event.target.value.slice(0, 500))}
          />
          <SelectField
            label="Category"
            value={createCategory}
            onChange={(event) => setCreateCategory(event.target.value as CommunityCategory)}
            options={COMMUNITY_CATEGORIES.map((entry) => ({ value: entry.value, label: entry.label }))}
          />
          <SelectField
            label="Who can join"
            value={createPrivacy}
            onChange={(event) => setCreatePrivacy(event.target.value as CommunityPrivacy)}
            options={[
              { value: "PUBLIC", label: "Anyone at this university" },
              { value: "REQUEST", label: "Ask to join" },
              { value: "INVITE_ONLY", label: "Invite only" },
            ]}
          />
        </div>
      </Dialog>

      <Dialog
        open={Boolean(selected && action)}
        onClose={() => {
          setSelected(null);
          setAction(null);
        }}
        title={selected ? `${action === "REINSTATE" ? "Reinstate" : action === "ARCHIVE" ? "Archive" : "Suspend"} ${selected.name}` : "Moderate community"}
        description="This action is audited and visible to university staff."
        destructive={action === "SUSPEND" || action === "ARCHIVE"}
        footer={
          <Button fullWidth variant={action === "REINSTATE" ? "primary" : "destructive"} loading={working} onClick={() => void moderate()}>
            Confirm
          </Button>
        }
      >
        <div className="space-y-2">
          <div className="flex gap-2">
            <Chip selected={action === "SUSPEND"} onClick={() => setAction("SUSPEND")}>
              Suspend
            </Chip>
            <Chip selected={action === "REINSTATE"} onClick={() => setAction("REINSTATE")}>
              Reinstate
            </Chip>
            <Chip selected={action === "ARCHIVE"} onClick={() => setAction("ARCHIVE")}>
              Archive
            </Chip>
          </div>
          <TextArea
            label="Reason"
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value.slice(0, 500))}
            placeholder="Shown in the audit log"
          />
          <p className="flex items-start gap-1.5 text-tiny text-fg-muted">
            <ShieldAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
            Suspension hides the community and freezes all posts immediately.
          </p>
        </div>
      </Dialog>
    </div>
  );
}

function StatusPill({ status }: { status: CommunityAdminRow["status"] }) {
  return (
    <span
      className={
        status === "ACTIVE"
          ? "rounded-full bg-success-soft px-2 py-0.5 text-[0.625rem] font-bold uppercase text-success"
          : status === "SUSPENDED"
            ? "rounded-full bg-danger-soft px-2 py-0.5 text-[0.625rem] font-bold uppercase text-danger"
            : "rounded-full bg-surface-2 px-2 py-0.5 text-[0.625rem] font-bold uppercase text-fg-muted"
      }
    >
      {status.toLowerCase()}
    </span>
  );
}
