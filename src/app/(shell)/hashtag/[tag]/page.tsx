import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Info } from "lucide-react";
import { requireStudent } from "@/lib/auth/guards";
import { getHashtagPage } from "@/lib/services/posts";
import { loadSocialViewer } from "@/lib/services/social";
import { PostCard } from "@/components/pulse/post-card";
import { EmptyState } from "@/components/ui/feedback";
import { cn, formatCount } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ tag: string }> }): Promise<Metadata> {
  const { tag } = await params;
  return { title: `#${tag}` };
}

export default async function HashtagPage({
  params,
  searchParams,
}: {
  params: Promise<{ tag: string }>;
  searchParams: Promise<{ sort?: string; cursor?: string }>;
}) {
  const { tag } = await params;
  const query = await searchParams;
  const user = await requireStudent(`/hashtag/${tag}`);
  const viewer = await loadSocialViewer(user);
  if (!viewer) notFound();
  const sort = query.sort === "latest" ? "latest" : "top";
  const page = await getHashtagPage(viewer, tag, sort, query.cursor);
  if (!page) notFound();

  const base = `/hashtag/${encodeURIComponent(page.tag)}`;
  return (
    <div>
      <header className="border-b border-border px-4 pb-4 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-h1 text-fg">#{page.tag}</h1>
            <p className="mt-1 text-small text-fg-muted">{formatCount(page.postCount)} {page.postCount === 1 ? "post" : "posts"} you can see</p>
          </div>
          <span className="rounded-card bg-accent-soft px-3 py-2 font-display text-2xl font-bold text-accent-soft-fg" aria-hidden="true">#</span>
        </div>
        <p className="mt-3 flex items-start gap-2 rounded-card bg-accent-soft px-3 py-2.5 text-small text-accent-soft-fg">
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          Showing posts from audiences you belong to. Counts include only what you can see.
        </p>
      </header>

      <div className="px-3 pt-3">
        <div className="flex rounded-chip border border-border bg-surface-2 p-1" role="group" aria-label="Sort hashtag posts">
          {(["top", "latest"] as const).map((value) => (
            <Link
              key={value}
              href={`${base}?sort=${value}`}
              aria-current={sort === value ? "page" : undefined}
              className={cn(
                "flex h-9 flex-1 items-center justify-center rounded-chip text-small font-semibold capitalize",
                sort === value ? "bg-accent text-accent-fg" : "text-fg-muted",
              )}
            >
              {value}
            </Link>
          ))}
        </div>
      </div>

      <div className="space-y-3 px-3 py-3">
        {page.posts.length === 0 ? (
          <div className="rounded-card border border-border bg-surface">
            <EmptyState illustration="search" title="No posts here yet" description={`No posts in your audiences use #${page.tag} yet.`} />
          </div>
        ) : (
          page.posts.map((post) => <PostCard key={post.id} post={post} />)
        )}
        {page.hasMore && page.nextCursor ? (
          <Link
            href={`${base}?sort=${sort}&cursor=${encodeURIComponent(page.nextCursor)}`}
            className="flex h-11 items-center justify-center rounded-button border border-border bg-surface text-small font-semibold text-accent"
          >
            Load more
          </Link>
        ) : null}
      </div>
    </div>
  );
}
