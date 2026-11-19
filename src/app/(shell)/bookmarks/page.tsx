import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Lock, Search } from "lucide-react";
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
    <div className="pb-4">
      <header className="sticky top-14 z-20 flex h-14 items-center border-b border-border bg-surface px-2">
        <Link href="/profile/me" aria-label="Back to profile" className="flex size-10 items-center justify-center rounded-full text-fg hover:bg-surface-2">
          <ArrowLeft aria-hidden="true" className="size-5" />
        </Link>
        <h1 className="flex-1 text-center text-h2 text-fg">Bookmarks</h1>
        <span className="size-10" aria-hidden="true" />
      </header>

      <div className="px-3 pt-3">
      <p className="flex items-center gap-2.5 rounded-[12px] bg-accent-soft px-3.5 py-3 text-small text-accent-soft-fg">
        <Lock aria-hidden="true" className="size-4 shrink-0" />
        Only you can see your bookmarks.
      </p>

      <form method="get" action="/bookmarks" className="mt-2.5 flex gap-2" role="search">
        <label htmlFor="bookmark-search" className="sr-only">Search your bookmarks</label>
        <div className="relative flex-1">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
          <input
            id="bookmark-search"
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Search your bookmarks"
            className="h-11 w-full rounded-[12px] border border-border bg-surface pl-9 pr-3 text-small text-fg placeholder:text-fg-subtle focus:border-accent"
          />
        </div>
        {params.type ? <input type="hidden" name="type" value={params.type} /> : null}
      </form>

      <div className="mt-2.5 flex gap-1.5 overflow-x-auto no-scrollbar" role="group" aria-label="Filter bookmarks">
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

      <div className="mt-2.5 space-y-2">
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
    </div>
  );
}
