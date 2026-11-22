"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Compass, Loader2, Plus, Search, Sparkles, TrendingUp, Users, X } from "lucide-react";
import type {
  CommunityCardView,
  CommunityDiscoverPayload,
  CommunityMinePayload,
  PendingInvitationView,
} from "@/lib/communities/types";
import { COMMUNITY_CATEGORIES, type CommunityCategory } from "@/lib/domain/community";
import { ApiError, apiDelete, apiGet, apiPost } from "@/lib/posts/client";
import { Button, ButtonLink } from "@/components/ui/button";
import { Chip, TextField } from "@/components/ui/form-controls";
import { EmptyState } from "@/components/ui/feedback";
import { useToast } from "@/components/providers/toast-provider";
import { cn } from "@/lib/utils";
import { CommunityCard, CommunityIcon, CommunityTile } from "./community-card";

export function CommunityHub({
  mine,
  discover,
}: {
  mine: CommunityMinePayload;
  discover: CommunityDiscoverPayload;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CommunityCategory | null>(null);
  const [payload, setPayload] = useState<CommunityDiscoverPayload>(discover);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invitations, setInvitations] = useState(mine.invitations);
  const firstRender = useRef(true);
  const requestId = useRef(0);
  const { toast } = useToast();

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const timer = window.setTimeout(async () => {
      const current = ++requestId.current;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (query.trim()) params.set("q", query.trim());
        if (category) params.set("category", category);
        const { data } = await apiGet<CommunityDiscoverPayload>(`/api/communities?${params.toString()}`);
        if (current === requestId.current) setPayload({ ...data, trending: [], suggested: [] });
      } catch (err) {
        if (current === requestId.current) setError(err instanceof Error ? err.message : "Couldn't search communities.");
      } finally {
        if (current === requestId.current) setLoading(false);
      }
    }, 260);
    return () => window.clearTimeout(timer);
  }, [query, category]);

  async function loadMore() {
    if (!payload.nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({ cursor: payload.nextCursor });
      if (query.trim()) params.set("q", query.trim());
      if (category) params.set("category", category);
      const { data } = await apiGet<CommunityDiscoverPayload>(`/api/communities?${params.toString()}`);
      setPayload((current) => {
        const seen = new Set(current.communities.map((community) => community.id));
        return {
          ...current,
          communities: [...current.communities, ...data.communities.filter((community) => !seen.has(community.id))],
          nextCursor: data.nextCursor,
          hasMore: data.hasMore,
        };
      });
    } catch (err) {
      toast({ title: "Couldn't load more", description: err instanceof Error ? err.message : undefined, variant: "error" });
    } finally {
      setLoadingMore(false);
    }
  }

  async function accept(invite: PendingInvitationView) {
    try {
      const result = await apiPost<{ slug: string }>("/api/invites/accept", { inviteId: invite.id });
      setInvitations((items) => items.filter((item) => item.id !== invite.id));
      toast({ title: `Joined ${invite.community.name}`, variant: "success" });
      window.location.assign(`/c/${result.slug}`);
    } catch (err) {
      toast({ title: err instanceof ApiError ? err.message : "Couldn't accept invite", variant: "error" });
    }
  }

  async function decline(invite: PendingInvitationView) {
    try {
      await apiDelete(`/api/invites/${invite.id}`);
      setInvitations((items) => items.filter((item) => item.id !== invite.id));
      toast({ title: "Invite declined" });
    } catch (err) {
      toast({ title: err instanceof ApiError ? err.message : "Couldn't decline invite", variant: "error" });
    }
  }

  const filtered = Boolean(query.trim() || category);

  return (
    <div className="px-1 pt-2">
      <header className="px-3 pb-3 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-tiny font-semibold uppercase tracking-[0.14em] text-accent-ink">Your campus circles</p>
            <h1 className="mt-1 text-h1 text-fg">Communities</h1>
            <p className="mt-1 max-w-md text-small text-fg-muted">
              Course groups, halls, teams and societies — only for verified students at your university.
            </p>
          </div>
          <ButtonLink href="/communities/new" size="sm" className="mt-1 shrink-0" leftIcon={<Plus className="size-4" />}>
            <span className="hidden sm:inline">New</span>
          </ButtonLink>
        </div>
      </header>

      {invitations.length > 0 ? (
        <section className="mx-3 mb-4 rounded-card border border-accent/25 bg-accent-soft p-3.5" aria-labelledby="invitations-title">
          <h2 id="invitations-title" className="font-display text-h3 font-bold text-accent-soft-fg">
            Invitations
          </h2>
          <ul className="mt-2.5 space-y-2">
            {invitations.map((invite) => (
              <li key={invite.id} className="flex items-center gap-3 rounded-button bg-surface p-3">
                <CommunityIcon community={{ ...invite.community, slug: invite.community.slug }} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-small font-bold text-fg">{invite.community.name}</p>
                  <p className="truncate text-tiny text-fg-muted">
                    Invited by {invite.invitedBy?.fullName ?? "a moderator"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button size="sm" onClick={() => void accept(invite)}>
                    Join
                  </Button>
                  <button
                    type="button"
                    aria-label={`Decline invite to ${invite.community.name}`}
                    onClick={() => void decline(invite)}
                    className="flex size-9 items-center justify-center rounded-full text-fg-subtle hover:bg-surface-2 hover:text-fg"
                  >
                    <X aria-hidden="true" className="size-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mb-5 px-3" aria-labelledby="mine-title">
        <div className="mb-2.5 flex items-center justify-between">
          <h2 id="mine-title" className="font-display text-h2 font-bold text-fg">
            Your communities
          </h2>
          <span className="text-tiny text-fg-subtle">{mine.active.length + mine.rest.length} joined</span>
        </div>
        {mine.active.length + mine.rest.length === 0 ? (
          <div className="rounded-card border border-dashed border-border bg-surface">
            <EmptyState
              illustration="communities"
              compact
              title="No communities yet"
              description="Join a circle below, or start one for your course, hall or society."
              action={
                <ButtonLink href="/communities/new" size="sm" variant="secondary">
                  Start a community
                </ButtonLink>
              }
            />
          </div>
        ) : (
          <>
            {mine.active.length > 0 ? (
              <div className="no-scrollbar -mx-3 flex gap-2.5 overflow-x-auto px-3 pb-1">
                {mine.active.map((community) => (
                  <CommunityTile key={community.id} community={community} />
                ))}
              </div>
            ) : null}
            {mine.rest.length > 0 ? (
              <div className="mt-3 space-y-2">
                {mine.rest.map((community) => (
                  <Link
                    key={community.id}
                    href={`/c/${community.slug}`}
                    className="flex items-center gap-3 rounded-card border border-border bg-surface p-3"
                  >
                    <CommunityIcon community={community} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-small font-bold text-fg">{community.name}</p>
                      <p className="truncate text-tiny text-fg-muted">{community.recentActivity ?? `${community.memberCount} members`}</p>
                    </div>
                    {community.status === "ARCHIVED" ? (
                      <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[0.6875rem] font-medium text-fg-muted">Archived</span>
                    ) : null}
                  </Link>
                ))}
              </div>
            ) : null}
          </>
        )}
      </section>

      {!filtered && (payload.trending.length > 0 || payload.suggested.length > 0) ? (
        <div className="mb-5 grid gap-4 px-3 sm:grid-cols-2">
          {payload.trending.length > 0 ? (
            <section aria-labelledby="trending-communities">
              <h2 id="trending-communities" className="flex items-center gap-1.5 font-display text-h3 font-bold text-fg">
                <TrendingUp aria-hidden="true" className="size-4 text-accent-ink" />
                Trending this week
              </h2>
              <div className="mt-2 space-y-2">
                {payload.trending.slice(0, 3).map((community) => (
                  <Link key={community.id} href={`/c/${community.slug}`} className="flex items-center gap-2.5 rounded-button bg-surface px-3 py-2">
                    <CommunityIcon community={community} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-small font-semibold text-fg">{community.name}</span>
                    <span className="text-tiny text-fg-subtle">{community.memberCount}</span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
          {payload.suggested.length > 0 ? (
            <section aria-labelledby="suggested-communities">
              <h2 id="suggested-communities" className="flex items-center gap-1.5 font-display text-h3 font-bold text-fg">
                <Sparkles aria-hidden="true" className="size-4 text-accent-ink" />
                Because of your interests
              </h2>
              <div className="mt-2 space-y-2">
                {payload.suggested.slice(0, 3).map((community) => (
                  <Link key={community.id} href={`/c/${community.slug}`} className="flex items-center gap-2.5 rounded-button bg-surface px-3 py-2">
                    <CommunityIcon community={community} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-small font-semibold text-fg">{community.name}</span>
                    <span className="text-tiny text-fg-subtle">{community.memberCount}</span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}

      <section className="px-3" aria-labelledby="discover-title">
        <div className="flex items-center justify-between">
          <h2 id="discover-title" className="flex items-center gap-1.5 font-display text-h2 font-bold text-fg">
            <Compass aria-hidden="true" className="size-5 text-accent-ink" />
            Discover
          </h2>
        </div>
        <div className="mt-3">
          <TextField
            label="Search communities"
            hideLabel
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name or topic"
            leading={<Search aria-hidden="true" className="size-4" />}
          />
        </div>
        <div className="no-scrollbar -mx-3 mt-2.5 flex gap-2 overflow-x-auto px-3 pb-1">
          <Chip selected={!category} onClick={() => setCategory(null)}>
            All
          </Chip>
          {COMMUNITY_CATEGORIES.map((entry) => (
            <Chip
              key={entry.value}
              selected={category === entry.value}
              onClick={() => setCategory(category === entry.value ? null : entry.value)}
            >
              {entry.label}
            </Chip>
          ))}
        </div>

        <div className="mt-3" aria-busy={loading}>
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-small text-fg-muted">
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              Finding communities…
            </div>
          ) : error ? (
            <div className="rounded-card border border-danger/30 bg-danger-soft px-4 py-3 text-small text-danger">
              {error}
            </div>
          ) : payload.communities.length === 0 ? (
            <div className={cn("rounded-card border border-border bg-surface")}>
              <EmptyState
                illustration="search"
                compact
                title={filtered ? "No communities match" : "No communities to show"}
                description={
                  filtered
                    ? "Try a different name or category."
                    : "Be the first to start a community for your course, hall or society."
                }
                action={
                  filtered ? undefined : (
                    <ButtonLink href="/communities/new" size="sm" variant="secondary" leftIcon={<Users className="size-4" />}>
                      Start a community
                    </ButtonLink>
                  )
                }
              />
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                {payload.communities.map((community) => (
                  <CommunityCard key={community.id} community={community} />
                ))}
              </div>
              {payload.hasMore ? (
                <div className="mt-4 flex justify-center">
                  <Button variant="secondary" loading={loadingMore} onClick={() => void loadMore()}>
                    Load more
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
