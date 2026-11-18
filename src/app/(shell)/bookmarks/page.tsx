import type { Metadata } from "next";
import Link from "next/link";
import { Lock, Search } from "lucide-react";
import { requireStudent } from "@/lib/auth/guards";
import { getBookmarks } from "@/lib/services/posts";
import { loadSocialViewer } from "@/lib/services/social";
import { PostCard } from "@/components/pulse/post-card";
import { EmptyState } from "@/components/ui/feedback";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Bookmarks" };
export const dynamic = "force-dynamic";

const TYPE_FILTERS = [
  { value: "ALL", label: "All" },
  { value: "POST", label: "Posts" },
  { value: "QUESTION", label: "Questions" },
  { value: "POLL", label: "Polls" },
] as const;

export default async function BookmarksPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; cursor?: string }>;
}) {
  const user = await requireStudent("/bookmarks");
  const viewer = await loadSocialViewer(user);
  const params = await searchParams;
  const type = TYPE_FILTERS.some((item) => item.value === params.type) ? (params.type as (typeof TYPE_FILTERS)[number]["value"]) : "ALL";
  const page = viewer ? await getBookmarks(viewer, { q: params.q, type, cursor: params.cursor }) : { posts: [], nextCursor: null, hasMore: false };
  const base = `/bookmarks?${new URLSearchParams({ ...(params.q ? { q: params.q } : {}), type }).toString()}`;

  return (
    <div className="px-3 pb-4">
      <header className="px-1 pt-5">
        <h1 className="text-h1 text-fg">Bookmarks</h1>
        <p className="mt-1 text-small text-fg-muted">Things worth coming back to.</p>
      </header>

      <p className="mt-4 flex items-center gap-2 rounded-card bg-accent-soft px-3 py-2.5 text-small text-accent-soft-fg">
        <Lock aria-hidden="true" className="size-4 shrink-0" />
        Only you can see your bookmarks.
      </p>

      <form method="get" action="/bookmarks" className="mt-3 flex gap-2" role="search">
        <label htmlFor="bookmark-search" className="sr-only">Search your bookmarks</label>
        <div className="relative flex-1">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
          <input
            id="bookmark-search"
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Search your bookmarks"
            className="h-11 w-full rounded-input border border-border bg-surface pl-9 pr-3 text-small text-fg placeholder:text-fg-subtle focus:border-accent"
          />
        </div>
        {params.type ? <input type="hidden" name="type" value={params.type} /> : null}
      </form>

      <div className="mt-3 flex gap-1.5 overflow-x-auto no-scrollbar" role="group" aria-label="Filter bookmarks">
        {TYPE_FILTERS.map((item) => (
          <Link
            key={item.value}
            href={`/bookmarks?${new URLSearchParams({ type: item.value, ...(params.q ? { q: params.q } : {}) }).toString()}`}
            aria-current={type === item.value ? "page" : undefined}
            className={cn(
              "inline-flex h-9 shrink-0 items-center rounded-chip px-3 text-small font-semibold",
              type === item.value ? "bg-accent text-accent-fg" : "border border-border bg-surface text-fg-muted",
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <div className="mt-3 space-y-3">
        {page.posts.length === 0 ? (
          <div className="rounded-card border border-border bg-surface">
            <EmptyState
              illustration="search"
              title={params.q ? "No bookmarks match" : "No bookmarks yet"}
              description={params.q ? "Try a different search or filter." : "Tap the bookmark icon on a post and it will show up here, privately."}
            />
          </div>
        ) : (
          page.posts.map((post) => <PostCard key={post.id} post={post} />)
        )}
        {page.hasMore && page.nextCursor ? (
          <Link href={`${base}&cursor=${encodeURIComponent(page.nextCursor)}`} className="flex h-11 items-center justify-center rounded-button border border-border bg-surface text-small font-semibold text-accent">
            Load more
          </Link>
        ) : null}
      </div>
    </div>
  );
}
