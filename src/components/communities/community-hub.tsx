"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Check, Compass, Plus, Search, Sparkles, TrendingUp, Users, X } from "lucide-react";
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
import { Avatar, Skeleton } from "@/components/ui/display";
import { SegmentedControl } from "@/components/ui/navigation";
import { useToast } from "@/components/providers/toast-provider";
import { CommunityCard, CommunityIcon, CommunityListRow, CommunityTile } from "./community-card";

type HubView = "mine" | "discover";

const SKELETON_KEYS = ["a", "b", "c", "d"] as const;

function DiscoverSkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      {SKELETON_KEYS.map((key) => (
        <div key={key} className="flex min-h-[88px] items-start gap-3 rounded-card border border-border bg-surface p-4">
          <Skeleton className="size-14" rounded="rounded-full" />
          <div className="min-w-0 flex-1 space-y-2 pt-1">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/5" />
          </div>
          <Skeleton className="h-9 w-20" rounded="rounded-button" />
        </div>
      ))}
    </div>
  );
}

export function CommunityHub({
  mine,
  discover,
}: {
  mine: CommunityMinePayload;
  discover: CommunityDiscoverPayload;
}) {
  const [view, setView] = useState<HubView>(mine.active.length + mine.rest.length > 0 ? "mine" : "discover");
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
  const myCommunities = [...mine.active, ...mine.rest];

  return (
    <div className="pb-10 pt-1">
      <header className="px-4 pb-3 pt-3">
        <p className="text-tiny font-semibold uppercase tracking-[0.14em] text-accent-ink">Your campus circles</p>
        <div className="mt-1 flex items-center justify-between gap-3">
          <h1 className="font-display text-h1 font-bold text-fg">Communities</h1>
          <ButtonLink
            href="/communities/new"
            size="sm"
            variant="secondary"
            className="h-9 shrink-0"
            aria-label="Create a community"
            leftIcon={<Plus className="size-4" />}
          >
            New
          </ButtonLink>
        </div>
        <p className="mt-1 max-w-md text-small text-fg-muted">
          Course groups, halls, teams and societies — only for verified students at your university.
        </p>
      </header>

      {invitations.length > 0 ? (
        <section
          className="mx-4 mb-3 rounded-card border border-accent/30 bg-accent-soft p-4"
          aria-labelledby="invitations-title"
        >
          <h2 id="invitations-title" className="flex items-center gap-1.5 text-[0.9375rem] font-semibold text-accent-soft-fg">
            <MailOpen />
            Invitations
            <span className="nums text-tiny font-semibold">({invitations.length})</span>
          </h2>
          <ul className="mt-2 space-y-2">
            {invitations.map((invite) => (
              <li key={invite.id} className="rounded-[12px] border border-border bg-surface p-3">
                <div className="flex items-center gap-3">
                  <span className="flex shrink-0 -space-x-2">
                    <CommunityIcon community={invite.community} size="sm" className="ring-2 ring-surface" />
                    {invite.invitedBy ? (
                      <Avatar
                        name={invite.invitedBy.fullName}
                        seed={invite.invitedBy.username}
                        size="xs"
                        className="ring-2 ring-surface"
                      />
                    ) : null}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-small font-semibold text-fg">{invite.community.name}</p>
                    <p className="truncate text-tiny text-fg-muted">
                      Invited by {invite.invitedBy?.fullName ?? "a moderator"}
                    </p>
                  </div>
                </div>
                <div className="mt-2.5 flex items-center gap-2">
                  <Button size="sm" className="h-9 flex-1" onClick={() => void accept(invite)} leftIcon={<Check className="size-4" />}>
                    Accept
                  </Button>
                  <Button size="sm" variant="ghost" className="h-9 flex-1 border border-border text-fg-muted" onClick={() => void decline(invite)}>
                    Decline
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="px-4 pb-2 pt-1">
        <SegmentedControl
          label="Communities views"
          value={view}
          onChange={setView}
          options={[
            { value: "mine", label: `Mine${myCommunities.length > 0 ? ` · ${myCommunities.length}` : ""}` },
            { value: "discover", label: "Discover" },
          ]}
        />
      </div>

      {view === "mine" ? (
        <section className="mt-2 space-y-4 px-4" aria-labelledby="mine-title">
          <div className="flex items-center justify-between gap-3">
            <h2 id="mine-title" className="section-title">
              Your communities
            </h2>
            <span className="text-tiny nums text-fg-subtle">{myCommunities.length} joined</span>
          </div>
          {myCommunities.length === 0 ? (
            <div className="rounded-card border border-border bg-surface">
              <EmptyState
                illustration="communities"
                compact
                title="No communities yet"
                description="Join a circle below, or start one for your course, hall or society."
                action={
                  <ButtonLink href="/communities/new" size="sm" variant="secondary" className="h-9">
                    Start a community
                  </ButtonLink>
                }
              />
            </div>
          ) : (
            <>
              {mine.active.length > 0 ? (
                <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1">
                  {mine.active.map((community) => (
                    <CommunityTile key={community.id} community={community} />
                  ))}
                </div>
              ) : null}
              {mine.rest.length > 0 ? (
                <div className="space-y-3">
                  {mine.rest.map((community) => (
                    <CommunityListRow key={community.id} community={community} />
                  ))}
                </div>
              ) : null}
            </>
          )}
        </section>
      ) : null}

      {view === "discover" ? (
        <section className="px-4" aria-labelledby="discover-title">
          <h2 id="discover-title" className="sr-only">
            Discover
          </h2>
          <div className="sticky top-14 z-20 -mx-4 border-b border-border bg-bg px-4 pb-2 pt-2">
            <TextField
              label="Search communities"
              hideLabel
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name or topic"
              className="h-12"
              leading={<Search aria-hidden="true" className="size-4" />}
            />
            <div className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1">
              <Chip selected={!category} onClick={() => setCategory(null)}>
                All
              </Chip>
              {COMMUNITY_CATEGORIES.map((entry) => (
                <Chip key={entry.value} selected={category === entry.value} onClick={() => setCategory(category === entry.value ? null : entry.value)}>
                  {entry.label}
                </Chip>
              ))}
            </div>
          </div>

          <div className="mt-2 space-y-3" aria-busy={loading}>
            <Link
              href="/communities/new"
              className="flex min-h-[88px] items-center gap-3 rounded-card border-[1.5px] border-dashed border-accent/60 bg-surface p-4 transition-colors duration-150 hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <span className="accent-tile flex size-12 shrink-0 items-center justify-center rounded-full">
                <Plus aria-hidden="true" className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[0.9375rem] font-semibold text-accent-ink">Create community</span>
                <span className="mt-0.5 block text-tiny leading-relaxed text-fg-muted">
                  Start a course group, hall or society in a few taps.
                </span>
              </span>
            </Link>

            {loading ? (
              <DiscoverSkeleton />
            ) : error ? (
              <div className="rounded-card border border-danger/30 bg-danger-soft px-4 py-3 text-small font-medium text-danger" role="alert">
                {error}
              </div>
            ) : payload.communities.length === 0 ? (
              <div className="rounded-card border border-border bg-surface">
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
                      <ButtonLink href="/communities/new" size="sm" variant="secondary" className="h-9" leftIcon={<Users className="size-4" />}>
                        Start a community
                      </ButtonLink>
                    )
                  }
                />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2">
                  {payload.communities.map((community) => (
                    <CommunityCard key={community.id} community={community} showActivity />
                  ))}
                </div>
                {payload.hasMore ? (
                  <div className="flex justify-center pt-1">
                    <Button variant="secondary" size="sm" className="h-9" loading={loadingMore} onClick={() => void loadMore()}>
                      Load more
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </section>
      ) : null}

      {view === "mine" && !filtered ? (
        <div className="mt-5 space-y-5">
          {payload.trending.length > 0 ? (
            <HubRail
              id="trending-communities"
              title="Trending communities"
              icon={<TrendingUp aria-hidden="true" className="size-4 text-accent-ink" />}
              communities={payload.trending.slice(0, 3)}
            />
          ) : null}
          {payload.suggested.length > 0 ? (
            <HubRail
              id="suggested-communities"
              title="Suggested for you"
              icon={<Sparkles aria-hidden="true" className="size-4 text-accent-ink" />}
              communities={payload.suggested.slice(0, 3)}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** A short discovery rail with a header and member-count rows. */
function HubRail({
  id,
  title,
  icon,
  communities,
  action,
}: {
  id: string;
  title: string;
  icon: React.ReactNode;
  communities: CommunityCardView[];
  action?: React.ReactNode;
}) {
  return (
    <section className="px-4" aria-labelledby={id}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 id={id} className="section-title flex items-center gap-1.5">
          {icon}
          {title}
        </h2>
        {action}
      </div>
      <div className="space-y-3">
        {communities.map((community) => (
          <CommunityListRow key={community.id} community={community} />
        ))}
      </div>
    </section>
  );
}

/** Small inline mark for the invitations header (Lucide has no matching glyph). */
function MailOpen() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="size-4">
      <path d="M3 10.5 12 4l9 6.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="m3 10.5 9 6 9-6" />
    </svg>
  );
}
