"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  BarChart3,
  BellOff,
  Bookmark,
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  Download,
  Flag,
  Heart,
  Image as ImageIcon,
  Info,
  Link2,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Repeat2,
  Send,
  Share2,
  ShieldBan,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from "lucide-react";
import type { CommentView, PostMediaView, PostView } from "@/lib/posts/types";
import { ApiError, apiDelete, apiPatch, apiPost } from "@/lib/posts/client";
import { REPORT_REASON_OPTIONS, type ReportReasonValue } from "@/lib/posts/report-reasons";
import { Avatar } from "@/components/ui/display";
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
  const { toast } = useToast();

  useEffect(() => setLocal(post), [post]);

  const removed = local.status !== "ACTIVE";
  const isLong = local.body.length > 320;
  const body = isLong && !showFull ? `${local.body.slice(0, 280).trimEnd()}…` : local.body;

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

  async function repost() {
    try {
      await apiPost("/api/posts", {
        type: "REPOST",
        body: "",
        audienceId: "",
        repostOfId: local.id,
        idempotencyKey: crypto.randomUUID(),
      });
      setLocal((current) => ({ ...current, repostCount: current.repostCount + 1 }));
      toast({ title: "Reposted", description: "It keeps the original audience." });
      onChanged?.();
    } catch (error) {
      toast({ title: "Couldn't repost", description: error instanceof Error ? error.message : undefined, variant: "error" });
    }
  }

  async function copyLink() {
    const url = `${window.location.origin}/p/${local.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied" });
    } catch {
      window.prompt("Copy this link", url);
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
  const audienceIcon = <Users aria-hidden="true" className="size-3.5 shrink-0" />;

  return (
    <article
      className={cn(
        "post-card relative rounded-card border bg-surface shadow-card",
        removed ? "border-warning/30" : "border-border",
        compact && "rounded-none border-x-0 border-t-0 shadow-none",
      )}
      aria-label={`Post by ${local.author.fullName}`}
    >
      {removed ? (
        <div className="flex items-start gap-2.5 border-b border-border px-4 py-3.5">
          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-warning-soft text-warning">
            <Info aria-hidden="true" className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-small font-semibold text-fg">This post was removed by a moderator for breaking the community rules.</p>
            {local.isOwner && local.moderationReason && local.moderationReason !== "This post was removed by a moderator." ? (
              <p className="mt-1 text-small text-fg-muted">Reason: {local.moderationReason}</p>
            ) : null}
            <Link href="/legal/community-guidelines" className="mt-0.5 inline-block text-small font-semibold text-accent hover:underline">
              Learn more
            </Link>
          </div>
        </div>
      ) : null}

      <div className="flex items-start gap-3 px-4 pt-3.5">
        <Link href={`/profile/${local.author.username}`} aria-label={`${local.author.fullName}'s profile`}>
          <Avatar name={local.author.fullName} src={local.author.photoUrl} size="md" verified />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <Link href={`/profile/${local.author.username}`} className="truncate text-[0.9375rem] font-semibold text-fg hover:underline">
              {local.author.fullName}
            </Link>
            <BadgeCheck aria-label="Verified student" className="size-4 shrink-0 text-accent" />
            {editedRecently(local) ? (
              <span className="text-tiny text-fg-subtle">· Edited</span>
            ) : null}
          </div>
          <p className="truncate text-small text-fg-subtle">
            @{local.author.username} · {timeAgo(local.createdAt)}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-tiny text-fg-subtle">
            {audienceIcon}
            <span className="truncate">
              to <span className="font-medium text-fg-muted">{local.audienceLabel}</span>
            </span>
          </p>
        </div>

        <div className="shrink-0">
          <IconButton label="Post options" aria-haspopup="dialog" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}>
            <MoreHorizontal aria-hidden="true" className="size-5" />
          </IconButton>
        </div>
      </div>

      <div className="px-4 pb-1 pt-2.5">
        {local.type === "QUESTION" && local.questionTitle ? (
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-chip bg-accent-soft px-2 py-0.5 text-tiny font-semibold text-accent-soft-fg">
              <span aria-hidden="true" className="flex size-3.5 items-center justify-center rounded-full bg-accent text-[0.5rem] font-bold text-accent-fg">?</span>
              Question
            </span>
            {local.topicTag ? <span className="rounded-chip bg-surface-2 px-2 py-0.5 text-tiny text-fg-muted"># {local.topicTag}</span> : null}
            {local.acceptedCommentId ? (
              <span className="inline-flex items-center gap-1 rounded-chip bg-success-soft px-2 py-0.5 text-tiny font-semibold text-success">
                <Check aria-hidden="true" className="size-3" strokeWidth={3} />
                Accepted answer
              </span>
            ) : null}
          </div>
        ) : null}
        {local.type === "POLL" ? (
          <span className="mb-1.5 inline-flex items-center gap-1 rounded-chip bg-accent-soft px-2 py-0.5 text-tiny font-semibold text-accent-soft-fg">
            <BarChart3 aria-hidden="true" className="size-3.5" />
            Poll
          </span>
        ) : null}

        {local.type === "QUESTION" && local.questionTitle ? (
          <h2 className="text-[1.0625rem] font-semibold leading-snug text-fg">
            {expanded ? local.questionTitle : (
              <Link href={`/p/${local.id}`} className="hover:underline">{local.questionTitle}</Link>
            )}
          </h2>
        ) : null}

        {!removed && body ? (
          <RichText body={body} className="mt-1 whitespace-pre-line break-words text-body text-fg" />
        ) : null}
        {isLong ? (
          <button type="button" onClick={() => setShowFull((value) => !value)} className="mt-1 text-small font-semibold text-accent">
            {showFull ? "Show less" : "Read more"}
          </button>
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

        {!removed && local.repostOf ? (
          <Link href={`/p/${local.repostOf.id}`} className="mt-3 block rounded-card border border-border bg-surface-2 p-3 transition hover:border-border-strong">
            <div className="flex items-center gap-2">
              <Avatar name={local.repostOf.author.fullName} src={local.repostOf.author.photoUrl} size="xs" />
              <span className="text-small font-semibold text-fg">{local.repostOf.author.fullName}</span>
              <span className="text-tiny text-fg-subtle">@{local.repostOf.author.username} · {timeAgo(local.repostOf.createdAt)}</span>
            </div>
            <p className="mt-1 line-clamp-4 whitespace-pre-line text-small text-fg-muted">
              {local.repostOf.status !== "ACTIVE" ? "This post was removed by a moderator." : local.repostOf.body}
            </p>
          </Link>
        ) : null}

        {!removed && local.media.length > 0 ? (
          <MediaGrid media={local.media} onOpen={(index) => { setViewerIndex(index); setViewerOpen(true); }} />
        ) : null}

        {!removed && poll ? (
          <div className="mt-3">
            <PollBox post={local} onVoted={(next) => setLocal(next)} />
            <p className="mt-1.5 text-tiny text-fg-subtle">
              {poll.totalVotes} {poll.totalVotes === 1 ? "vote" : "votes"} ·{" "}
              {poll.isOpen ? `${Math.max(1, Math.ceil((new Date(poll.endsAt).getTime() - Date.now()) / 86_400_000))} days left` : "Poll ended"}
            </p>
          </div>
        ) : null}

        {local.type === "QUESTION" && !local.isOwner && !local.acceptedCommentId && !removed ? (
          <Link href={`/p/${local.id}#comments`} className="mt-3 inline-flex h-9 items-center rounded-chip border border-accent/40 px-3 text-small font-semibold text-accent hover:bg-accent-soft">
            I can help
          </Link>
        ) : null}
      </div>

      {expanded && !removed ? (
        <div className="flex items-center justify-between gap-3 px-4 pb-0.5 pt-2 text-tiny text-fg-muted">
          <p className="min-w-0 truncate">
            <span className="font-medium text-fg">{formatCount(local.reactionCount)}</span> reactions
            <span aria-hidden="true"> · </span>
            <span className="font-medium text-fg">{formatCount(local.commentCount)}</span> comments
            <span aria-hidden="true"> · </span>
            <span className="font-medium text-fg">{formatCount(local.repostCount)}</span> reposts
          </p>
          <button type="button" onClick={() => void openReactions()} className="inline-flex shrink-0 items-center gap-0.5 font-semibold text-accent hover:underline">
            Who reacted <ChevronRight aria-hidden="true" className="size-3.5" />
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
          onClick={() => void repost()}
          className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-[10px] text-small font-medium text-fg-muted transition hover:bg-surface-2 hover:text-fg"
          aria-label={`Repost (${local.repostCount})`}
        >
          <Repeat2 aria-hidden="true" className="size-[18px]" />
          {local.repostCount > 0 ? <span className="tabular-nums">{formatCount(local.repostCount)}</span> : null}
        </button>
        <button
          type="button"
          onClick={() => void react()}
          aria-pressed={local.viewer.reacted}
          aria-label={local.viewer.reacted ? "Remove heart" : "React with a heart"}
          className={cn(
            "inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-[10px] text-small font-medium transition hover:bg-surface-2",
            local.viewer.reacted ? "text-danger" : "text-fg-muted hover:text-fg",
          )}
        >
          <Heart aria-hidden="true" className="size-[18px]" fill={local.viewer.reacted ? "currentColor" : "none"} />
          {local.reactionCount > 0 ? (
            <span className="tabular-nums" onClick={(event) => { event.stopPropagation(); void openReactions(); }}>
              {formatCount(local.reactionCount)}
            </span>
          ) : null}
        </button>
        <button
          type="button"
          onClick={() => void bookmark()}
          aria-pressed={local.viewer.bookmarked}
          aria-label={local.viewer.bookmarked ? "Remove bookmark" : "Bookmark"}
          className={cn(
            "inline-flex min-h-9 flex-1 items-center justify-center rounded-[10px] transition hover:bg-surface-2",
            local.viewer.bookmarked ? "text-accent" : "text-fg-muted hover:text-fg",
          )}
        >
          <Bookmark aria-hidden="true" className="size-[18px]" fill={local.viewer.bookmarked ? "currentColor" : "none"} />
        </button>
      </div>

      <BottomSheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Post options">
        <div role="menu" aria-label="Post options" className="space-y-0.5 pb-2">
          {local.isOwner ? (
            <>
              <MenuItem icon={<Pencil aria-hidden="true" className="size-5" />} onClick={() => { setEditing(true); setMenuOpen(false); }}>
                Edit post
              </MenuItem>
              <MenuItem destructive icon={<Trash2 aria-hidden="true" className="size-5" />} onClick={() => { setDeleteOpen(true); setMenuOpen(false); }}>
                Delete
              </MenuItem>
              <MenuItem icon={<Link2 aria-hidden="true" className="size-5" />} onClick={() => void copyLink()}>Copy link</MenuItem>
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
              <MenuItem icon={<Share2 aria-hidden="true" className="size-5" />} onClick={() => { setMenuOpen(false); setShareOpen(true); }}>Share post</MenuItem>
              <MenuItem icon={<Flag aria-hidden="true" className="size-5" />} onClick={() => { setMenuOpen(false); setReportOpen(true); }}>
                Report
              </MenuItem>
              <MenuItem destructive icon={<ShieldBan aria-hidden="true" className="size-5" />} onClick={() => { void setRelationship("block"); setMenuOpen(false); }}>
                Block @{local.author.username}
              </MenuItem>
            </>
          )}
        </div>
      </BottomSheet>

      <Dialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete this post?"
        description="This can't be undone. Its comments will disappear with it."
        destructive
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" leftIcon={<Trash2 aria-hidden="true" className="size-4" />} onClick={() => void remove()}>
              Delete
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

      <BottomSheet open={shareOpen} onClose={() => setShareOpen(false)} title="Share">
        <div className="space-y-0.5 pb-3">
          <MenuItem icon={<Copy aria-hidden="true" className="size-5" />} onClick={() => void copyLink()}>Copy link</MenuItem>
          <MenuItem icon={<Send aria-hidden="true" className="size-5" />} onClick={() => { setShareOpen(false); void copyLink(); }}>Share to chat</MenuItem>
          <MenuItem icon={<Share2 aria-hidden="true" className="size-5" />} onClick={() => void shareOutside()}>Share outside the app</MenuItem>
          <MenuItem icon={<Repeat2 aria-hidden="true" className="size-5" />} onClick={() => { setShareOpen(false); void repost(); }}>Repost to my profile</MenuItem>
        </div>
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
                    <Avatar name={person.fullName} src={person.photoUrl} size="sm" />
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

      {viewerOpen && local.media.length > 0 ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Image viewer"
          tabIndex={-1}
          className="fixed inset-0 z-[100] flex flex-col bg-black text-white"
          onKeyDown={(event) => {
            if (event.key === "Escape") setViewerOpen(false);
            if (event.key === "ArrowLeft") setViewerIndex((index) => Math.max(0, index - 1));
            if (event.key === "ArrowRight") setViewerIndex((index) => Math.min(local.media.length - 1, index + 1));
          }}
        >
          <div className="relative mx-auto flex h-14 w-full max-w-2xl items-center px-4 pt-2">
            <div className="flex h-11 w-full items-center gap-2 rounded-[14px] bg-white/12 px-1.5">
              <button type="button" onClick={() => setViewerOpen(false)} aria-label="Close image viewer" className="flex size-9 items-center justify-center rounded-full text-white hover:bg-white/10">
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
                className="flex size-9 items-center justify-center rounded-full text-white hover:bg-white/10"
              >
                <MoreHorizontal aria-hidden="true" className="size-5" />
              </button>
            </div>
            {viewerMenu ? (
              <div className="absolute right-4 top-14 z-10 w-48 overflow-hidden rounded-[14px] bg-surface p-1 text-fg shadow-floating">
                <a
                  href={local.media[viewerIndex]?.url}
                  download
                  className="flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-small hover:bg-surface-2"
                  onClick={() => setViewerMenu(false)}
                >
                  <Download aria-hidden="true" className="size-4" /> Save image
                </a>
                <button
                  type="button"
                  onClick={() => { setViewerMenu(false); setViewerOpen(false); setReportOpen(true); }}
                  className="flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-left text-small hover:bg-surface-2"
                >
                  <Flag aria-hidden="true" className="size-4" /> Report
                </button>
              </div>
            ) : null}
          </div>

          <div className="relative flex min-h-0 flex-1 items-center justify-center px-3 py-4">
            {viewerIndex > 0 ? (
              <button
                type="button"
                onClick={() => setViewerIndex((index) => index - 1)}
                aria-label="Previous image"
                className="absolute left-4 z-10 flex size-10 items-center justify-center rounded-full bg-black/50 text-white/90 hover:bg-black/70"
              >
                <ChevronRight aria-hidden="true" className="size-6 rotate-180" />
              </button>
            ) : null}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={local.media[viewerIndex]?.url}
              alt={local.media[viewerIndex]?.alt ?? "Post image"}
              width={local.media[viewerIndex]?.width}
              height={local.media[viewerIndex]?.height}
              className="max-h-full max-w-full object-contain"
            />
            {viewerIndex < local.media.length - 1 ? (
              <button
                type="button"
                onClick={() => setViewerIndex((index) => index + 1)}
                aria-label="Next image"
                className="absolute right-4 z-10 flex size-10 items-center justify-center rounded-full bg-black/50 text-white/90 hover:bg-black/70"
              >
                <ChevronRight aria-hidden="true" className="size-6" />
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
                  onClick={() => setViewerIndex(index)}
                  className={cn("size-2 rounded-full transition", index === viewerIndex ? "bg-white" : "bg-white/40")}
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
      className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-[10px] text-small font-medium text-fg-muted transition hover:bg-surface-2 hover:text-fg"
    >
      {icon}
      {count > 0 ? <span className="tabular-nums">{formatCount(count)}</span> : null}
    </Link>
  );
}

function MenuItem({
  icon,
  children,
  onClick,
  destructive = false,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-button px-3 py-2.5 text-left text-[0.9375rem] transition hover:bg-surface-2",
        destructive ? "text-danger hover:bg-danger-soft" : "text-fg",
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
      <button type="button" onClick={() => onOpen(0)} className="mt-3 block w-full overflow-hidden rounded-[12px] border border-border" aria-label="Open image viewer">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.url}
          alt={item.alt ?? "Image attached to post"}
          width={item.width}
          height={item.height}
          loading="lazy"
          decoding="async"
          className="h-auto max-h-[420px] w-full bg-surface-2 object-cover"
        />
      </button>
    );
  }
  return (
    <div className={cn("mt-3 grid gap-1 overflow-hidden rounded-[12px]", media.length === 2 ? "grid-cols-2" : "grid-cols-2")}>
      {media.map((item, index) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onOpen(index)}
          className="relative aspect-square overflow-hidden bg-surface-2"
          aria-label={`Open image ${index + 1}`}
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
        </button>
      ))}
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
    <div className="space-y-1.5" aria-label="Poll">
      {poll.options.map((option) => {
        const chosen = poll.votedOptionId === option.id;
        if (!poll.resultsVisible) {
          return (
            <button
              key={option.id}
              type="button"
              disabled={voting}
              onClick={() => void vote(option.id)}
              className="flex min-h-11 w-full items-center justify-between gap-3 rounded-[10px] border border-border bg-surface px-3 py-2 text-left text-small text-fg transition hover:border-accent hover:bg-accent-soft disabled:opacity-60"
            >
              <span>{option.text}</span>
              {chosen ? <Check aria-hidden="true" className="size-4 text-accent" /> : null}
            </button>
          );
        }
        return (
          <div key={option.id} className="relative overflow-hidden rounded-[10px] bg-surface-2">
            <span aria-hidden="true" className="absolute inset-y-0 left-0 bg-accent-soft" style={{ width: `${option.percent}%` }} />
            <div className={cn("relative flex min-h-9 items-center justify-between gap-3 px-3 py-1.5 text-small", chosen ? "font-semibold text-fg" : "text-fg-muted")}>
              <span className="flex min-w-0 items-center gap-1.5">
                {chosen ? <Check aria-hidden="true" className="size-3.5 shrink-0 text-accent" /> : null}
                <span className="truncate">{option.text}</span>
                {chosen ? <span className="sr-only"> Your vote</span> : null}
              </span>
              <span className="shrink-0 tabular-nums">{option.percent}%</span>
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
    <BottomSheet open={open} onClose={onClose} title={step === "reason" ? "Why are you reporting this?" : "Report"}>
      {step === "reason" ? (
        <div className="pb-3">
          <fieldset>
            <legend className="sr-only">Why are you reporting this?</legend>
            <div className="space-y-0.5">
              {REPORT_REASON_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-[10px] px-2.5 py-2 text-small transition",
                    reason === option.value ? "bg-accent-soft text-accent-soft-fg" : "text-fg hover:bg-surface-2",
                  )}
                >
                  <span>{option.label}</span>
                  <input
                    type="radio"
                    name="report-reason"
                    value={option.value}
                    checked={reason === option.value}
                    onChange={() => setReason(option.value)}
                    className="size-[18px] shrink-0 accent-[var(--accent)]"
                  />
                </label>
              ))}
            </div>
          </fieldset>
          <div className="mt-5 pb-1">
            <Button fullWidth size="lg" disabled={!reason} onClick={() => setStep("details")}>Next</Button>
          </div>
        </div>
      ) : step === "details" ? (
        <div className="pb-3">
          <button type="button" onClick={() => setStep("reason")} className="mb-4 inline-flex items-center gap-1.5 text-small font-medium text-fg-muted hover:text-fg">
            <ArrowLeft aria-hidden="true" className="size-4" /> Back
          </button>
          <label htmlFor="report-details" className="text-small font-semibold text-fg">Add details (optional)</label>
          <textarea
            id="report-details"
            value={details}
            onChange={(event) => setDetails(event.target.value.slice(0, 500))}
            rows={5}
            placeholder="What should our moderators know?"
            className="mt-2 w-full resize-y rounded-input border border-border bg-surface px-3 py-2 text-body text-fg focus:border-accent"
          />
          <p className="mt-1 text-right text-tiny text-fg-subtle">{details.length}/500</p>
          {error ? <p role="alert" className="text-small text-danger">{error}</p> : null}
          <div className="mt-5 pb-1">
            <Button fullWidth size="lg" loading={submitting} loadingLabel="Sending…" onClick={() => void submit()}>Submit</Button>
          </div>
        </div>
      ) : (
        <div className="pb-4 text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-success-soft">
            <CheckCircle2 aria-hidden="true" className="size-7 text-success" />
          </span>
          <h3 className="mt-3 text-h3 text-fg">Thanks. Our moderators will review this.</h3>
          <p className="mt-1 text-small text-fg-muted">Your name is never shown to the author.</p>
          <div className="mt-5 space-y-0.5 pb-1">
            {onMute ? (
              <button type="button" onClick={() => void onMute()} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-[10px] text-small font-medium text-fg hover:bg-surface-2">
                <BellOff aria-hidden="true" className="size-4" /> Mute @{username}
              </button>
            ) : null}
            {onBlock ? (
              <button type="button" onClick={() => void onBlock()} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-[10px] text-small font-medium text-danger hover:bg-danger-soft">
                <ShieldBan aria-hidden="true" className="size-4" /> Block @{username}
              </button>
            ) : null}
            <button type="button" onClick={() => { toast({ title: "Report received" }); onClose(); }} className="min-h-10 w-full pt-1 text-small font-semibold text-accent hover:underline">
              Done
            </button>
          </div>
        </div>
      )}
    </BottomSheet>
  );
}
