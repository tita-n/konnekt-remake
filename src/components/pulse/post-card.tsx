"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  BellOff,
  Bookmark,
  Check,
  ChevronRight,
  Copy,
  Download,
  Flag,
  Heart,
  Info,
  Link2,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Repeat2,
  Share2,
  ShieldBan,
  Trash2,
  Users,
  X,
} from "lucide-react";
import type { PostMediaView, PostView } from "@/lib/posts/types";
import { ApiError, apiDelete, apiPatch, apiPost } from "@/lib/posts/client";
import { REPORT_REASON_OPTIONS, type ReportReasonValue } from "@/lib/posts/report-reasons";
import { pollTimeRemaining, truncatePostBody } from "@/lib/posts/card-presentation";
import { formatCompactCount } from "@/lib/domain/card-presentation";
import { Avatar, VerifiedTick } from "@/components/ui/display";
import { Button, IconButton } from "@/components/ui/button";
import { BottomSheet, Dialog } from "@/components/ui/overlays";
import { useToast } from "@/components/providers/toast-provider";
import { cn, formatCount, timeAgo } from "@/lib/utils";
import { RichText } from "./rich-text";

function editedRecently(post: PostView): boolean {
  if (!post.editedAt) return false;
  return new Date(post.editedAt).getTime() - new Date(post.createdAt).getTime() > 15 * 60_000;
}

