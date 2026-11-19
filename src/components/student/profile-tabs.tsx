"use client";

import Link from "next/link";
import { useState } from "react";
import { Bookmark } from "lucide-react";
import type { PostView } from "@/lib/posts/types";
import type { ProfileReply } from "@/lib/services/posts";
import { PostCard } from "@/components/pulse/post-card";
import { EmptyState } from "@/components/ui/feedback";
import { RichText } from "@/components/pulse/rich-text";
import { cn, timeAgo } from "@/lib/utils";

type Tab = "posts" | "replies" | "bookmarks";

export function ProfileTabs({
  initialPosts,
  replies,
  bookmarks,
  isSelf,
}: {
  initialPosts: PostView[];
  replies: ProfileReply[];
  bookmarks: PostView[];
  isSelf: boolean;
}) {
  const [tab, setTab] = useState<Tab>("posts");
  const tabs: Array<{ value: Tab; label: string; private?: boolean }> = [
    { value: "posts", label: "Posts" },
    { value: "replies", label: "Replies" },
    ...(isSelf ? [{ value: "bookmarks" as const, label: "Bookmarks", private: true }] : []),
  ];

  return (
    <div className="mt-4">
      <div className="flex overflow-hidden rounded-full border border-border" role="tablist" aria-label="Profile content">
        {tabs.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={tab === item.value}
            onClick={() => setTab(item.value)}
            className={cn(
              "flex h-10 flex-1 items-center justify-center gap-1.5 text-small font-semibold transition-colors",
              tab === item.value ? "bg-accent text-accent-fg" : "bg-surface text-fg-muted hover:bg-surface-2",
            )}
          >
            {item.label}
            {item.private ? <Bookmark aria-hidden="true" className="size-3.5" /> : null}
          </button>
        ))}
      </div>

      <div className="mt-3">
        {tab === "posts" ? (
          initialPosts.length === 0 ? (
            <div className="rounded-card border border-border bg-surface">
              <EmptyState title="No posts yet" description={isSelf ? "Your posts will appear here." : "This student hasn't posted yet."} compact />
            </div>
          ) : (
            <div className="space-y-2">
              {initialPosts.map((post) => <PostCard key={post.id} post={post} />)}
            </div>
          )
        ) : tab === "replies" ? (
          replies.length === 0 ? (
            <div className="rounded-card border border-border bg-surface">
              <EmptyState title="No replies yet" description={isSelf ? "Comments and answers you write will appear here." : "This student hasn't replied yet."} compact />
            </div>
          ) : (
            <ul className="space-y-2">
              {replies.map((reply) => (
                <li key={reply.id}>
                  <Link href={`/p/${reply.postId}#comments`} className="block rounded-card border border-border bg-surface p-3.5 hover:border-border-strong">
                    <p className="text-tiny text-fg-subtle">
                      Reply to {reply.postType === "QUESTION" ? "a question" : "a post"} · {timeAgo(reply.createdAt)}
                    </p>
                    {reply.postQuestionTitle ? <p className="mt-1 truncate text-small font-semibold text-fg">{reply.postQuestionTitle}</p> : null}
                    <RichText body={reply.body} className="mt-1 line-clamp-3 whitespace-pre-line text-small text-fg-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          )
        ) : bookmarks.length === 0 ? (
          <div className="rounded-card border border-border bg-surface">
            <EmptyState title="No bookmarks yet" description="Your private saved posts will appear here." compact />
          </div>
        ) : (
          <div className="space-y-2">
            {bookmarks.map((post) => <PostCard key={post.id} post={post} />)}
          </div>
        )}
      </div>
    </div>
  );
}
