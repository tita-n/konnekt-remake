"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Search, Users } from "lucide-react";
import type { CommunityCardView, CommunityDiscoverPayload } from "@/lib/communities/types";
import { COMMUNITY_CATEGORIES, type CommunityCategory } from "@/lib/domain/community";
import { apiGet } from "@/lib/posts/client";
import { Chip, TextField } from "@/components/ui/form-controls";
import { EmptyState } from "@/components/ui/feedback";
import { ButtonLink } from "@/components/ui/button";
import { CommunityCard, CommunityIcon } from "./community-card";

export function CommunitySearch({ initial }: { initial: CommunityDiscoverPayload }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CommunityCategory | null>(null);
  const [communities, setCommunities] = useState<CommunityCardView[]>(initial.trending);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
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
        if (current === requestId.current) setCommunities(data.communities);
      } catch (err) {
        if (current === requestId.current) setError(err instanceof Error ? err.message : "Couldn't search.");
      } finally {
        if (current === requestId.current) setLoading(false);
      }
    }, 260);
    return () => window.clearTimeout(timer);
  }, [query, category]);

  return (
    <div className="px-3 pb-8">
      <header className="pb-3 pt-5">
        <h1 className="text-h1 text-fg">Search</h1>
        <p className="mt-1 text-small text-fg-muted">Find communities across your university.</p>
      </header>
      <TextField
        label="Search communities"
        hideLabel
        type="search"
        autoFocus
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search communities by name or topic"
        leading={<Search aria-hidden="true" className="size-4" />}
      />
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

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-small text-fg-muted">
          <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          Searching…
        </div>
      ) : error ? (
        <p className="mt-4 rounded-card border border-danger/30 bg-danger-soft px-4 py-3 text-small text-danger">{error}</p>
      ) : !query.trim() && !category ? (
        <section className="mt-5" aria-labelledby="popular-communities">
          <h2 id="popular-communities" className="font-display text-h3 font-bold text-fg">Popular communities</h2>
          <div className="mt-2 space-y-2">
            {initial.trending.map((community) => (
              <Link key={community.id} href={`/c/${community.slug}`} className="flex items-center gap-3 rounded-card border border-border bg-surface p-3">
                <CommunityIcon community={community} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-small font-bold text-fg">{community.name}</p>
                  <p className="truncate text-tiny text-fg-muted">{community.memberCount} members · {community.description}</p>
                </div>
              </Link>
            ))}
            {initial.suggested.map((community) => (
              <Link key={community.id} href={`/c/${community.slug}`} className="flex items-center gap-3 rounded-card border border-border bg-surface p-3">
                <CommunityIcon community={community} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-small font-bold text-fg">{community.name}</p>
                  <p className="truncate text-tiny text-fg-muted">{community.memberCount} members · {community.description}</p>
                </div>
              </Link>
            ))}
          </div>
          <div className="mt-4 rounded-card bg-accent-soft p-3.5 text-small text-accent-soft-fg">
            <p className="font-semibold">Can&apos;t find your people?</p>
            <p className="mt-0.5 text-tiny">Start a community for your course, hall or society.</p>
            <ButtonLink href="/communities/new" size="sm" variant="secondary" className="mt-2">
              Start a community
            </ButtonLink>
          </div>
        </section>
      ) : communities.length === 0 ? (
        <div className="mt-4 rounded-card border border-border bg-surface">
          <EmptyState illustration="search" compact title="No communities found" description="Try another name or category." />
        </div>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {communities.map((community) => (
            <CommunityCard key={community.id} community={community} />
          ))}
        </div>
      )}
      <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-tiny text-fg-subtle">
        <Users aria-hidden="true" className="size-3.5" />
        Community search stays inside your university.
      </p>
    </div>
  );
}