export function PostCard({
  post,
  expanded = false,
  onDeleted,
  onChanged,
  compact = false,
}: {
  post: PostView;
  expanded?: boolean;
  onDeleted?: (id: string) => void;
  onChanged?: () => void;
  compact?: boolean;
}) {
  const [local, setLocal] = useState(post);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [reactionsOpen, setReactionsOpen] = useState(false);
  const [people, setPeople] = useState<Array<{ username: string; fullName: string; photoUrl: string | null }> | null>(null);
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(post.body);
  const [saving, setSaving] = useState(false);
  const [showFull, setShowFull] = useState(expanded);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerMenu, setViewerMenu] = useState(false);
  const [viewerZoomed, setViewerZoomed] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [quoteBody, setQuoteBody] = useState("");
  const [quoteSubmitting, setQuoteSubmitting] = useState(false);
  const [repostBusy, setRepostBusy] = useState(false);
  const repostBusyRef = useRef(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    setLocal(post);
    setViewerZoomed(false);
  }, [post]);

  const removed = local.status !== "ACTIVE";
  const isSimpleRepost = local.type === "REPOST" && Boolean(local.repostOf) && !local.body.trim();
  const displayAuthor = isSimpleRepost && local.repostOf ? local.repostOf.author : local.author;
  const displayCreatedAt = isSimpleRepost && local.repostOf ? local.repostOf.createdAt : local.createdAt;
  const rawBody = isSimpleRepost && local.repostOf ? local.repostOf.body : local.body;
  const { text: body, truncated: isLong } = truncatePostBody(rawBody, showFull || expanded, 260);

  async function react() {
    const previous = local;
    const reacted = !local.viewer.reacted;
    setLocal({
      ...local,
      reactionCount: Math.max(0, local.reactionCount + (reacted ? 1 : -1)),
      viewer: { ...local.viewer, reacted },
    });
    try {
      const result = await apiPost<{ reacted: boolean; count: number }>(`/api/posts/${local.id}/reaction`);
      setLocal((current) => ({
        ...current,
        reactionCount: result.count,
        viewer: { ...current.viewer, reacted: result.reacted },
      }));
    } catch (error) {
      setLocal(previous);
      toast({ title: "Couldn't update your reaction", description: error instanceof Error ? error.message : undefined, variant: "error" });
    }
  }

  async function bookmark() {
    const previous = local;
    const bookmarked = !local.viewer.bookmarked;
    setLocal({ ...local, viewer: { ...local.viewer, bookmarked } });
    try {
      await apiPost(`/api/posts/${local.id}/bookmark`);
      toast({ title: bookmarked ? "Saved to bookmarks" : "Removed from bookmarks" });
    } catch (error) {
      setLocal(previous);
      toast({ title: "Couldn't update bookmarks", description: error instanceof Error ? error.message : undefined, variant: "error" });
    }
  }

  const repostTargetId = isSimpleRepost && local.repostOf ? local.repostOf.id : local.id;
  const reposted = isSimpleRepost ? true : local.viewer.reposted;
  const isOwnOriginal = !isSimpleRepost && local.isOwner;

  async function toggleRepost() {
    if (isOwnOriginal || repostBusyRef.current) return;
    repostBusyRef.current = true;
    setRepostBusy(true);
    const previous = local;
    const next = !reposted;
    setLocal((current) => ({
      ...current,
      repostCount: Math.max(0, current.repostCount + (next ? 1 : -1)),
      viewer: { ...current.viewer, reposted: next },
    }));
    try {
      if (next) {
        await apiPost(`/api/posts/${repostTargetId}/repost`, {}, { idempotencyKey: crypto.randomUUID() });
        toast({ title: "Reposted", description: "It appears on your profile and keeps the original audience." });
      } else {
        await apiDelete(`/api/posts/${repostTargetId}/repost`);
        toast({ title: "Repost removed" });
      }
      onChanged?.();
    } catch (error) {
      setLocal(previous);
      toast({ title: next ? "Couldn't repost" : "Couldn't undo repost", description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      repostBusyRef.current = false;
      setRepostBusy(false);
    }
  }

  async function submitQuote() {
    const text = quoteBody.trim();
    if (!text) return;
    setQuoteSubmitting(true);
    try {
      await apiPost(
        `/api/posts/${repostTargetId}/repost`,
        { body: text },
        { idempotencyKey: crypto.randomUUID() },
      );
      setQuoteOpen(false);
      setQuoteBody("");
      toast({ title: "Quote posted" });
      onChanged?.();
      router.refresh();
    } catch (error) {
      toast({ title: "Couldn't quote that post", description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      setQuoteSubmitting(false);
    }
  }

  async function copyLink() {
    const url = `${window.location.origin}/p/${repostTargetId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied" });
    } catch {
      toast({ title: "Copy failed", description: "Copy the link from your address bar.", variant: "error" });
    }
    setMenuOpen(false);
    setShareOpen(false);
  }

  async function shareOutside() {
    const url = `${window.location.origin}/p/${local.id}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Post on Konnekt", url });
      } catch {
        // The share sheet was dismissed.
      }
    } else {
      await copyLink();
    }
  }

  async function setRelationship(action: "mute" | "block") {
    try {
      await apiPost("/api/relationships", { action, username: local.author.username });
      toast({
        title: action === "mute" ? `Muted @${local.author.username}` : `Blocked @${local.author.username}`,
        description: action === "mute" ? "Their posts are hidden from your feed." : "You can't see each other now.",
      });
      onChanged?.();
    } catch (error) {
      toast({ title: "Couldn't do that", description: error instanceof Error ? error.message : undefined, variant: "error" });
    }
  }

  async function saveEdit() {
    setSaving(true);
    try {
      await apiPatch(`/api/posts/${local.id}`, { body: editBody });
      setLocal({ ...local, body: editBody.trim(), editedAt: new Date().toISOString() });
      setEditing(false);
      toast({ title: "Post updated", description: "Your audience stays the same." });
    } catch (error) {
      toast({ title: "Couldn't save", description: error instanceof Error ? error.message : undefined, variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    try {
      await apiDelete(`/api/posts/${local.id}`);
      setDeleteOpen(false);
      toast({ title: "Post deleted" });
      onDeleted?.(local.id);
    } catch (error) {
      toast({ title: "Couldn't delete", description: error instanceof Error ? error.message : undefined, variant: "error" });
    }
  }

  async function openReactions() {
    setReactionsOpen(true);
    if (people) return;
    try {
      const result = await fetch(`/api/posts/${local.id}/reactions`).then(async (response) => {
        if (!response.ok) throw new ApiError("Couldn't load reactions.", response.status);
        return (await response.json()) as { people: typeof people };
      });
      setPeople(result.people ?? []);
    } catch {
      setPeople([]);
    }
  }

  const poll = local.poll;
  const showQuestionInlineCta =
    local.type === "QUESTION" && !expanded && !local.isOwner && !local.acceptedCommentId && !removed;

  return (
    <article
      className={cn(
        "post-card relative rounded-card border border-border bg-surface shadow-card",
        local.type === "QUESTION" && !removed && "border-l-[3px] border-l-accent",
        compact && "rounded-none border-x-0 border-t-0 shadow-none",
      )}
      aria-label={`Post by ${local.author.fullName}`}
    >
      {removed ? (
        <div className="px-4 pt-3.5 pb-2">
          <div className="flex items-start gap-3 rounded-[14px] bg-surface-2 px-4 py-3.5">
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-accent/40 text-accent-ink">
              <Info aria-hidden="true" className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[0.9375rem] font-semibold leading-snug text-fg">
                This post was removed by a moderator for breaking the community rules.
              </p>
              {local.isOwner && local.moderationReason && local.moderationReason !== "This post was removed by a moderator." ? (
                <p className="mt-1 text-small text-fg-muted">Reason: {local.moderationReason}</p>
              ) : null}
              <Link href="/legal/community-rules" className="mt-1 inline-block text-small font-semibold text-accent-ink underline underline-offset-2 hover:opacity-80">
                Learn more
              </Link>
            </div>
          </div>
          {expanded ? (
            <p className="mt-3 flex items-center gap-4 border-t border-border pt-3 text-small text-fg-muted">
              <span className="inline-flex items-center gap-1.5">
                <MessageCircle aria-hidden="true" className="size-4" /> {formatCount(local.commentCount)} comments
              </span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1.5">
                <Repeat2 aria-hidden="true" className="size-4" /> {formatCount(local.repostCount)} reposts
              </span>
            </p>
          ) : null}
        </div>
      ) : null}

      {!removed ? (
        <>
          {local.type === "REPOST" && local.repostOf ? (
            <div className="flex items-center gap-1.5 px-4 pt-3 text-small font-medium text-fg-muted">
              <Repeat2 aria-hidden="true" className="size-4 text-fg-subtle" />
              <span>{local.author.fullName} reposted</span>
            </div>
          ) : null}

          <div className={cn("flex items-start gap-3 px-4", local.type === "REPOST" && local.repostOf ? "pt-2" : "pt-3.5")}>
            <Link href={`/profile/${displayAuthor.username}`} aria-label={`${displayAuthor.fullName}'s profile`}>
              <Avatar name={displayAuthor.fullName} seed={displayAuthor.username} src={displayAuthor.photoUrl} size="md" />
            </Link>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                <Link href={`/profile/${displayAuthor.username}`} className="truncate font-display text-[0.9375rem] font-bold text-fg hover:underline">
                  {displayAuthor.fullName}
                </Link>
                <VerifiedTick />
              </div>
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-small text-fg-subtle">
                <span className="truncate">@{displayAuthor.username}</span>
                <span aria-hidden="true">·</span>
                <span className="whitespace-nowrap">{timeAgo(displayCreatedAt)}</span>
                {editedRecently(local) ? (
                  <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-accent-soft px-2 py-0.5 text-[0.6875rem] font-semibold text-accent-ink">
                    <Pencil aria-hidden="true" className="size-2.5" />
                    Edited
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 flex items-center gap-1.5 text-tiny text-fg-subtle">
                <Users aria-hidden="true" className="size-3.5 shrink-0" />
                <span className="truncate">
                  {local.community ? (
                    <>
                      in{" "}
                      <Link href={`/c/${local.community.slug}`} className="font-semibold text-accent-ink hover:underline">
                        {local.community.name}
                      </Link>
                      {local.community.isOfficial ? <span className="ml-1 text-accent-ink">· official</span> : null}
                    </>
                  ) : (
                    <>
                      to <span className="font-medium text-fg-muted">{local.audienceLabel}</span>
                    </>
                  )}
                </span>
              </p>
            </div>

            <div className="shrink-0">
              <IconButton label="Post options" aria-haspopup="dialog" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)} className="-mr-2 -mt-1 size-11 text-fg-muted">
                <MoreHorizontal aria-hidden="true" className="size-5" />
              </IconButton>
            </div>
          </div>

          <div className="px-4 pb-1 pt-2.5">
            {local.type === "QUESTION" ? (
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-0.5 text-tiny font-semibold text-accent-soft-fg">
                  <span aria-hidden="true" className="flex size-3.5 items-center justify-center rounded-full bg-accent text-[0.55rem] font-bold text-white">?</span>
                  Question
                </span>
                {local.topicTag ? (
                  <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-tiny font-medium text-fg-muted">
                    #{local.topicTag}
                  </span>
                ) : null}
                {local.acceptedCommentId ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-success-solid px-2.5 py-0.5 text-tiny font-semibold text-white">
                    <Check aria-hidden="true" className="size-3" strokeWidth={3} />
                    Answered
                  </span>
                ) : null}
              </div>
            ) : null}

            {local.type === "POLL" ? (
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-0.5 text-tiny font-semibold text-accent-soft-fg">
                  <BarChart3 aria-hidden="true" className="size-3.5 text-accent-ink" />
                  Poll
                </span>
                {poll?.hasVoted ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-0.5 text-tiny font-semibold text-success">
                    <Check aria-hidden="true" className="size-3" strokeWidth={3} />
                    You voted
                  </span>
                ) : null}
              </div>
            ) : null}

            {local.type === "QUESTION" && local.questionTitle ? (
              <div className={cn(showQuestionInlineCta && "flex items-start justify-between gap-3")}>
                <div className="min-w-0 flex-1">
                  <h2 className="font-display text-[1rem] font-bold leading-snug text-fg">
                    {expanded ? local.questionTitle : (
                      <Link href={`/p/${local.id}`} className="hover:underline">{local.questionTitle}</Link>
                    )}
                  </h2>
                  {body && (expanded || local.questionTitle !== body) ? (
                    <>
                      <RichText body={body} className="mt-1 whitespace-pre-line break-words text-[0.9375rem] leading-relaxed text-fg" />
                      {isLong ? (
                        <button type="button" onClick={() => setShowFull((value) => !value)} className="mt-1 text-small font-semibold text-accent-ink hover:underline">
                          {showFull ? "Show less" : "Read more"}
                        </button>
                      ) : null}
                    </>
                  ) : null}
                </div>
                {showQuestionInlineCta ? (
                  <Link
                    href={`/p/${local.id}#comments`}
                    className="mt-0.5 inline-flex h-8 shrink-0 items-center rounded-full border border-accent bg-surface px-3.5 text-small font-semibold text-accent-ink transition hover:bg-accent-soft"
                  >
                    I can help
                  </Link>
                ) : null}
              </div>
            ) : body ? (
              <div className={cn(showQuestionInlineCta && "flex items-start justify-between gap-3")}>
                <div className="min-w-0 flex-1">
                  <RichText body={body} className="whitespace-pre-line break-words text-[0.9375rem] leading-relaxed text-fg" />
                  {isLong ? (
                    <button type="button" onClick={() => setShowFull((value) => !value)} className="mt-1 text-small font-semibold text-accent-ink hover:underline">
                      {showFull ? "Show less" : "Read more"}
                    </button>
                  ) : null}
                </div>
                {showQuestionInlineCta ? (
                  <Link
                    href={`/p/${local.id}#comments`}
                    className="inline-flex h-8 shrink-0 items-center rounded-full border border-accent bg-surface px-3.5 text-small font-semibold text-accent-ink transition hover:bg-accent-soft"
                  >
                    I can help
                  </Link>
                ) : null}
              </div>
            ) : null}

            {editing ? (
              <div className="mt-3 rounded-card border border-border bg-surface-2 p-3">
                <label htmlFor={`edit-${local.id}`} className="text-small font-semibold text-fg">Edit your post</label>
                <textarea
                  id={`edit-${local.id}`}
                  value={editBody}
                  onChange={(event) => setEditBody(event.target.value.slice(0, 2000))}
                  rows={4}
                  className="mt-2 w-full resize-y rounded-input border border-border bg-surface px-3 py-2 text-body text-fg focus:border-accent"
                />
                <p className="mt-1 text-right text-tiny text-fg-subtle">{editBody.length}/2000 · audience can&apos;t change</p>
                <div className="mt-2 flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => { setEditing(false); setEditBody(local.body); }}>Cancel</Button>
                  <Button size="sm" loading={saving} onClick={() => void saveEdit()}>Save</Button>
                </div>
              </div>
            ) : null}

            {local.type === "REPOST" && local.repostOf && local.body.trim() ? (
              <Link href={`/p/${local.repostOf.id}`} className="mt-3 block rounded-[14px] border border-border bg-surface-2 p-3.5 transition hover:border-border-strong">
                {local.repostOf.unavailable ? null : (
                  <div className="flex items-center gap-2">
                    <Avatar name={local.repostOf.author.fullName} seed={local.repostOf.author.username} src={local.repostOf.author.photoUrl} size="xs" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="truncate text-small font-semibold text-fg">{local.repostOf.author.fullName}</span>
                        <VerifiedTick className="size-3.5" />
                      </div>
                      <p className="truncate text-tiny text-fg-subtle">
                        @{local.repostOf.author.username} · {timeAgo(local.repostOf.createdAt)}
                      </p>
                    </div>
                  </div>
                )}
                <p className="mt-2 line-clamp-4 whitespace-pre-line text-small text-fg">
                  {local.repostOf.unavailable
                    ? "This post isn't available."
                    : local.repostOf.status !== "ACTIVE"
                      ? "This post was removed by a moderator."
                      : local.repostOf.body}
                </p>
              </Link>
            ) : null}

            {local.media.length > 0 ? (
              <MediaGrid media={local.media} onOpen={(index) => { setViewerIndex(index); setViewerZoomed(false); setViewerOpen(true); }} />
            ) : null}

            {poll ? (
              <div className="mt-2.5">
                <PollBox post={local} onVoted={(next) => setLocal(next)} />
                <p className="mt-2 text-tiny text-fg-subtle">
                  {poll.totalVotes} {poll.totalVotes === 1 ? "vote" : "votes"} · {pollTimeRemaining(poll.endsAt, poll.isOpen)}
                </p>
              </div>
            ) : null}
          </div>

          {expanded ? (
            <div className="mx-4 mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-y border-border py-2.5 text-tiny text-fg-muted sm:text-small">
              <p className="flex flex-wrap items-center gap-x-1.5">
                <span><span className="font-semibold text-fg">{formatCount(local.reactionCount)}</span> reactions</span>
                <span aria-hidden="true">·</span>
                <span><span className="font-semibold text-fg">{formatCount(local.commentCount)}</span> comments</span>
                <span aria-hidden="true">·</span>
                <span><span className="font-semibold text-fg">{formatCount(local.repostCount)}</span> reposts</span>
              </p>
              <button type="button" onClick={() => void openReactions()} className="inline-flex shrink-0 items-center gap-0.5 font-semibold text-accent-ink hover:underline">
                Who reacted <ChevronRight aria-hidden="true" className="size-4" />
              </button>
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-0.5 px-2.5 pb-1 pt-0.5">
            <ActionButton
              label={`${local.commentCount} comments`}
              href={`/p/${local.id}#comments`}
              icon={<MessageCircle aria-hidden="true" className="size-[19px]" />}
              count={local.commentCount}
            />
            <button
              type="button"
              onClick={() => void toggleRepost()}
              disabled={isOwnOriginal || repostBusy}
              aria-pressed={reposted}
              className={cn(
                "inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-[10px] text-small font-medium transition hover:bg-surface-2 disabled:opacity-40",
                reposted ? "text-success" : "text-fg-muted hover:text-fg",
              )}
              aria-label={reposted ? `Undo repost (${local.repostCount})` : `Repost (${local.repostCount})`}
            >
              <Repeat2 aria-hidden="true" className="size-[18px]" />
              {local.repostCount > 0 ? <span className="tabular-nums">{formatCompactCount(local.repostCount)}</span> : null}
            </button>
            <button
              type="button"
              onClick={() => void react()}
              aria-pressed={local.viewer.reacted}
              aria-label={local.viewer.reacted ? "Remove heart" : "React with a heart"}
              className={cn(
                "inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-[10px] text-small font-medium transition hover:bg-surface-2",
                local.viewer.reacted ? "text-danger" : "text-fg-muted hover:text-fg",
              )}
            >
              <Heart
                aria-hidden="true"
                className={cn("size-[18px]", local.viewer.reacted && "animate-heart-pop")}
                fill={local.viewer.reacted ? "currentColor" : "none"}
              />
              {local.reactionCount > 0 ? (
                <span className="tabular-nums" onClick={(event) => { event.stopPropagation(); void openReactions(); }}>
                  {formatCompactCount(local.reactionCount)}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={() => void bookmark()}
              aria-pressed={local.viewer.bookmarked}
              aria-label={local.viewer.bookmarked ? "Remove bookmark" : "Bookmark"}
              className={cn(
                "inline-flex min-h-11 flex-1 items-center justify-center rounded-[10px] transition hover:bg-surface-2",
                local.viewer.bookmarked ? "text-accent-ink" : "text-fg-muted hover:text-fg",
              )}
            >
              <Bookmark aria-hidden="true" className="size-[18px]" fill={local.viewer.bookmarked ? "currentColor" : "none"} />
            </button>
          </div>
        </>
      ) : null}

      {/* Post options menu */}
      <BottomSheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Post options" hideHeader>
        <div role="menu" aria-label="Post options" className="divide-y divide-border/80 pb-2 pt-1">
          {local.isOwner ? (
            <>
              <MenuItem icon={<Pencil aria-hidden="true" className="size-5" />} onClick={() => { setEditing(true); setMenuOpen(false); }}>
                Edit
              </MenuItem>
              <div className="py-1">
                <MenuItem destructive highlighted icon={<Trash2 aria-hidden="true" className="size-5" />} onClick={() => { setDeleteOpen(true); setMenuOpen(false); }}>
                  Delete
                </MenuItem>
              </div>
              <MenuItem icon={<Link2 aria-hidden="true" className="size-5" />} onClick={() => void copyLink()}>Copy link</MenuItem>
              <MenuItem icon={<Bookmark aria-hidden="true" className="size-5" />} onClick={() => { void bookmark(); setMenuOpen(false); }}>
                {local.viewer.bookmarked ? "Remove bookmark" : "Bookmark"}
              </MenuItem>
              <MenuItem icon={<Share2 aria-hidden="true" className="size-5" />} onClick={() => { setMenuOpen(false); setShareOpen(true); }}>Share post</MenuItem>
            </>
          ) : (
            <>
              <MenuItem icon={<Link2 aria-hidden="true" className="size-5" />} onClick={() => void copyLink()}>Copy link</MenuItem>
              <MenuItem icon={<Bookmark aria-hidden="true" className="size-5" />} onClick={() => { void bookmark(); setMenuOpen(false); }}>
                {local.viewer.bookmarked ? "Remove bookmark" : "Bookmark"}
              </MenuItem>
              <MenuItem icon={<BellOff aria-hidden="true" className="size-5" />} onClick={() => { void setRelationship("mute"); setMenuOpen(false); }}>
                Mute @{local.author.username}
              </MenuItem>
              <MenuItem icon={<Share2 aria-hidden="true" className="size-5" />} onClick={() => { setMenuOpen(false); setShareOpen(true); }}>Share</MenuItem>
              <MenuItem icon={<Flag aria-hidden="true" className="size-5" />} onClick={() => { setMenuOpen(false); setReportOpen(true); }}>
                Report
              </MenuItem>
              <div className="pt-1.5">
                <MenuItem destructive highlighted icon={<ShieldBan aria-hidden="true" className="size-5" />} onClick={() => { void setRelationship("block"); setMenuOpen(false); }}>
                  Block @{local.author.username}
                </MenuItem>
              </div>
            </>
          )}
        </div>
      </BottomSheet>

      {/* Delete confirmation */}
      <Dialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete this post?"
        description="This can't be undone."
        destructive
        centered
        hideClose
        footer={
          <>
            <Button variant="destructive" fullWidth className="rounded-full" onClick={() => void remove()}>
              Delete
            </Button>
            <Button variant="secondary" fullWidth className="rounded-full" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
          </>
        }
      />

      <ReportSheet
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="POST"
        targetId={local.id}
        username={local.author.username}
        onMute={async () => {
          await setRelationship("mute");
          setReportOpen(false);
        }}
        onBlock={async () => {
          await setRelationship("block");
          setReportOpen(false);
        }}
      />

      {/* Share sheet */}
      <BottomSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        title="Share"
        centeredTitle
        hideClose
        leftAction={
          <IconButton label="Back" onClick={() => setShareOpen(false)}>
            <ArrowLeft aria-hidden="true" className="size-5" />
          </IconButton>
        }
      >
        <div className="divide-y divide-border/80 pb-3">
          <MenuItem icon={<Copy aria-hidden="true" className="size-5" />} onClick={() => void copyLink()}>Copy link</MenuItem>
          <MenuItem icon={<Share2 aria-hidden="true" className="size-5" />} onClick={() => void shareOutside()}>Share outside the app</MenuItem>
          {isOwnOriginal ? null : (
            <MenuItem icon={<Repeat2 aria-hidden="true" className="size-5" />} onClick={() => { setShareOpen(false); void toggleRepost(); }}>
              {reposted ? "Undo repost" : "Repost to my profile"}
            </MenuItem>
          )}
          {isOwnOriginal ? null : (
            <MenuItem icon={<MessageCircle aria-hidden="true" className="size-5" />} onClick={() => { setShareOpen(false); setQuoteOpen(true); }}>
              Quote post
            </MenuItem>
          )}
        </div>
      </BottomSheet>

      <BottomSheet
        open={quoteOpen}
        onClose={() => setQuoteOpen(false)}
        title="Quote post"
        description="Your comment and the original appear together. The audience stays the original's."
        footer={
          <Button
            fullWidth
            size="lg"
            className="rounded-full"
            loading={quoteSubmitting}
            loadingLabel="Posting…"
            disabled={!quoteBody.trim()}
            onClick={() => void submitQuote()}
          >
            Post quote
          </Button>
        }
      >
        <label htmlFor={`quote-body-${local.id}`} className="sr-only">Quote comment</label>
        <textarea
          id={`quote-body-${local.id}`}
          aria-label="Quote comment"
          rows={4}
          value={quoteBody}
          onChange={(event) => setQuoteBody(event.target.value.slice(0, 2000))}
          placeholder="Add your comment…"
          className="w-full resize-none rounded-[12px] border border-border bg-surface p-3.5 text-[0.9375rem] leading-relaxed text-fg placeholder:text-fg-subtle focus:border-accent"
        />
      </BottomSheet>

      <BottomSheet
        open={reactionsOpen}
        onClose={() => setReactionsOpen(false)}
        title="Who reacted"
        description="Only people who can see this post appear here."
      >
        <div className="pb-4">
          {people === null ? (
            <p className="flex items-center gap-2 py-6 text-small text-fg-muted"><Loader2 aria-hidden="true" className="size-4 animate-spin" /> Loading…</p>
          ) : people.length === 0 ? (
            <p className="py-6 text-center text-small text-fg-muted">No reactions yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {people.map((person) => (
                <li key={person.username}>
                  <Link href={`/profile/${person.username}`} className="flex items-center gap-3 py-2.5">
                    <Avatar name={person.fullName} seed={person.username} src={person.photoUrl} size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate text-small font-semibold text-fg">{person.fullName}</span>
                      <span className="block truncate text-tiny text-fg-subtle">@{person.username}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </BottomSheet>

      {/* Full-screen image viewer */}
      {viewerOpen && local.media.length > 0 ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Image viewer"
          tabIndex={-1}
          className="fixed inset-0 z-[100] flex flex-col bg-black text-white"
          onTouchStart={(event) => {
            const t = event.touches[0];
            if (t) touchStart.current = { x: t.clientX, y: t.clientY };
          }}
          onTouchEnd={(event) => {
            if (!touchStart.current) return;
            const t = event.changedTouches[0];
            if (!t) return;
            const dx = t.clientX - touchStart.current.x;
            const dy = t.clientY - touchStart.current.y;
            touchStart.current = null;
            if (dy > 90 && Math.abs(dx) < 60) {
              setViewerOpen(false);
            } else if (dx < -50 && viewerIndex < local.media.length - 1) {
              setViewerZoomed(false);
              setViewerIndex((index) => index + 1);
            } else if (dx > 50 && viewerIndex > 0) {
              setViewerZoomed(false);
              setViewerIndex((index) => index - 1);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setViewerOpen(false);
            if (event.key === "ArrowLeft") { setViewerZoomed(false); setViewerIndex((index) => Math.max(0, index - 1)); }
            if (event.key === "ArrowRight") { setViewerZoomed(false); setViewerIndex((index) => Math.min(local.media.length - 1, index + 1)); }
          }}
        >
          <div className="relative mx-auto flex h-16 w-full max-w-2xl items-center px-4 pt-3">
            <div className="flex h-11 w-full items-center gap-2 rounded-full border border-white/25 bg-white/10 px-2 backdrop-blur-md">
              <button type="button" onClick={() => setViewerOpen(false)} aria-label="Close image viewer" className="flex size-10 items-center justify-center rounded-full text-white hover:bg-white/15">
                <X aria-hidden="true" className="size-5" />
              </button>
              <p className="flex-1 text-center text-small font-semibold tabular-nums text-white">
                {viewerIndex + 1} / {local.media.length}
              </p>
              <button
                type="button"
                onClick={() => setViewerMenu((value) => !value)}
                aria-label="Image options"
                aria-expanded={viewerMenu}
                className="flex size-10 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
              >
                <MoreHorizontal aria-hidden="true" className="size-5" />
              </button>
            </div>
            {viewerMenu ? (
              <div className="absolute right-6 top-[68px] z-10 w-48 overflow-visible rounded-[14px] bg-surface p-1 text-fg shadow-floating">
                <span aria-hidden="true" className="absolute -top-1.5 right-4 size-3 rotate-45 bg-surface" />
                <div className="relative divide-y divide-border/70">
                  <a
                    href={local.media[viewerIndex]?.url}
                    download
                    className="flex items-center gap-2.5 rounded-t-[10px] px-3 py-2.5 text-small font-medium hover:bg-surface-2"
                    onClick={() => setViewerMenu(false)}
                  >
                    <Download aria-hidden="true" className="size-4" /> Save image
                  </a>
                  <button
                    type="button"
                    onClick={() => { setViewerMenu(false); setViewerOpen(false); setReportOpen(true); }}
                    className="flex w-full items-center gap-2.5 rounded-b-[10px] px-3 py-2.5 text-left text-small font-medium hover:bg-surface-2"
                  >
                    <Flag aria-hidden="true" className="size-4" /> Report
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-3 py-4">
            {viewerIndex > 0 ? (
              <button
                type="button"
                onClick={() => { setViewerZoomed(false); setViewerIndex((index) => index - 1); }}
                aria-label="Previous image"
                className="absolute left-4 z-10 flex size-11 items-center justify-center rounded-full bg-black/50 text-white/95 backdrop-blur-sm hover:bg-black/75"
              >
                <ChevronRight aria-hidden="true" className="size-5 rotate-180" />
              </button>
            ) : null}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={local.media[viewerIndex]?.url}
              alt={local.media[viewerIndex]?.alt ?? "Post image"}
              width={local.media[viewerIndex]?.width}
              height={local.media[viewerIndex]?.height}
              onDoubleClick={() => setViewerZoomed((value) => !value)}
              onClick={() => { if (viewerZoomed) setViewerZoomed(false); }}
              className={cn(
                "max-h-full max-w-full cursor-zoom-in object-contain transition-transform duration-200",
                viewerZoomed && "scale-150 cursor-zoom-out",
              )}
            />
            {viewerIndex < local.media.length - 1 ? (
              <button
                type="button"
                onClick={() => { setViewerZoomed(false); setViewerIndex((index) => index + 1); }}
                aria-label="Next image"
                className="absolute right-4 z-10 flex size-11 items-center justify-center rounded-full bg-black/50 text-white/95 backdrop-blur-sm hover:bg-black/75"
              >
                <ChevronRight aria-hidden="true" className="size-5" />
              </button>
            ) : null}
          </div>

          {local.media.length > 1 ? (
            <div className="flex items-center justify-center gap-2 pb-10 pt-2">
              {local.media.map((media, index) => (
                <button
                  key={media.id}
                  type="button"
                  aria-label={`Show image ${index + 1}`}
                  aria-current={index === viewerIndex}
                  onClick={() => { setViewerZoomed(false); setViewerIndex(index); }}
                  className={cn("size-2.5 rounded-full transition", index === viewerIndex ? "bg-white" : "bg-white/40")}
                />
              ))}
            </div>
          ) : <div className="h-10" />}
        </div>
      ) : null}
    </article>
  );
}

function ActionButton({ label, href, icon, count }: { label: string; href: string; icon: React.ReactNode; count: number }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-[10px] text-small font-medium text-fg-muted transition hover:bg-surface-2 hover:text-fg"
    >
      {icon}
      {count > 0 ? <span className="tabular-nums">{formatCompactCount(count)}</span> : null}
    </Link>
  );
}

function MenuItem({
  icon,
  children,
  onClick,
  destructive = false,
  highlighted = false,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
  destructive?: boolean;
  highlighted?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 px-3 py-3 text-left text-[0.9375rem] font-medium transition",
        highlighted ? "rounded-[12px]" : "rounded-button",
        destructive
          ? highlighted
            ? "bg-danger-soft text-danger hover:brightness-95"
            : "text-danger hover:bg-danger-soft"
          : "text-fg hover:bg-surface-2",
      )}
    >
      {icon}
      <span className="truncate">{children}</span>
    </button>
  );
}

function MediaGrid({ media, onOpen }: { media: PostMediaView[]; onOpen: (index: number) => void }) {
  if (media.length === 1) {
    const item = media[0]!;
    return (
      <button type="button" onClick={() => onOpen(0)} className="mt-2.5 block w-full overflow-hidden rounded-[12px] border border-border" aria-label="Open image viewer">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.url}
          alt={item.alt ?? "Image attached to post"}
          width={item.width}
          height={item.height}
          loading="lazy"
          decoding="async"
          className="h-auto max-h-[360px] w-full bg-surface-2 object-cover"
        />
      </button>
    );
  }
  const visible = media.slice(0, 4);
  const extraCount = media.length > 4 ? media.length - 4 : 0;
  return (
    <div className="mt-2.5 grid grid-cols-2 gap-1 overflow-hidden rounded-[12px] border border-border bg-surface-2">
      {visible.map((item, index) => {
        const isThreeFirst = media.length === 3 && index === 0;
        const showMoreOverlay = extraCount > 0 && index === 3;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onOpen(index)}
            className={cn(
              "relative overflow-hidden bg-surface-2",
              isThreeFirst ? "row-span-2 h-full min-h-[220px]" : "aspect-square",
            )}
            aria-label={showMoreOverlay ? `Open image 4 of ${media.length}` : `Open image ${index + 1}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.url}
              alt={item.alt ?? "Image attached to post"}
              width={item.width}
              height={item.height}
              loading="lazy"
              decoding="async"
              className="size-full object-cover"
            />
            {showMoreOverlay ? (
              <span className="absolute inset-0 flex items-center justify-center bg-black/55 font-display text-[1.25rem] font-bold text-white backdrop-blur-[1px]">
                +{extraCount}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function PollBox({ post, onVoted }: { post: PostView; onVoted: (next: PostView) => void }) {
  const [voting, setVoting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const poll = post.poll;
  if (!poll) return null;
  const currentPoll = poll;

  async function vote(optionId: string) {
    setVoting(true);
    setError(null);
    try {
      await apiPost(`/api/polls/${currentPoll.id}/vote`, { optionId });
      const counts = currentPoll.options.map((option) => (option.id === optionId ? option.count + 1 : option.count));
      const total = counts.reduce((sum, count) => sum + count, 0);
      const percentages = counts.map((count) => (total === 0 ? 0 : Math.round((count / total) * 100)));
      onVoted({
        ...post,
        poll: {
          ...currentPoll,
          hasVoted: true,
          votedOptionId: optionId,
          resultsVisible: true,
          totalVotes: total,
          options: currentPoll.options.map((option, index) => ({
            ...option,
            count: counts[index] ?? 0,
            percent: percentages[index] ?? 0,
          })),
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't vote.");
    } finally {
      setVoting(false);
    }
  }

  return (
    <div className="space-y-2" aria-label="Poll">
      {poll.options.map((option) => {
        const chosen = poll.votedOptionId === option.id;
        if (!poll.resultsVisible) {
          return (
            <button
              key={option.id}
              type="button"
              disabled={voting}
              onClick={() => void vote(option.id)}
              className="flex min-h-11 w-full items-center gap-3 rounded-button border border-border bg-surface px-3.5 py-2 text-left text-small font-medium text-fg transition hover:border-accent hover:bg-accent-soft disabled:opacity-60"
            >
              <span aria-hidden="true" className="flex size-4 shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface" />
              <span className="truncate">{option.text}</span>
            </button>
          );
        }
        return (
          <div key={option.id} className="relative overflow-hidden rounded-button bg-surface-2">
            <span
              aria-hidden="true"
              className={cn(
                "absolute inset-y-0 left-0 rounded-r-[8px] transition-[width] duration-[400ms] ease-out",
                chosen ? "bg-accent/25" : "bg-accent/15",
              )}
              style={{ width: `${option.percent}%` }}
            />
            <div className={cn("relative flex min-h-11 items-center justify-between gap-3 px-3.5 py-2 text-small", chosen ? "font-bold text-fg" : "font-medium text-fg")}>
              <span className="flex min-w-0 items-center gap-1.5">
                {chosen ? <Check aria-hidden="true" className="size-4 shrink-0 text-accent-ink" strokeWidth={2.5} /> : null}
                <span className="truncate">{option.text}</span>
                {chosen ? <span className="sr-only"> Your vote</span> : null}
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-fg">{option.percent}%</span>
            </div>
          </div>
        );
      })}
      {error ? <p role="alert" className="text-small text-danger">{error}</p> : null}
      {voting ? <p className="flex items-center gap-1.5 text-tiny text-fg-subtle"><Loader2 aria-hidden="true" className="size-3 animate-spin" /> Recording your vote…</p> : null}
    </div>
  );
}

export function ReportSheet({
  open,
  onClose,
  targetType,
  targetId,
  username,
  onMute,
  onBlock,
}: {
  open: boolean;
  onClose: () => void;
  targetType: "POST" | "COMMENT";
  targetId: string;
  username: string;
  onMute?: () => Promise<void> | void;
  onBlock?: () => Promise<void> | void;
}) {
  const [step, setStep] = useState<"reason" | "details" | "done">("reason");
  const [reason, setReason] = useState<ReportReasonValue | null>(null);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setStep("reason");
      setReason(null);
      setDetails("");
      setError(null);
    }
  }, [open]);

  async function submit() {
    if (!reason) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiPost("/api/reports", { targetType, targetId, reason, details });
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send the report.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={step === "reason" ? "Why are you reporting this?" : "Report"}
      centeredTitle={step === "details"}
      hideClose
      hideHeader={step === "done"}
      leftAction={
        step === "details" ? (
          <IconButton label="Back" onClick={() => setStep("reason")}>
            <ArrowLeft aria-hidden="true" className="size-5" />
          </IconButton>
        ) : undefined
      }
    >
      {step === "reason" ? (
        <div className="pb-2">
          <fieldset>
            <legend className="sr-only">Why are you reporting this?</legend>
            <div className="divide-y divide-border/80">
              {REPORT_REASON_OPTIONS.map((option) => {
                const selected = reason === option.value;
                return (
                  <label
                    key={option.value}
                    className="relative flex min-h-11 cursor-pointer items-center justify-between gap-3 px-1 py-2 text-[0.9375rem] text-fg transition hover:bg-surface-2/60"
                  >
                    <span>{option.label}</span>
                    <input
                      type="radio"
                      name="report-reason"
                      value={option.value}
                      checked={selected}
                      onChange={() => setReason(option.value)}
                      className="absolute inset-0 size-full cursor-pointer appearance-none opacity-0"
                    />
                    <span
                      aria-hidden="true"
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-full border-[1.75px] transition",
                        selected ? "border-accent bg-accent" : "border-border-strong bg-surface",
                      )}
                    >
                      {selected ? <span className="size-1.5 rounded-full bg-white" /> : null}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          <div className="mt-4 pb-1">
            <Button fullWidth size="lg" className="rounded-full" disabled={!reason} onClick={() => setStep("details")}>
              Next
            </Button>
          </div>
        </div>
      ) : step === "details" ? (
        <div className="pb-2">
          <label htmlFor="report-details" className="text-small font-medium text-fg-muted">
            Add details (optional)
          </label>
          <div className="relative mt-2">
            <textarea
              id="report-details"
              value={details}
              onChange={(event) => setDetails(event.target.value.slice(0, 500))}
              rows={5}
              placeholder="What should our moderators know?"
              className="w-full resize-none rounded-[14px] border border-border bg-surface px-3.5 pb-7 pt-3 text-body text-fg placeholder:text-fg-subtle focus:border-accent"
            />
            <span className="pointer-events-none absolute bottom-2.5 right-3 text-tiny tabular-nums text-fg-subtle">
              {details.length} / 500
            </span>
          </div>
          {error ? <p role="alert" className="mt-2 text-small text-danger">{error}</p> : null}
          <div className="mt-4 pb-1">
            <Button fullWidth size="lg" className="rounded-full" loading={submitting} loadingLabel="Sending…" onClick={() => void submit()}>
              Submit
            </Button>
          </div>
        </div>
      ) : (
        <div className="pb-3 pt-2 text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-success-solid text-white">
            <Check aria-hidden="true" className="size-7" strokeWidth={3} />
          </span>
          <h3 className="mt-3 font-display text-[1.125rem] font-bold leading-snug text-fg">
            Thanks. Our moderators will review this.
          </h3>
          <div className="mt-4 space-y-1.5 text-left">
            {onMute ? (
              <button
                type="button"
                onClick={() => void onMute()}
                className="flex min-h-11 w-full items-center gap-3 rounded-[12px] px-3 text-[0.9375rem] font-medium text-fg hover:bg-surface-2"
              >
                <BellOff aria-hidden="true" className="size-5 text-fg-muted" />
                {username ? `Mute @${username}` : "Mute this person"}
              </button>
            ) : null}
            {onBlock ? (
              <button
                type="button"
                onClick={() => void onBlock()}
                className="flex min-h-11 w-full items-center gap-3 rounded-[12px] bg-danger-soft px-3 text-[0.9375rem] font-medium text-danger hover:brightness-95"
              >
                <ShieldBan aria-hidden="true" className="size-5" />
                Block
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                toast({ title: "Report received" });
                onClose();
              }}
              className="mt-1 min-h-11 w-full text-center text-small font-semibold text-accent-ink hover:underline"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </BottomSheet>
  );
}
