"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CloudOff, RefreshCw } from "lucide-react";
import type { CachedFeed } from "@/lib/offline/store";
import { readLatestCachedFeed } from "@/lib/offline/store";
import { Avatar } from "@/components/ui/display";
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
    <main id="main" className="mx-auto min-h-dvh w-full max-w-2xl px-3 pb-8 pt-4">
      <div className="flex items-start gap-2.5 rounded-card border border-warning/30 bg-warning-soft px-3 py-2.5 text-small text-warning" role="status">
        <CloudOff aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <p>You&apos;re offline. Showing your saved Pulse from {cached ? timeAgo(cached.savedAt) : "this device"}.</p>
      </div>

      {cached === undefined ? (
        <p className="py-12 text-center text-small text-fg-muted">Checking saved posts…</p>
      ) : cached === null || cached.posts.length === 0 ? (
        <div className="mt-4 rounded-card border border-border bg-surface px-5 py-10 text-center">
          <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-accent-soft text-accent">
            <CloudOff aria-hidden="true" className="size-7" />
          </span>
          <h1 className="mt-4 text-h3 text-fg">Nothing saved yet</h1>
          <p className="mt-1 text-small text-fg-muted">
            Open your Pulse once with a connection and the last page will be kept here for moments like this.
          </p>
          <Link href="/pulse" className="mt-5 inline-flex h-10 items-center gap-2 rounded-button border border-border px-4 text-small font-semibold text-accent">
            <RefreshCw aria-hidden="true" className="size-4" /> Try again
          </Link>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {cached.posts.map((post) => (
            <li key={post.id} className="rounded-card border border-border bg-surface p-4">
              <div className="flex items-center gap-2.5">
                <Avatar name={post.author.fullName} src={post.author.photoUrl} size="sm" verified />
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
      <div className="mt-4 flex justify-center">
        <Link href="/pulse" className="rounded-button bg-accent px-5 py-2.5 text-small font-semibold text-accent-fg">
          Reconnect
        </Link>
      </div>
    </main>
  );
}
