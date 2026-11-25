"use client";

import { useCallback, useState } from "react";
import { Megaphone, PenLine, RefreshCw } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/display";
import { apiGet } from "@/lib/posts/client";
import { cn } from "@/lib/utils";
import { ANNOUNCEMENT_CATEGORIES, type AnnouncementCategory } from "@/lib/domain/announcements";
import { AnnouncementCard } from "./announcement-card";
import { AnnouncementBanners } from "./banners";
import type { AnnouncementBanner, SerializedAnnouncement } from "@/lib/services/announcements";

type FeedItem = SerializedAnnouncement & { acknowledged: boolean };
type Feed = { announcements: FeedItem[]; nextCursor: string | null };

export function OfficialChannel({
  initialFeed,
  banners,
  accounts,
  canPost,
  timezone,
}: {
  initialFeed: Feed;
  banners: AnnouncementBanner;
  accounts: Array<{ id: string; name: string; slug: string; canPost: boolean }>;
  canPost: boolean;
  timezone: string;
}) {
  const [feed, setFeed] = useState(initialFeed);
  const [category, setCategory] = useState<AnnouncementCategory | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (nextCategory: AnnouncementCategory | null, nextUnread: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (nextCategory) params.set("category", nextCategory);
        if (nextUnread) params.set("unread", "1");
        const { data } = await apiGet<Feed>(`/api/announcements?${params.toString()}`);
        setFeed(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't load the official channel.");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return (
    <div className="space-y-4 pb-12">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-tiny font-bold uppercase tracking-widest text-accent-ink">
            <Megaphone aria-hidden="true" className="size-3.5" />
            Official channel
          </p>
          <h1 className="mt-1 text-h1 text-fg">From your university</h1>
          <p className="mt-1 text-small text-fg-muted">Announcements from verified official accounts. Read-only.</p>
        </div>
        {canPost ? (
          <ButtonLink href="/official/compose" size="sm" className="mt-1">
            <PenLine aria-hidden="true" className="size-4" />
            New
          </ButtonLink>
        ) : null}
      </header>

      {banners.critical || banners.official ? <AnnouncementBanners banners={banners} /> : null}

      {accounts.length > 0 ? (
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1" aria-label="Official accounts">
          {accounts.map((account) => (
            <span key={account.id} className="shrink-0 rounded-chip border border-border bg-surface px-3 py-1.5 text-tiny font-semibold text-fg">
              {account.name}
            </span>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setCategory(null);
            void load(null, unreadOnly);
          }}
          aria-pressed={category === null}
          className={cn(
            "min-h-9 rounded-chip border px-3 text-small font-semibold",
            category === null ? "border-accent bg-accent-soft text-accent-soft-fg" : "border-border text-fg-muted",
          )}
        >
          All
        </button>
        {ANNOUNCEMENT_CATEGORIES.map((entry) => (
          <button
            key={entry.value}
            type="button"
            onClick={() => {
              const next = category === entry.value ? null : entry.value;
              setCategory(next);
              void load(next, unreadOnly);
            }}
            aria-pressed={category === entry.value}
            className={cn(
              "min-h-9 rounded-chip border px-3 text-small font-semibold",
              category === entry.value ? "border-accent bg-accent-soft text-accent-soft-fg" : "border-border text-fg-muted",
            )}
          >
            {entry.label}
          </button>
        ))}
        <label className="ml-auto flex min-h-9 items-center gap-2 text-small font-semibold text-fg">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(change) => {
              setUnreadOnly(change.target.checked);
              void load(category, change.target.checked);
            }}
            className="size-4 accent-[var(--accent)]"
          />
          Unread
        </label>
      </div>

      {loading ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading announcements">
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} className="h-40 w-full" rounded="rounded-card" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-card border border-border bg-surface">
          <ErrorState description={error} onRetry={() => void load(category, unreadOnly)} />
        </div>
      ) : feed.announcements.length === 0 ? (
        <div className="rounded-card border border-border bg-surface">
          <EmptyState
            illustration="notifications"
            title={unreadOnly ? "You're all caught up" : "No announcements yet"}
            description="Verified university accounts will post notices here. Critical notices appear on Pulse until you acknowledge them."
          />
        </div>
      ) : (
        <ul className="space-y-3">
          {feed.announcements.map((announcement) => (
            <li key={announcement.id}>
              <AnnouncementCard announcement={announcement} acknowledged={announcement.acknowledged} timezone={timezone} />
            </li>
          ))}
        </ul>
      )}
      {feed.nextCursor ? (
        <button
          type="button"
          onClick={async () => {
            setLoading(true);
            try {
              const params = new URLSearchParams({ cursor: feed.nextCursor ?? "" });
              if (category) params.set("category", category);
              if (unreadOnly) params.set("unread", "1");
              const { data } = await apiGet<Feed>(`/api/announcements?${params.toString()}`);
              setFeed({ announcements: [...feed.announcements, ...data.announcements], nextCursor: data.nextCursor });
            } catch (err) {
              setError(err instanceof Error ? err.message : "Couldn't load more.");
            } finally {
              setLoading(false);
            }
          }}
          className="mx-auto flex min-h-11 items-center gap-2 rounded-button border border-border px-4 text-small font-semibold text-fg hover:bg-surface-2"
        >
          <RefreshCw aria-hidden="true" className="size-4" />
          Load more
        </button>
      ) : null}
    </div>
  );
}
