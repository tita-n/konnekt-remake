import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Info } from "lucide-react";
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
    <div className="pb-4">
      <header className="sticky top-14 z-20 flex h-14 items-center border-b border-border bg-surface px-2">
        <Link href="/pulse" aria-label="Back to Pulse" className="flex size-11 items-center justify-center rounded-full text-fg hover:bg-surface-2">
          <ArrowLeft aria-hidden="true" className="size-5" />
        </Link>
        <h1 className="flex-1 truncate text-center font-display text-h2 text-fg">#{page.tag}</h1>
        <span className="size-11" aria-hidden="true" />
      </header>

      <div className="px-3.5 pt-3">
        <div className="flex h-[112px] overflow-hidden rounded-card border border-border/70 bg-accent-soft">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/seed/tech-summit.svg"
            alt={`#${page.tag} banner`}
            width={320}
            height={180}
            className="h-full w-1/2 object-cover"
          />
          <div className="flex w-1/2 flex-col justify-center px-4">
            <p className="truncate font-display text-[1.25rem] font-extrabold tracking-tight text-fg">#{page.tag}</p>
            <p className="mt-0.5 text-small font-medium text-fg-muted">
              {formatCount(page.postCount)} {page.postCount === 1 ? "post" : "posts"}
            </p>
          </div>
        </div>

        <p className="mt-3 flex items-center gap-2.5 rounded-button bg-accent-soft px-3.5 py-2.5 text-small text-accent-soft-fg">
          <Info aria-hidden="true" className="size-4 shrink-0 text-accent-ink" />
          <span>Showing posts from audiences you belong to.</span>
        </p>

        <div className="mt-3 flex overflow-hidden rounded-full border border-border bg-surface p-0.5" role="group" aria-label="Sort hashtag posts">
          {(["top", "latest"] as const).map((value) => (
            <Link
              key={value}
              href={`${base}?sort=${value}`}
              aria-current={sort === value ? "page" : undefined}
              className={cn(
                "flex h-9 flex-1 items-center justify-center rounded-full text-small font-semibold capitalize transition",
                sort === value ? "bg-accent text-accent-fg" : "text-fg-muted hover:text-fg",
              )}
            >
              {value}
            </Link>
          ))}
        </div>
      </div>

      <div className="space-y-2.5 px-3.5 py-3">
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
            className="flex h-11 items-center justify-center rounded-full border border-border bg-surface text-small font-semibold text-accent-ink"
          >
            Load more
          </Link>
        ) : null}
      </div>
    </div>
  );
}

