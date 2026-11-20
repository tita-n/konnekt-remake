"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CloudOff, RefreshCw } from "lucide-react";
import type { CachedFeed } from "@/lib/offline/store";
import { readLatestCachedFeed } from "@/lib/offline/store";
import { Avatar } from "@/components/ui/display";
import { buttonStyles } from "@/components/ui/button-styles";
import { ClayIllustration } from "@/components/ui/clay-illustrations";
import { formatCount, timeAgo } from "@/lib/utils";
import { RichText } from "./rich-text";

/**
 * Read-only offline shell. It never calls an API and never renders controls
 * that would fail; the data is the last page this account cached on this
 * device, and logout deletes it.
 */
export function OfflineFeed() {
  const [cached, setCached] = useState<CachedFeed | null | undefined>(undefined);

  useEffect(() => {
    void readLatestCachedFeed().then(setCached);
  }, []);

  return (
    <main id="main" className="mx-auto min-h-dvh w-full max-w-2xl px-4 pb-10 pt-4">
      <div
        className="flex min-h-9 items-center gap-2.5 rounded-[12px] border border-warning/30 bg-highlight-soft px-3.5 py-2 text-small font-medium text-highlight-fg"
        role="status"
      >
        <CloudOff aria-hidden="true" className="size-4 shrink-0" />
        <p>
          You&apos;re offline. Showing saved content
          {cached ? ` from ${timeAgo(cached.savedAt)}` : ""}.
        </p>
      </div>

      {cached === undefined ? (
        <p className="py-12 text-center text-small text-fg-muted">Checking saved posts…</p>
      ) : cached === null || cached.posts.length === 0 ? (
        <div className="mt-6 flex flex-col items-center rounded-card border border-border bg-surface px-6 py-10 text-center">
          <ClayIllustration kind="errorPlug" />
          <h1 className="mt-4 font-display text-h2 text-fg">Nothing saved yet</h1>
          <p className="mt-1.5 max-w-xs text-small text-fg-muted">
            Open your Pulse once with a connection and the last page will be kept here for moments like this.
          </p>
          <Link
            href="/pulse"
            className={buttonStyles({ variant: "primary", size: "lg", className: "mt-5 px-7" })}
          >
            <RefreshCw aria-hidden="true" className="size-4" /> Try again
          </Link>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {cached.posts.map((post) => (
            <li key={post.id} className="rounded-card border border-border bg-surface p-4">
              <div className="flex items-center gap-2.5">
                <Avatar name={post.author.fullName} seed={post.author.username} src={post.author.photoUrl} size="sm" verified />
                <div className="min-w-0">
                  <p className="truncate text-small font-semibold text-fg">{post.author.fullName}</p>
                  <p className="truncate text-tiny text-fg-subtle">@{post.author.username} · {timeAgo(post.createdAt)}</p>
                </div>
              </div>
              <p className="mt-1.5 text-tiny text-fg-subtle">to {post.audienceLabel}</p>
              {post.questionTitle ? <p className="mt-2 text-small font-semibold text-fg">{post.questionTitle}</p> : null}
              <RichText body={post.body} className="mt-1 line-clamp-6 whitespace-pre-line text-small text-fg" />
              <p className="mt-2 text-tiny text-fg-subtle">
                {formatCount(post.commentCount)} comments · {formatCount(post.reactionCount)} reactions
              </p>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 text-center text-tiny text-fg-subtle">
        Saved content is private to this account and is deleted when you log out.
      </p>
      {cached && cached.posts.length > 0 ? (
        <div className="mt-4 flex justify-center">
          <Link
            href="/pulse"
            className={buttonStyles({ variant: "primary", size: "lg", className: "px-7" })}
          >
            <RefreshCw aria-hidden="true" className="size-4" /> Try again
          </Link>
        </div>
      ) : null}
    </main>
  );
}
