"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Flag,
  Heart,
  Loader2,
  MoreHorizontal,
  Pencil,
  Send,
  ThumbsUp,
  Trash2,
} from "lucide-react";
import type { CommentView, PostView } from "@/lib/posts/types";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/posts/client";
import { Avatar, VerifiedTick } from "@/components/ui/display";
import { IconButton } from "@/components/ui/button";
import { useToast } from "@/components/providers/toast-provider";
import { cn, timeAgo } from "@/lib/utils";
import { RichText } from "./rich-text";
import { ReportSheet } from "./post-card";

export function CommentSection({
  post,
  initialComments,
  initialSort,
  viewer,
}: {
  post: PostView;
  initialComments: CommentView[];
  initialSort: "top" | "newest";
  viewer: { id: string; username: string; fullName: string; photoUrl: string | null };
}) {
  const [comments, setComments] = useState(initialComments);
  const [sort, setSort] = useState(initialSort);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const pendingKey = useRef<string | null>(null);
  const [accepted, setAccepted] = useState(post.acceptedCommentId);
  const [reportTarget, setReportTarget] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const router = useRouter();

  async function reload(nextSort = sort) {
    const { data } = await apiGet<{ comments: CommentView[] }>(`/api/posts/${post.id}/comments?sort=${nextSort}`);
    setComments(data.comments);
  }

  async function submit(parentId: string | null = null, text?: string) {
    const value = (text ?? body).trim();
    if (!value) return;
    if (sending) return;
    setSending(true);
    setError(null);
    pendingKey.current ??= crypto.randomUUID();
    try {
      await apiPost(
        `/api/posts/${post.id}/comments`,
        { body: value, parentId },
        { idempotencyKey: pendingKey.current },
      );
      pendingKey.current = null;
      if (parentId === null) setBody("");
      await reload();
      if (parentId) toast({ title: "Reply posted" });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't post that comment.");
    } finally {
      setSending(false);
    }
  }

  async function accept(commentId: string) {
    try {
      await apiPost(`/api/posts/${post.id}/accept`, { commentId });
      setAccepted(commentId);
      toast({ title: "Answer accepted", description: "It's now pinned at the top." });
      await reload();
      router.refresh();
    } catch (err) {
      toast({ title: "Couldn't accept that answer", description: err instanceof Error ? err.message : undefined, variant: "error" });
    }
  }

  async function helpful(commentId: string, current: CommentView) {
    const marked = !current.viewer.helpful;
    setComments((rows) => updateComment(rows, commentId, (row) => ({
      ...row,
      helpfulCount: Math.max(0, row.helpfulCount + (marked ? 1 : -1)),
      viewer: { ...row.viewer, helpful: marked },
    })));
    try {
      const result = await apiPost<{ helpful: boolean; count: number }>(`/api/comments/${commentId}/helpful`);
      setComments((rows) => updateComment(rows, commentId, (row) => ({
        ...row,
        helpfulCount: result.count,
        viewer: { ...row.viewer, helpful: result.helpful },
      })));
    } catch (err) {
      setComments((rows) => updateComment(rows, commentId, () => current));
      toast({ title: "Couldn't update that", description: err instanceof Error ? err.message : undefined, variant: "error" });
    }
  }

  async function react(commentId: string, current: CommentView) {
    const reacted = !current.viewer.reacted;
    setComments((rows) => updateComment(rows, commentId, (row) => ({
      ...row,
      viewer: { ...row.viewer, reacted },
    })));
    try {
      await apiPost(`/api/comments/${commentId}/reaction`);
    } catch {
      setComments((rows) => updateComment(rows, commentId, () => current));
    }
  }

  async function remove(commentId: string) {
    try {
      await apiDelete(`/api/comments/${commentId}`);
      await reload();
      toast({ title: "Comment deleted" });
      router.refresh();
    } catch (err) {
      toast({ title: "Couldn't delete that comment", description: err instanceof Error ? err.message : undefined, variant: "error" });
    }
  }

  async function saveEdit(commentId: string, text: string) {
    try {
      await apiPatch(`/api/comments/${commentId}`, { body: text });
      await reload();
      toast({ title: "Comment updated" });
    } catch (err) {
      toast({ title: "Couldn't save", description: err instanceof Error ? err.message : undefined, variant: "error" });
    }
  }

  async function switchSort(next: "top" | "newest") {
    setSort(next);
    try {
      await reload(next);
    } catch {
      toast({ title: "Couldn't reorder comments", variant: "error" });
    }
  }

  const acceptedComment = comments.find((comment) => comment.id === accepted);
  const ordered = acceptedComment && sort === "top"
    ? [acceptedComment, ...comments.filter((comment) => comment.id !== acceptedComment.id)]
    : comments;

  return (
    <section id="comments" aria-label="Comments" className="border-t border-border bg-bg pb-20">
      <div className="flex items-center justify-between gap-3 px-4 pb-2.5 pt-4">
        <h2 className="font-display text-[1rem] font-bold text-fg">
          {post.type === "QUESTION" ? "Answers" : "Comments"} ({post.commentCount})
        </h2>
        <div className="inline-flex rounded-full border border-border bg-surface p-0.5" role="group" aria-label="Sort comments">
          {(["top", "newest"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={sort === value}
              onClick={() => void switchSort(value)}
              className={cn(
                "h-7 rounded-full px-3.5 text-tiny font-semibold capitalize transition",
                sort === value ? "bg-accent text-accent-fg" : "text-fg-muted hover:text-fg",
              )}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      {ordered.length === 0 ? (
        <div className="mx-3 rounded-[14px] border border-border bg-surface px-4 py-8 text-center text-small text-fg-muted">
          {post.type === "QUESTION" ? "No answers yet. Be the first to help." : "No comments yet. Start the conversation."}
        </div>
      ) : (
        <ul className="space-y-2.5 px-3 pb-3">
          {ordered.map((comment) => (
            <li key={comment.id}>
              <CommentRow
                comment={comment}
                isQuestion={post.type === "QUESTION"}
                canAccept={post.isOwner && post.type === "QUESTION" && comment.status === "ACTIVE"}
                accepted={accepted === comment.id}
                onAccept={() => void accept(comment.id)}
                onHelpful={helpful}
                onReact={react}
                onReply={(text) => submit(comment.id, text)}
                onDelete={remove}
                onEdit={saveEdit}
                onReport={(id) => setReportTarget(id)}
                viewerPhoto={viewer.photoUrl}
                viewerName={viewer.fullName}
                viewerUsername={viewer.username}
              />
            </li>
          ))}
        </ul>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        className="glass fixed inset-x-0 bottom-0 z-20 mx-auto flex max-w-2xl items-center gap-2 border-t border-border bg-surface px-3 py-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))]"
      >
        <Avatar name={viewer.fullName} seed={viewer.username} src={viewer.photoUrl} size="sm" />
        <label htmlFor="new-comment" className="sr-only">Add a comment</label>
        <div className="flex flex-1 items-center rounded-full border border-border bg-surface px-4 focus-within:border-accent">
          <textarea
            id="new-comment"
            value={body}
            onChange={(event) => setBody(event.target.value.slice(0, 1000))}
            rows={1}
            placeholder={post.type === "QUESTION" ? "Write an answer…" : "Add a comment…"}
            className="max-h-24 min-h-10 flex-1 resize-none border-0 bg-transparent py-2.5 text-small text-fg placeholder:text-fg-subtle focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={sending || !body.trim()}
          aria-label="Send comment"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-fg transition disabled:opacity-40"
        >
          {sending ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <Send aria-hidden="true" className="size-4" />}
        </button>
      </form>
      {error ? <p role="alert" className="px-4 pb-2 text-small text-danger">{error}</p> : null}

      <ReportSheet
        open={Boolean(reportTarget)}
        onClose={() => setReportTarget(null)}
        targetType="COMMENT"
        targetId={reportTarget ?? ""}
        username=""
      />
    </section>
  );
}

function updateComment(
  comments: CommentView[],
  id: string,
  update: (comment: CommentView) => CommentView,
): CommentView[] {
  return comments.map((comment) => {
    if (comment.id === id) return update(comment);
    if (comment.replies?.some((reply) => reply.id === id)) {
      return {
        ...comment,
        replies: comment.replies.map((reply) => (reply.id === id ? update(reply) : reply)),
      };
    }
    return comment;
  });
}

function CommentRow({
  comment,
  isQuestion,
  canAccept,
  accepted,
  onAccept,
  onHelpful,
  onReact,
  onReply,
  onDelete,
  onEdit,
  onReport,
  viewerName,
  viewerUsername,
  viewerPhoto,
  depth = 0,
}: {
  comment: CommentView;
  isQuestion: boolean;
  canAccept: boolean;
  accepted: boolean;
  onAccept: () => void;
  onHelpful: (commentId: string, current: CommentView) => Promise<void> | void;
  onReact: (commentId: string, current: CommentView) => Promise<void> | void;
  onReply: (text: string) => Promise<void> | void;
  onDelete: (commentId: string) => Promise<void> | void;
  onEdit: (commentId: string, text: string) => Promise<void> | void;
  onReport: (commentId: string) => void;
  viewerName: string;
  viewerUsername: string;
  viewerPhoto: string | null;
  depth?: number;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [replying, setReplying] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(comment.body);
  const [showReplies, setShowReplies] = useState(false);

  if (comment.status === "REMOVED") {
    return (
      <div className="rounded-[14px] border border-danger/20 bg-danger-soft px-3.5 py-2.5 text-small text-danger">
        This {isQuestion ? "answer" : "comment"} was removed by a moderator.
      </div>
    );
  }

  const level = Math.min(depth, 3);
  const cardClasses =
    level === 0
      ? accepted
        ? "rounded-[14px] border border-success/40 border-l-[3px] border-l-success bg-success-soft p-3.5"
        : "rounded-[14px] border border-border bg-surface p-3.5"
      : "relative pl-10 pt-2.5";

  return (
    <div id={`comment-${comment.id}`} className={cardClasses}>
      {level > 0 ? (
        <span
          aria-hidden="true"
          className="absolute -top-2 left-4 h-8 w-5 rounded-bl-[10px] border-b border-l border-border-strong/60"
        />
      ) : null}

      {accepted && level === 0 ? (
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="inline-flex h-6 items-center gap-1 rounded-full bg-success-solid px-2.5 text-[0.6875rem] font-semibold text-white">
            <Check aria-hidden="true" className="size-3" strokeWidth={2.8} /> Accepted answer
          </span>
          <div className="relative">
            <IconButton label="Comment options" onClick={() => setMenuOpen((value) => !value)} className="size-8">
              <MoreHorizontal aria-hidden="true" className="size-4" />
            </IconButton>
            {menuOpen ? (
              <div role="menu" className="absolute right-0 top-9 z-20 w-44 rounded-[12px] border border-border bg-surface p-1 shadow-floating">
                {comment.isOwner ? (
                  <>
                    <button type="button" role="menuitem" onClick={() => { setEditing(true); setMenuOpen(false); }} className="flex w-full items-center gap-2 rounded-[9px] px-2.5 py-2 text-left text-small hover:bg-surface-2">
                      <Pencil aria-hidden="true" className="size-3.5" /> Edit
                    </button>
                    <button type="button" role="menuitem" onClick={() => { void onDelete(comment.id); setMenuOpen(false); }} className="flex w-full items-center gap-2 rounded-[9px] px-2.5 py-2 text-left text-small text-danger hover:bg-danger-soft">
                      <Trash2 aria-hidden="true" className="size-3.5" /> Delete
                    </button>
                  </>
                ) : (
                  <button type="button" role="menuitem" onClick={() => { onReport(comment.id); setMenuOpen(false); }} className="flex w-full items-center gap-2 rounded-[9px] px-2.5 py-2 text-left text-small text-fg hover:bg-surface-2">
                    <Flag aria-hidden="true" className="size-3.5" /> Report
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="flex items-start gap-2.5">
        {comment.author ? (
          <Link href={`/profile/${comment.author.username}`} aria-label={`${comment.author.fullName}'s profile`}>
            <Avatar name={comment.author.fullName} seed={comment.author.username} src={comment.author.photoUrl} size={level > 0 ? "xs" : "sm"} />
          </Link>
        ) : (
          <Avatar name="Removed" size={level > 0 ? "xs" : "sm"} />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                {comment.author ? (
                  <Link href={`/profile/${comment.author.username}`} className="truncate text-small font-bold text-fg hover:underline">
                    {comment.author.fullName}
                  </Link>
                ) : (
                  <span className="text-small font-bold text-fg">Removed</span>
                )}
                {comment.author ? <VerifiedTick className="size-3.5" /> : null}
              </div>
              <p className="truncate text-[0.75rem] text-fg-subtle">
                {comment.author ? `@${comment.author.username} · ` : ""}
                {timeAgo(comment.createdAt)}
                {comment.editedAt ? " · Edited" : ""}
              </p>
            </div>

            {!(accepted && level === 0) ? (
              <div className="relative shrink-0">
                <IconButton label="Comment options" onClick={() => setMenuOpen((value) => !value)} className="size-8">
                  <MoreHorizontal aria-hidden="true" className="size-4" />
                </IconButton>
                {menuOpen ? (
                  <div role="menu" className="absolute right-0 top-9 z-20 w-44 rounded-[12px] border border-border bg-surface p-1 shadow-floating">
                    {comment.isOwner ? (
                      <>
                        <button type="button" role="menuitem" onClick={() => { setEditing(true); setMenuOpen(false); }} className="flex w-full items-center gap-2 rounded-[9px] px-2.5 py-2 text-left text-small hover:bg-surface-2">
                          <Pencil aria-hidden="true" className="size-3.5" /> Edit
                        </button>
                        <button type="button" role="menuitem" onClick={() => { void onDelete(comment.id); setMenuOpen(false); }} className="flex w-full items-center gap-2 rounded-[9px] px-2.5 py-2 text-left text-small text-danger hover:bg-danger-soft">
                          <Trash2 aria-hidden="true" className="size-3.5" /> Delete
                        </button>
                      </>
                    ) : (
                      <button type="button" role="menuitem" onClick={() => { onReport(comment.id); setMenuOpen(false); }} className="flex w-full items-center gap-2 rounded-[9px] px-2.5 py-2 text-left text-small text-fg hover:bg-surface-2">
                        <Flag aria-hidden="true" className="size-3.5" /> Report
                      </button>
                    )}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          {editing ? (
            <div className="mt-2">
              <textarea
                value={editBody}
                onChange={(event) => setEditBody(event.target.value.slice(0, 1000))}
                rows={3}
                className="w-full resize-y rounded-input border border-border bg-surface px-3 py-2 text-small text-fg focus:border-accent"
              />
              <div className="mt-1.5 flex justify-end gap-2">
                <button type="button" onClick={() => { setEditing(false); setEditBody(comment.body); }} className="text-small text-fg-muted">Cancel</button>
                <button type="button" onClick={() => { void onEdit(comment.id, editBody); setEditing(false); }} className="text-small font-semibold text-accent-ink">Save</button>
              </div>
            </div>
          ) : (
            <>
              {level >= 3 && comment.replyTo ? (
                <p className="mt-1.5 text-tiny text-fg-muted">
                  Replying to{" "}
                  <a href={`#comment-${comment.replyTo.id}`} className="font-semibold text-accent-ink hover:underline">
                    @{comment.replyTo.username}
                  </a>
                </p>
              ) : null}
              <div className={cn("mt-2", !isQuestion && "rounded-[12px] bg-surface-2 px-3 py-2")}>
                <RichText body={comment.body} className="whitespace-pre-line break-words text-small leading-relaxed text-fg" />
              </div>
            </>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {isQuestion ? (
              <button
                type="button"
                onClick={() => void onHelpful(comment.id, comment)}
                aria-pressed={comment.viewer.helpful}
                className={cn(
                  "inline-flex min-h-9 items-center gap-1.5 rounded-full px-2 text-tiny font-medium",
                  accepted || comment.viewer.helpful ? "text-success" : "text-fg-muted hover:bg-surface-2",
                )}
              >
                <ThumbsUp aria-hidden="true" className="size-3.5" />
                <span>{comment.helpfulCount} helpful</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void onReact(comment.id, comment)}
                aria-pressed={comment.viewer.reacted}
                aria-label="Heart this comment"
                className={cn(
                  "inline-flex min-h-9 items-center gap-1 rounded-full px-2 text-tiny font-medium",
                  comment.viewer.reacted ? "text-danger" : "text-fg-muted hover:bg-surface-2",
                )}
              >
                <Heart aria-hidden="true" className="size-3.5" fill={comment.viewer.reacted ? "currentColor" : "none"} />
                {comment.helpfulCount > 0 ? <span className="tabular-nums">{comment.helpfulCount}</span> : null}
              </button>
            )}

            {depth < 20 ? (
              <button type="button" onClick={() => setReplying((value) => !value)} className="min-h-9 rounded-full px-2.5 text-tiny font-medium text-fg-muted hover:bg-surface-2">
                Reply
              </button>
            ) : null}

            {canAccept && !accepted ? (
              <button
                type="button"
                onClick={onAccept}
                className="ml-auto inline-flex -my-1.5 min-h-11 items-center gap-1.5 rounded-full border border-accent/60 bg-surface px-3 text-tiny font-semibold text-accent-ink transition hover:bg-accent-soft"
              >
                <Check aria-hidden="true" className="size-3.5" /> Accept answer
              </button>
            ) : null}
          </div>

          {replying ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (!replyBody.trim()) return;
                void onReply(replyBody);
                setReplyBody("");
                setReplying(false);
              }}
              className="mt-2.5 flex items-end gap-2"
            >
              <Avatar name={viewerName} seed={viewerUsername} src={viewerPhoto} size="xs" />
              <label htmlFor={`reply-${comment.id}`} className="sr-only">Reply to {comment.author?.fullName ?? "comment"}</label>
              <textarea
                id={`reply-${comment.id}`}
                value={replyBody}
                onChange={(event) => setReplyBody(event.target.value.slice(0, 1000))}
                rows={1}
                placeholder="Write a reply…"
                className="min-h-9 flex-1 resize-none rounded-full border border-border bg-surface px-3.5 py-1.5 text-small focus:border-accent"
              />
              <button type="submit" className="flex size-11 items-center justify-center rounded-full bg-accent text-accent-fg" aria-label="Send reply">
                <Send aria-hidden="true" className="size-3.5" />
              </button>
            </form>
          ) : null}

          {comment.replies && comment.replies.length > 0 ? (
            <div className="mt-2">
              {showReplies || comment.replies.length <= 2 ? (
                <ul className="space-y-2">
                  {(showReplies ? comment.replies : comment.replies.slice(0, 2)).map((reply) => (
                    <li key={reply.id}>
                      <CommentRow
                        comment={reply}
                        isQuestion={isQuestion}
                        canAccept={false}
                        accepted={false}
                        onAccept={() => undefined}
                        onHelpful={onHelpful}
                        onReact={onReact}
                        onReply={onReply}
                        onDelete={onDelete}
                        onEdit={onEdit}
                        onReport={onReport}
                        viewerName={viewerName}
                        viewerUsername={viewerUsername}
                        viewerPhoto={viewerPhoto}
                        depth={depth + 1}
                      />
                    </li>
                  ))}
                </ul>
              ) : null}
              <button
                type="button"
                onClick={() => setShowReplies((value) => !value)}
                className="mt-1.5 inline-flex min-h-8 items-center gap-1 text-tiny font-semibold text-accent-ink hover:underline"
              >
                <ChevronDown aria-hidden="true" className={cn("size-3.5 transition", showReplies && "rotate-180")} />
                {showReplies ? "Hide replies" : `View ${comment.replies.length} ${comment.replies.length === 1 ? "reply" : "replies"}`}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

