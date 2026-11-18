"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  Heart,
  MoreHorizontal,
  Pencil,
  Send,
  ThumbsUp,
  Trash2,
  Flag,
  Loader2,
} from "lucide-react";
import type { CommentView, PostView } from "@/lib/posts/types";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/posts/client";
import { Avatar } from "@/components/ui/display";
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
    setSending(true);
    setError(null);
    try {
      await apiPost(`/api/posts/${post.id}/comments`, { body: value, parentId });
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
    <section id="comments" aria-label="Comments" className="border-t border-border bg-surface">
      <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-4">
        <h2 className="text-h3 text-fg">
          {post.type === "QUESTION" ? "Answers" : "Comments"} ({post.commentCount})
        </h2>
        <div className="inline-flex rounded-chip border border-border bg-surface-2 p-0.5" role="group" aria-label="Sort comments">
          {(["top", "newest"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={sort === value}
              onClick={() => void switchSort(value)}
              className={cn(
                "h-8 rounded-chip px-3 text-small font-semibold capitalize transition",
                sort === value ? "bg-surface text-fg shadow-card" : "text-fg-muted",
              )}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      {ordered.length === 0 ? (
        <p className="px-4 py-8 text-center text-small text-fg-muted">
          {post.type === "QUESTION" ? "No answers yet. Be the first to help." : "No comments yet. Start the conversation."}
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {ordered.map((comment) => (
            <li key={comment.id} className="px-4 py-3">
              <CommentRow
                comment={comment}
                isQuestion={post.type === "QUESTION"}
                canAccept={post.isOwner && post.type === "QUESTION" && comment.status === "ACTIVE"}
                accepted={accepted === comment.id}
                onAccept={() => void accept(comment.id)}
                onHelpful={() => void helpful(comment.id, comment)}
                onReact={() => void react(comment.id, comment)}
                onReply={(text) => submit(comment.id, text)}
                onDelete={() => void remove(comment.id)}
                onEdit={(text) => saveEdit(comment.id, text)}
                onReport={() => setReportTarget(comment.id)}
                viewerPhoto={viewer.photoUrl}
                viewerName={viewer.fullName}
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
        className="glass sticky bottom-0 z-20 flex items-end gap-2 border-t border-border px-3 py-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))]"
      >
        <Avatar name={viewer.fullName} src={viewer.photoUrl} size="sm" />
        <label htmlFor="new-comment" className="sr-only">Add a comment</label>
        <textarea
          id="new-comment"
          value={body}
          onChange={(event) => setBody(event.target.value.slice(0, 1000))}
          rows={1}
          placeholder="Add a comment…"
          className="max-h-28 min-h-10 flex-1 resize-none rounded-[20px] border border-border bg-surface px-3.5 py-2 text-small text-fg placeholder:text-fg-subtle focus:border-accent"
        />
        <button
          type="submit"
          disabled={sending || !body.trim()}
          aria-label="Send comment"
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-fg disabled:opacity-40"
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
  viewerPhoto,
  depth = 0,
}: {
  comment: CommentView;
  isQuestion: boolean;
  canAccept: boolean;
  accepted: boolean;
  onAccept: () => void;
  onHelpful: () => void;
  onReact: () => void;
  onReply: (text: string) => Promise<void> | void;
  onDelete: () => void;
  onEdit: (text: string) => void;
  onReport: () => void;
  viewerName: string;
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
      <div className="rounded-card border border-danger/20 bg-danger-soft px-3 py-2.5 text-small text-danger">
        This {isQuestion ? "answer" : "comment"} was removed by a moderator.
      </div>
    );
  }

  return (
    <div className={cn(depth > 0 && "ml-8 border-l-2 border-border pl-3")}>
      <div className="flex items-start gap-2.5">
        {comment.author ? (
          <Link href={`/profile/${comment.author.username}`} aria-label={`${comment.author.fullName}'s profile`}>
            <Avatar name={comment.author.fullName} src={comment.author.photoUrl} size="sm" verified />
          </Link>
        ) : (
          <Avatar name="Removed" size="sm" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 text-small">
              {comment.author ? (
                <Link href={`/profile/${comment.author.username}`} className="font-semibold text-fg hover:underline">
                  {comment.author.fullName}
                </Link>
              ) : (
                <span className="font-semibold text-fg">Removed</span>
              )}
              <span className="text-fg-subtle"> · {timeAgo(comment.createdAt)}</span>
              {comment.editedAt ? <span className="text-tiny text-fg-subtle"> · Edited</span> : null}
            </p>
            <div className="relative shrink-0">
              <IconButton label="Comment options" onClick={() => setMenuOpen((value) => !value)} className="size-8">
                <MoreHorizontal aria-hidden="true" className="size-4" />
              </IconButton>
              {menuOpen ? (
                <div role="menu" className="absolute right-0 top-8 z-20 w-44 rounded-card border border-border bg-surface p-1 shadow-floating">
                  {comment.isOwner ? (
                    <>
                      <button type="button" role="menuitem" onClick={() => { setEditing(true); setMenuOpen(false); }} className="flex w-full items-center gap-2 rounded-button px-2.5 py-2 text-left text-small hover:bg-surface-2">
                        <Pencil aria-hidden="true" className="size-3.5" /> Edit
                      </button>
                      <button type="button" role="menuitem" onClick={() => { onDelete(); setMenuOpen(false); }} className="flex w-full items-center gap-2 rounded-button px-2.5 py-2 text-left text-small text-danger hover:bg-danger-soft">
                        <Trash2 aria-hidden="true" className="size-3.5" /> Delete
                      </button>
                    </>
                  ) : (
                    <button type="button" role="menuitem" onClick={() => { onReport(); setMenuOpen(false); }} className="flex w-full items-center gap-2 rounded-button px-2.5 py-2 text-left text-small text-fg hover:bg-surface-2">
                      <Flag aria-hidden="true" className="size-3.5" /> Report
                    </button>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          {accepted ? (
            <span className="mt-0.5 inline-flex items-center gap-1 rounded-chip bg-success-soft px-2 py-0.5 text-tiny font-semibold text-success">
              <Check aria-hidden="true" className="size-3" strokeWidth={3} /> Accepted answer
            </span>
          ) : null}

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
                <button type="button" onClick={() => { onEdit(editBody); setEditing(false); }} className="text-small font-semibold text-accent">Save</button>
              </div>
            </div>
          ) : (
            <RichText body={comment.body} className="mt-1 whitespace-pre-line break-words text-small text-fg" />
          )}

          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            <button type="button" onClick={onReact} aria-pressed={comment.viewer.reacted} aria-label="Heart this comment" className={cn("inline-flex min-h-8 items-center gap-1 rounded-full px-2 text-tiny", comment.viewer.reacted ? "text-danger" : "text-fg-subtle hover:bg-surface-2")}>
              <Heart aria-hidden="true" className="size-3.5" fill={comment.viewer.reacted ? "currentColor" : "none"} /> {comment.helpfulCount > 0 ? "" : ""}
            </button>
            {isQuestion ? (
              <button type="button" onClick={onHelpful} aria-pressed={comment.viewer.helpful} className={cn("inline-flex min-h-8 items-center gap-1 rounded-full px-2 text-tiny", comment.viewer.helpful ? "text-accent" : "text-fg-subtle hover:bg-surface-2")}>
                <ThumbsUp aria-hidden="true" className="size-3.5" /> {comment.helpfulCount} helpful
              </button>
            ) : null}
            {depth === 0 ? (
              <button type="button" onClick={() => setReplying((value) => !value)} className="min-h-8 rounded-full px-2 text-tiny font-medium text-fg-subtle hover:bg-surface-2">
                Reply
              </button>
            ) : null}
            {canAccept && !accepted ? (
              <button type="button" onClick={onAccept} className="ml-auto inline-flex min-h-8 items-center gap-1 rounded-chip border border-accent/40 px-2.5 text-tiny font-semibold text-accent hover:bg-accent-soft">
                <CheckCircle2 aria-hidden="true" className="size-3.5" /> Accept answer
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
              className="mt-2 flex items-end gap-2"
            >
              <Avatar name={viewerName} src={viewerPhoto} size="xs" />
              <label htmlFor={`reply-${comment.id}`} className="sr-only">Reply to {comment.author?.fullName ?? "comment"}</label>
              <textarea
                id={`reply-${comment.id}`}
                value={replyBody}
                onChange={(event) => setReplyBody(event.target.value.slice(0, 1000))}
                rows={1}
                placeholder="Write a reply…"
                className="min-h-9 flex-1 resize-none rounded-[18px] border border-border bg-surface px-3 py-1.5 text-small focus:border-accent"
              />
              <button type="submit" className="flex size-9 items-center justify-center rounded-full bg-accent text-accent-fg" aria-label="Send reply">
                <Send aria-hidden="true" className="size-3.5" />
              </button>
            </form>
          ) : null}

          {comment.replies && comment.replies.length > 0 ? (
            <div className="mt-2">
              <button type="button" onClick={() => setShowReplies((value) => !value)} className="inline-flex items-center gap-1 text-tiny font-semibold text-accent">
                <ChevronDown aria-hidden="true" className={cn("size-3.5 transition", showReplies && "rotate-180")} />
                {showReplies ? "Hide replies" : `View ${comment.replies.length} ${comment.replies.length === 1 ? "reply" : "replies"}`}
              </button>
              {showReplies ? (
                <ul className="mt-2 space-y-3">
                  {comment.replies.map((reply) => (
                    <li key={reply.id}>
                      <CommentRow
                        comment={reply}
                        isQuestion={isQuestion}
                        canAccept={false}
                        accepted={false}
                        onAccept={() => undefined}
                        onHelpful={() => undefined}
                        onReact={() => undefined}
                        onReply={() => undefined}
                        onDelete={() => undefined}
                        onEdit={() => undefined}
                        onReport={() => undefined}
                        viewerName={viewerName}
                        viewerPhoto={viewerPhoto}
                        depth={1}
                      />
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
