"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, Check, Clock, CloudOff, Loader2, Plus, RefreshCw, TrendingUp, WifiOff } from "lucide-react";
import type { FeedFilter, FeedFilterOption, FeedPage, TrendingTag } from "@/lib/posts/types";
import { formatCompactCount } from "@/lib/domain/card-presentation";
import { apiGet } from "@/lib/posts/client";
import { cacheFeed, flushOutbox, listOutbox, readCachedFeed } from "@/lib/offline/store";
import { Button, ButtonLink } from "@/components/ui/button";
import { Chip } from "@/components/ui/form-controls";
import { Skeleton, SkeletonText } from "@/components/ui/display";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { useToast } from "@/components/providers/toast-provider";
import { cn } from "@/lib/utils";
import { PostCard } from "./post-card";

const NEW_POST_POLL_MS = 45_000;

function useDataSaver(): boolean {
  const [saveData, setSaveData] = useState(false);
  useEffect(() => {
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    setSaveData(Boolean(connection?.saveData) || window.matchMedia("(prefers-reduced-data: reduce)").matches);
  }, []);
  return saveData;
}

export function PulseFeed({
  viewerId,
  initialFeed,
  initialTrending,
  filters,
}: {
  viewerId: string;
  initialFeed: FeedPage;
  initialTrending: TrendingTag[];
  filters: FeedFilterOption[];
}) {
  const [filter, setFilter] = useState<FeedFilter>("all");
  const [feed, setFeed] = useState<FeedPage>(initialFeed);
  const [trending, setTrending] = useState<TrendingTag[]>(initialTrending);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [newCount, setNewCount] = useState(0);
  const [pending, setPending] = useState(0);
  const [outboxFailed, setOutboxFailed] = useState(false);
  const [pull, setPull] = useState(0);
  const pullStart = useRef<number | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const etag = useRef<string | null>(null);
  const latest = useRef<string | null>(initialFeed.posts[0]?.createdAt ?? null);
  const { toast } = useToast();
  const dataSaver = useDataSaver();

  useEffect(() => {
    latest.current = feed.posts[0]?.createdAt ?? null;
  }, [feed.posts]);

  const loadFirst = useCallback(
    async (nextFilter: FeedFilter, options: { quietly?: boolean } = {}) => {
      if (!options.quietly) setLoading(true);
      setError(null);
      try {
        const { data } = await apiGet<FeedPage>(`/api/feed?filter=${nextFilter}`);
        setFeed(data);
        setNewCount(0);
        etag.current = null;
        await cacheFeed(viewerId, nextFilter, data.posts);
        if (!options.quietly) window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (err) {
        if (!options.quietly) setError(err instanceof Error ? err.message : "Couldn't load your Pulse.");
      } finally {
        if (!options.quietly) setLoading(false);
      }
    },
    [viewerId],
  );

  useEffect(() => {
    void cacheFeed(viewerId, "all", initialFeed.posts);
  }, [viewerId, initialFeed]);

  useEffect(() => {
    setOnline(navigator.onLine);
    const onOnline = () => {
      setOnline(true);
      void syncOutbox();
    };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    if (!navigator.onLine) {
      void readCachedFeed(viewerId).then((cached) => {
        if (cached) setFeed({ posts: cached.posts, nextCursor: null, hasMore: false });
      });
    }
    void syncOutbox();
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewerId]);

  async function syncOutbox() {
    const items = await listOutbox(viewerId);
    setPending(items.length);
    setOutboxFailed(items.some((item) => item.status === "failed"));
    if (items.length === 0) return;
    const result = await flushOutbox(viewerId);
    const remaining = await listOutbox(viewerId);
    setPending(remaining.length);
    setOutboxFailed(remaining.some((item) => item.status === "failed"));
    if (result.sent > 0) {
      toast({ title: `${result.sent} queued ${result.sent === 1 ? "post" : "posts"} sent`, variant: "success" });
      void loadFirst(filter, { quietly: true });
    }
  }

  useEffect(() => {
    if (!online || dataSaver) return;
    let cancelled = false;
    const check = async () => {
      if (document.visibilityState !== "visible" || !document.hasFocus() || !latest.current) return;
      try {
        const headers: HeadersInit = etag.current ? { "If-None-Match": etag.current } : {};
        const response = await fetch(`/api/feed/new?filter=${filter}&since=${encodeURIComponent(latest.current)}`, {
          headers,
        });
        if (cancelled || response.status === 304) return;
        if (!response.ok) return;
        etag.current = response.headers.get("ETag");
        const data = (await response.json()) as { count?: number };
        setNewCount(typeof data.count === "number" ? data.count : 0);
      } catch {
        // Best effort polling.
      }
    };
    const timer = window.setInterval(check, NEW_POST_POLL_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onVisibility);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onVisibility);
    };
  }, [online, dataSaver, filter]);

  async function changeFilter(next: FeedFilter) {
    if (next === filter) return;
    setFilter(next);
    setNewCount(0);
    await loadFirst(next);
    try {
      const { data } = await apiGet<{ tags: TrendingTag[] }>(`/api/feed/trending?filter=${next}`);
      setTrending(data.tags);
    } catch {
      // Supplementary trending pills.
    }
  }

  async function loadMore() {
    if (loadingMore || !feed.nextCursor) return;
    setLoadingMore(true);
    try {
      const { data } = await apiGet<FeedPage>(`/api/feed?filter=${filter}&cursor=${encodeURIComponent(feed.nextCursor)}`);
      setFeed((current) => {
        const seen = new Set(current.posts.map((post) => post.id));
        return {
          posts: [...current.posts, ...data.posts.filter((post) => !seen.has(post.id))],
          nextCursor: data.nextCursor,
          hasMore: data.hasMore,
        };
      });
    } catch (err) {
      toast({ title: "Couldn't load more posts", description: err instanceof Error ? err.message : undefined, variant: "error" });
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    const node = sentinel.current;
    if (!node || !feed.hasMore || loading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: "500px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feed.hasMore, feed.nextCursor, loading]);

  function onTouchStart(event: React.TouchEvent) {
    pullStart.current = window.scrollY <= 0 ? event.touches[0]?.clientY ?? null : null;
  }

  function onTouchMove(event: React.TouchEvent) {
    if (pullStart.current === null || loading) return;
    const delta = (event.touches[0]?.clientY ?? 0) - pullStart.current;
    if (delta > 0 && window.scrollY <= 0) setPull(Math.min(84, delta * 0.45));
  }

  function onTouchEnd() {
    if (pull > 52) void loadFirst(filter);
    setPull(0);
    pullStart.current = null;
  }

  const showOfflineEmpty = !online && feed.posts.length === 0;

  return (
    <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <h1 className="sr-only">Pulse</h1>

      {pull > 0 ? (
        <div className="flex h-8 items-center justify-center text-tiny text-fg-subtle" style={{ height: `${Math.min(pull, 56)}px` }} aria-hidden="true">
          <RefreshCw className={cn("size-4", pull > 52 && "text-accent-ink")} style={{ transform: `rotate(${pull * 4}deg)` }} />
        </div>
      ) : null}

      <div className="glass sticky top-14 z-30 border-b border-border/60">
        <div className="relative">
          <div className="no-scrollbar flex gap-2 overflow-x-auto px-3.5 py-2.5 pr-8" role="group" aria-label="Filter your Pulse">
            {filters.map((option) => {
              const selected = filter === option.value;
              return (
                <Chip
                  key={option.value}
                  selected={selected}
                  onClick={() => void changeFilter(option.value)}
                  icon={selected ? <Check aria-hidden="true" className="size-3.5" strokeWidth={2.5} /> : undefined}
                  className="min-h-8 shrink-0 rounded-full px-3.5 text-small"
                >
                  {option.label}
                </Chip>
              );
            })}
          </div>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-surface/90 to-transparent"
          />
        </div>
      </div>

      {!online ? (
        <div className="mx-3.5 mt-2 flex items-center gap-2.5 rounded-button border border-warning/30 bg-highlight-soft px-3.5 py-2 text-small font-medium text-highlight-fg" role="status">
          <WifiOff aria-hidden="true" className="size-4 shrink-0" />
          <span>You&apos;re offline. Showing saved posts.</span>
        </div>
      ) : null}

      {newCount > 0 ? (
        <div className="sticky top-[7.15rem] z-20 flex justify-center py-2">
          <button
            type="button"
            onClick={() => void loadFirst(filter)}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-accent px-4 text-small font-semibold text-accent-fg shadow-pill"
          >
            <ArrowUp aria-hidden="true" className="size-4" />
            {newCount} new {newCount === 1 ? "post" : "posts"}
          </button>
        </div>
      ) : null}

      <div className="space-y-3 px-3.5 pb-4 pt-2.5">
        {loading ? (
          <FeedSkeleton />
        ) : error ? (
          <div className="rounded-card border border-border bg-surface">
            <ErrorState title="We couldn't load this." description="Check your connection and try again." onRetry={() => void loadFirst(filter)} />
          </div>
        ) : showOfflineEmpty ? (
          <div className="rounded-card border border-border bg-surface">
            <EmptyState
              illustration="pulse"
              title="No saved posts yet"
              description="Once you've browsed your Pulse, the last page is kept here for offline moments like this."
              action={<Button className="rounded-full px-6" onClick={() => void loadFirst(filter)} leftIcon={<RefreshCw aria-hidden="true" className="size-4" />}>Try again</Button>}
            />
          </div>
        ) : feed.posts.length === 0 ? (
          <div className="rounded-card border border-border bg-surface">
            <EmptyState
              illustration="pulse"
              title="Nothing here yet"
              description={filter === "all" ? "Be the first to post to your campus." : `Be the first to post to your ${filter}.`}
              action={
                <ButtonLink href="/compose?type=post" className="rounded-full px-6" leftIcon={<Plus aria-hidden="true" className="size-4" />}>
                  Create a post
                </ButtonLink>
              }
            />
          </div>
        ) : (
          <>
            {feed.posts.slice(0, 2).map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onDeleted={(id) => setFeed((current) => ({ ...current, posts: current.posts.filter((item) => item.id !== id) }))}
                onChanged={() => void loadFirst(filter, { quietly: true })}
              />
            ))}

            {trending.length > 0 ? (
              <section aria-label="Trending on campus" className="rounded-card border border-accent/15 bg-accent-soft px-3.5 py-3 lg:hidden">
                <h2 className="flex items-center gap-1.5 font-display text-[0.9375rem] font-bold text-fg">
                  <TrendingUp aria-hidden="true" className="size-4 text-accent-ink" />
                  Trending on campus
                </h2>
                <ul className="no-scrollbar mt-2 flex gap-2 overflow-x-auto pb-0.5">
                  {trending.map((tag) => (
                    <li key={tag.tag} className="shrink-0">
                      <Link
                        href={`/hashtag/${tag.tag}`}
                        className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-small font-medium text-accent-ink transition hover:border-accent"
                      >
                        <span>#{tag.tag}</span>
                        {tag.postCount > 0 ? <span className="text-tiny tabular-nums text-fg-subtle">{formatCompactCount(tag.postCount)}</span> : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {feed.posts.slice(2).map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onDeleted={(id) => setFeed((current) => ({ ...current, posts: current.posts.filter((item) => item.id !== id) }))}
                onChanged={() => void loadFirst(filter, { quietly: true })}
              />
            ))}
          </>
        )}

        {pending > 0 ? (
          <button
            type="button"
            onClick={() => void syncOutbox()}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-[16px] border px-4 py-3.5 text-left text-small font-medium",
              outboxFailed ? "border-danger/30 bg-danger-soft text-danger" : "border-border bg-surface text-fg-muted",
            )}
          >
            {outboxFailed ? (
              <CloudOff aria-hidden="true" className="size-4 shrink-0" />
            ) : !online ? (
              <Clock aria-hidden="true" className="size-4 shrink-0" />
            ) : (
              <Loader2 aria-hidden="true" className="size-4 shrink-0 animate-spin" />
            )}
            <span className="flex-1">
              {outboxFailed
                ? `${pending} ${pending === 1 ? "post" : "posts"} failed. Tap to retry.`
                : !online
                  ? "Sending..."
                  : `Sending ${pending} ${pending === 1 ? "post" : "posts"}…`}
            </span>
          </button>
        ) : null}

        {feed.hasMore ? (
          <div ref={sentinel} className="flex justify-center py-4">
            {loadingMore ? <Loader2 aria-hidden="true" className="size-5 animate-spin text-fg-subtle" /> : null}
          </div>
        ) : feed.posts.length > 0 && !loading ? (
          <p className="py-4 text-center text-tiny text-fg-subtle">You&apos;re all caught up.</p>
        ) : null}
      </div>
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      {[0, 1, 2].map((index) => (
        <div key={index} className="rounded-[16px] border border-border bg-surface p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="size-11" rounded="rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-2/5" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <SkeletonText lines={2} />
            <Skeleton className="mt-2 h-24 w-full" rounded="rounded-[12px]" />
          </div>
          <div className="mt-4 flex justify-between gap-4">
            <Skeleton className="h-4 w-12" rounded="rounded-full" />
            <Skeleton className="h-4 w-12" rounded="rounded-full" />
            <Skeleton className="h-4 w-12" rounded="rounded-full" />
            <Skeleton className="h-4 w-12" rounded="rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
