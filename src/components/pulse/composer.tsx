"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  AtSign,
  BarChart2,
  Camera,
  ChevronDown,
  ChevronUp,
  Clock,
  Globe,
  GraduationCap,
  GripVertical,
  Hash,
  Image as ImageIcon,
  Info,
  Layers,
  Loader2,
  Lock,
  Plus,
  Users,
  X,
} from "lucide-react";
import type { DraftView } from "@/lib/posts/types";
import { ApiError, apiDelete, apiGet, apiPost } from "@/lib/posts/client";
import { uploadPostImage, type UploadedPostImage } from "@/lib/client/post-image";
import { enqueueOutbox } from "@/lib/offline/store";
import { Avatar, VerifiedTick } from "@/components/ui/display";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/overlays";
import { useToast } from "@/components/providers/toast-provider";
import { cn } from "@/lib/utils";

type Mode = "POST" | "QUESTION" | "POLL";

interface ComposerViewer {
  id: string;
  fullName: string;
  username: string;
  photoUrl: string | null;
  level: number;
  departmentName: string;
}

interface AudienceChoice {
  id: string;
  label: string;
  description: string;
  scope: string;
}

export function Composer({
  viewer,
  audiences,
  initialType,
  initialDraft,
}: {
  viewer: ComposerViewer;
  audiences: AudienceChoice[];
  initialType: Mode;
  initialDraft?: DraftView | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const initialMode: Mode =
    initialDraft?.type === "QUESTION" || initialDraft?.type === "POLL" || initialDraft?.type === "POST"
      ? initialDraft.type
      : initialType;
  const [mode, setMode] = useState<Mode>(initialMode);
  const [online, setOnline] = useState(true);
  const [body, setBody] = useState(initialDraft?.payload.body ?? "");
  const [questionTitle, setQuestionTitle] = useState(initialDraft?.payload.questionTitle ?? "");
  const [topicTag, setTopicTag] = useState(initialDraft?.payload.topicTag ?? "");
  const [editingTopic, setEditingTopic] = useState(!(initialDraft?.payload.topicTag));
  const [pollOptions, setPollOptions] = useState<string[]>(
    initialDraft?.payload.pollOptions?.length ? initialDraft.payload.pollOptions : ["", ""],
  );
  const [pollDays, setPollDays] = useState<1 | 3 | 7>((initialDraft?.payload.pollDurationDays as 1 | 3 | 7) ?? 1);
  const [media, setMedia] = useState<UploadedPostImage[]>(
    (initialDraft?.payload.media ?? []).map((item) => ({ ...item, alt: item.alt ?? null })),
  );
  const [audienceId, setAudienceId] = useState(
    initialDraft?.audience.id ??
      audiences.find((option) => option.scope === "level")?.id ??
      audiences[audiences.length - 1]?.id ??
      "",
  );
  const [audienceOpen, setAudienceOpen] = useState(false);
  const [audienceDraft, setAudienceDraft] = useState(audienceId);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftId, setDraftId] = useState<string | null>(initialDraft?.id ?? null);
  const [draftState, setDraftState] = useState<"idle" | "saving" | "saved">(initialDraft ? "saved" : "idle");
  const [suggestions, setSuggestions] = useState<
    | { kind: "mention"; items: Array<{ username: string; fullName: string; photoUrl: string | null }> }
    | { kind: "hashtag"; items: string[] }
    | null
  >(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const caret = useRef(0);
  const idempotencyKey = useRef(crypto.randomUUID());
  const audience = audiences.find((option) => option.id === audienceId) ?? audiences[0];

  useEffect(() => {
    setOnline(navigator.onLine);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    if (mode !== "POLL" && pollOptions.length === 0) setPollOptions(["", ""]);
  }, [mode, pollOptions.length]);

  useEffect(() => {
    const hasContent =
      body.trim() || questionTitle.trim() || media.length > 0 || pollOptions.some((option) => option.trim());
    if (!hasContent) return;
    setDraftState("saving");
    const timer = window.setTimeout(async () => {
      try {
        const result = await apiPost<{ id: string }>("/api/drafts", {
          id: draftId ?? undefined,
          type: mode,
          payload: {
            body,
            questionTitle,
            topicTag,
            pollOptions,
            pollDurationDays: pollDays,
            media,
          },
          audience: { id: audience?.id, label: audience?.label, kind: undefined },
        });
        setDraftId(result.id);
        setDraftState("saved");
      } catch {
        setDraftState("idle");
      }
    }, 1400);
    return () => window.clearTimeout(timer);
  }, [body, questionTitle, topicTag, pollOptions, pollDays, media, audienceId, mode, draftId, audience?.id, audience?.label]);

  useEffect(() => {
    const value = body.slice(0, caret.current);
    const match = value.match(/([@#])([\p{L}\p{N}_]*)$/u);
    if (!match) {
      setSuggestions(null);
      return;
    }
    const symbol = match[1];
    const query = match[2] ?? "";
    if (!query) {
      setSuggestions(null);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        if (symbol === "@") {
          const { data } = await apiGet<{ people: Array<{ username: string; fullName: string; photoUrl: string | null }> }>(
            `/api/mentions?q=${encodeURIComponent(query)}`,
          );
          if (!cancelled) setSuggestions({ kind: "mention", items: data.people });
        } else {
          const { data } = await apiGet<{ tags: string[] }>(`/api/hashtags?q=${encodeURIComponent(query)}`);
          if (!cancelled) setSuggestions({ kind: "hashtag", items: data.tags });
        }
      } catch {
        if (!cancelled) setSuggestions(null);
      }
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [body]);

  function insert(token: string, replaceLength = 0) {
    const node = textarea.current;
    const position = node?.selectionStart ?? body.length;
    const before = body.slice(0, Math.max(0, position - replaceLength));
    const after = body.slice(position);
    const next = `${before}${token}${after}`;
    setBody(next.slice(0, 2000));
    setSuggestions(null);
    requestAnimationFrame(() => {
      node?.focus();
      const offset = before.length + token.length;
      node?.setSelectionRange(offset, offset);
    });
  }

  function applySuggestion(value: string) {
    const node = textarea.current;
    const position = node?.selectionStart ?? body.length;
    const before = body.slice(0, position);
    const match = before.match(/([@#])([\p{L}\p{N}_]*)$/u);
    if (!match) return;
    const replaceLength = match[0].length;
    insert(value.startsWith("#") || value.startsWith("@") ? `${value} ` : `@${value} `, replaceLength);
  }

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const room = 4 - media.length;
    if (room <= 0) {
      toast({ title: "Four images is the limit", variant: "error" });
      return;
    }
    setUploading(true);
    setError(null);
    const selected = Array.from(files).slice(0, room);
    try {
      for (const file of selected) {
        const uploaded = await uploadPostImage(file);
        setMedia((current) => [...current, uploaded].slice(0, 4));
      }
    } catch (err) {
      toast({ title: "Couldn't add that image", description: err instanceof Error ? err.message : undefined, variant: "error" });
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
      if (cameraInput.current) cameraInput.current.value = "";
    }
  }

  function validate(): string | null {
    if (mode === "POLL") {
      const options = pollOptions.map((option) => option.trim()).filter(Boolean);
      if (!body.trim()) return "Ask a poll question first.";
      if (options.length < 2) return "Add at least two options.";
      if (new Set(options.map((option) => option.toLowerCase())).size !== options.length) return "Each option needs to be different.";
    }
    if (mode === "QUESTION") {
      if (questionTitle.trim().length < 8) return "Give your question a clear title (at least 8 characters).";
      if (!body.trim()) return "Add a little detail so people can help.";
    }
    if (mode === "POST" && !body.trim() && media.length === 0) return "Write something or attach an image.";
    if (body.length > 2000) return "Posts can be up to 2,000 characters.";
    return null;
  }

  async function submit() {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setSubmitting(true);
    setError(null);
    const payload = {
      type: mode,
      body,
      audienceId: audience?.id ?? "",
      questionTitle: mode === "QUESTION" ? questionTitle : undefined,
      topicTag: mode === "QUESTION" ? topicTag || undefined : undefined,
      pollOptions: mode === "POLL" ? pollOptions : undefined,
      pollDurationDays: mode === "POLL" ? pollDays : undefined,
      media,
      idempotencyKey: idempotencyKey.current,
    };
    try {
      if (!online) {
        await enqueueOutbox({
          id: `${viewer.id}-${idempotencyKey.current}`,
          userId: viewer.id,
          createdAt: new Date().toISOString(),
          attempts: 0,
          status: "sending",
          payload,
        });
        toast({ title: "Saved to your outbox", description: "It will send when you're back online." });
        return;
      }
      const result = await apiPost<{ id: string; flagged: boolean }>("/api/posts", payload);
      if (draftId) await apiDelete(`/api/drafts/${draftId}`).catch(() => undefined);
      toast({ title: mode === "QUESTION" ? "Question posted" : mode === "POLL" ? "Poll posted" : "Post published" });
      router.push(`/p/${result.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 0) {
        setError("You're offline. Try again when you have a connection.");
      } else {
        setError(err instanceof Error ? err.message : "Couldn't publish that.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-dvh bg-surface text-fg">
      <header className="sticky top-0 z-40 border-b border-border bg-surface">
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-2 px-3">
          <Link href="/pulse" aria-label="Close composer" className="flex size-11 items-center justify-center rounded-full text-fg hover:bg-surface-2">
            <X aria-hidden="true" className="size-5" />
          </Link>
          <div className="min-w-0 flex-1 text-center">
            <p className="font-display text-[1.0625rem] font-bold text-fg">
              {mode === "POST" ? "Post" : mode === "QUESTION" ? "Question" : "Poll"}
            </p>
            {draftState !== "idle" ? (
              <p className="text-[0.6875rem] text-fg-subtle">{draftState === "saved" ? "Draft saved" : "Saving…"}</p>
            ) : null}
          </div>
          <Button size="sm" className="rounded-full px-5 font-semibold" onClick={() => void submit()} loading={submitting} loadingLabel="Posting…">
            Post
          </Button>
        </div>
      </header>

      <main className="mx-auto flex min-h-[calc(100dvh-3.5rem)] w-full max-w-2xl flex-col px-4 pb-6 pt-4">
        <div className="flex-1">
          <div className="flex items-start gap-3">
            <Avatar name={viewer.fullName} seed={viewer.username} src={viewer.photoUrl} size="md" className="mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="truncate text-[0.9375rem] font-bold text-fg">{viewer.fullName}</p>
                <VerifiedTick />
              </div>
              <p className="truncate text-small text-fg-muted">@{viewer.username}</p>
              <button
                type="button"
                onClick={() => { setAudienceDraft(audienceId); setAudienceOpen(true); }}
                className="mt-2.5 inline-flex h-8 items-center gap-1.5 rounded-full bg-accent-soft px-3.5 text-small font-semibold text-accent-soft-fg transition hover:bg-accent-soft/80"
              >
                <Users aria-hidden="true" className="size-3.5 text-accent-ink" />
                <span>Posting to: {audience?.label ?? "your audience"}</span>
                <ChevronDown aria-hidden="true" className="size-3.5 text-accent-ink" />
              </button>
            </div>
          </div>

          {mode === "QUESTION" ? (
            <div className="mt-5 space-y-4">
              <div>
                <label htmlFor="question-title" className="block text-small font-medium text-fg-muted">Ask a clear question</label>
                <textarea
                  id="question-title"
                  rows={2}
                  value={questionTitle}
                  onChange={(event) => setQuestionTitle(event.target.value.replaceAll("\n", " ").slice(0, 140))}
                  placeholder="Does anyone have the CSC 204 past questions?"
                  className="mt-1.5 w-full resize-none rounded-[12px] border border-border bg-surface px-3.5 py-2.5 text-[0.9375rem] font-medium leading-snug text-fg placeholder:text-fg-subtle focus:border-accent"
                />
              </div>

              <div>
                <label htmlFor="topic-tag" className="block text-small font-medium text-fg-muted">Topic (optional)</label>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  {topicTag && !editingTopic ? (
                    <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-accent-soft px-3.5 text-small font-semibold text-accent-soft-fg">
                      <span>{topicTag}</span>
                      <button
                        type="button"
                        aria-label="Clear topic"
                        onClick={() => { setTopicTag(""); setEditingTopic(true); }}
                        className="rounded-full p-0.5 text-accent-ink hover:bg-surface/60"
                      >
                        <X aria-hidden="true" className="size-3.5" />
                      </button>
                    </span>
                  ) : null}
                  <input
                    id="topic-tag"
                    value={topicTag}
                    onFocus={() => setEditingTopic(true)}
                    onBlur={() => { if (topicTag.trim()) setEditingTopic(false); }}
                    onChange={(event) => setTopicTag(event.target.value.replace(/^#/, "").slice(0, 50))}
                    placeholder={topicTag && !editingTopic ? "Change topic…" : "e.g. CSC 204"}
                    className={cn(
                      "h-10 rounded-[12px] border border-border bg-surface px-3.5 text-small text-fg placeholder:text-fg-subtle focus:border-accent",
                      topicTag && !editingTopic ? "sr-only" : "w-full",
                    )}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="post-body" className="block text-small font-medium text-fg-muted">Details</label>
                <textarea
                  id="post-body"
                  ref={textarea}
                  value={body}
                  onSelect={(event) => { caret.current = event.currentTarget.selectionStart; }}
                  onChange={(event) => {
                    setBody(event.target.value.slice(0, 2000));
                    caret.current = event.currentTarget.selectionStart;
                  }}
                  rows={4}
                  placeholder="Add more details (optional)…"
                  className="mt-1.5 min-h-[120px] w-full resize-none rounded-[12px] border border-border bg-surface p-3.5 text-[0.9375rem] leading-relaxed text-fg placeholder:text-fg-subtle focus:border-accent"
                />
                <p className={cn("mt-1 text-right text-tiny tabular-nums", body.length > 1900 ? "text-warning" : "text-fg-subtle")}>
                  {body.length} / 2000
                </p>
              </div>
            </div>
          ) : mode === "POLL" ? (
            <div className="mt-5 space-y-4">
              <div>
                <label htmlFor="post-body" className="block text-small font-medium text-fg-muted">Poll question</label>
                <input
                  id="post-body"
                  value={body}
                  onChange={(event) => setBody(event.target.value.slice(0, 500))}
                  placeholder="Best place to study at night?"
                  className="mt-1.5 h-12 w-full rounded-[12px] border border-border bg-surface px-3.5 text-[0.9375rem] font-medium text-fg placeholder:text-fg-subtle focus:border-accent"
                />
              </div>

              <fieldset>
                <legend className="text-small font-medium text-fg-muted">Poll options</legend>
                <div className="mt-1.5 space-y-2">
                  {pollOptions.map((option, index) => (
                    <div key={index} className="flex items-center gap-1.5 rounded-[12px] border border-border bg-surface px-2 focus-within:border-accent">
                      <GripVertical aria-hidden="true" className="size-4 shrink-0 text-fg-subtle" />
                      <input
                        aria-label={`Option ${index + 1}`}
                        value={option}
                        onChange={(event) =>
                          setPollOptions((current) => current.map((value, position) => (position === index ? event.target.value.slice(0, 80) : value)))
                        }
                        placeholder={index === 0 ? "University Library" : index === 1 ? "Faculty Reading Room" : "Another option"}
                        className="h-11 min-w-0 flex-1 border-0 bg-transparent text-[0.9375rem] text-fg placeholder:text-fg-subtle focus:outline-none"
                      />
                      <div className="flex shrink-0 items-center">
                        {pollOptions.length > 2 && index > 0 ? (
                          <button
                            type="button"
                            aria-label={`Move option ${index + 1} up`}
                            onClick={() =>
                              setPollOptions((current) => {
                                if (index === 0) return current;
                                const copy = [...current];
                                [copy[index - 1], copy[index]] = [copy[index]!, copy[index - 1]!];
                                return copy;
                              })
                            }
                            className="flex size-8 items-center justify-center rounded-full text-fg-subtle hover:bg-surface-2 hover:text-fg"
                          >
                            <ChevronUp aria-hidden="true" className="size-3.5" />
                          </button>
                        ) : null}
                        <button
                          type="button"
                          aria-label={pollOptions.length > 2 ? `Remove answer ${index + 1}` : `Clear answer ${index + 1}`}
                          onClick={() => {
                            if (pollOptions.length > 2) {
                              setPollOptions((current) => current.filter((_, position) => position !== index));
                            } else {
                              setPollOptions((current) => current.map((value, position) => (position === index ? "" : value)));
                            }
                          }}
                          className="flex size-8 items-center justify-center rounded-full text-fg-subtle hover:bg-surface-2 hover:text-fg"
                        >
                          <X aria-hidden="true" className="size-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {pollOptions.length < 4 ? (
                  <button
                    type="button"
                    onClick={() => setPollOptions((current) => [...current, ""])}
                    className="mt-2.5 flex h-11 w-full items-center justify-center gap-1.5 rounded-[12px] bg-accent-soft text-small font-semibold text-accent-soft-fg transition hover:bg-accent-soft/80"
                  >
                    <Plus aria-hidden="true" className="size-4" /> Add option
                  </button>
                ) : null}

                <div className="mt-3.5 flex items-center gap-2.5 text-small">
                  <Clock aria-hidden="true" className="size-4 text-fg-muted" />
                  <label htmlFor="poll-duration" className="text-fg-muted">Duration:</label>
                  <select
                    id="poll-duration"
                    value={pollDays}
                    onChange={(event) => setPollDays(Number(event.target.value) as 1 | 3 | 7)}
                    className="h-8 rounded-full bg-accent-soft px-3 text-small font-semibold text-accent-soft-fg focus:outline-none"
                  >
                    <option value={1}>1 day</option>
                    <option value={3}>3 days</option>
                    <option value={7}>7 days</option>
                  </select>
                </div>
              </fieldset>
            </div>
          ) : (
            <div className="mt-3">
              <label htmlFor="post-body" className="sr-only">What&apos;s happening on campus?</label>
              <textarea
                id="post-body"
                ref={textarea}
                value={body}
                onSelect={(event) => { caret.current = event.currentTarget.selectionStart; }}
                onChange={(event) => {
                  const next = event.target.value.slice(0, 2000);
                  setBody(next);
                  caret.current = event.currentTarget.selectionStart;
                  requestAnimationFrame(() => {
                    const node = textarea.current;
                    if (!node) return;
                    node.style.height = "auto";
                    node.style.height = `${Math.min(node.scrollHeight, 380)}px`;
                  });
                }}
                rows={5}
                placeholder="What's happening on campus?"
                className="min-h-36 w-full resize-none border-0 bg-transparent px-0 py-3 text-[1.0625rem] leading-relaxed text-fg placeholder:text-fg-subtle focus:outline-none focus-visible:outline-none"
              />
              <p className={cn("mt-1 text-right text-tiny tabular-nums", body.length > 1900 ? "text-warning" : "text-fg-subtle")}>
                {body.length} / 2000
              </p>
            </div>
          )}

          {suggestions && suggestions.items.length > 0 ? (
            <div className="mt-2 overflow-hidden rounded-card border border-border bg-surface shadow-floating">
              <p className="border-b border-border px-3 py-1.5 text-tiny font-semibold uppercase tracking-wide text-fg-subtle">
                {suggestions.kind === "mention" ? "People at your university" : "Hashtags"}
              </p>
              <ul className="max-h-52 overflow-y-auto">
                {suggestions.kind === "mention"
                  ? (suggestions.items as Array<{ username: string; fullName: string; photoUrl: string | null }>).map((person) => (
                      <li key={person.username}>
                        <button type="button" onClick={() => applySuggestion(person.username)} className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-surface-2">
                          <Avatar name={person.fullName} seed={person.username} src={person.photoUrl} size="xs" />
                          <span className="min-w-0">
                            <span className="block truncate text-small font-semibold text-fg">{person.fullName}</span>
                            <span className="block truncate text-tiny text-fg-subtle">@{person.username}</span>
                          </span>
                        </button>
                      </li>
                    ))
                  : (suggestions.items as string[]).map((tag) => (
                      <li key={tag}>
                        <button type="button" onClick={() => applySuggestion(`#${tag}`)} className="block w-full px-3 py-2 text-left text-small text-fg hover:bg-surface-2">
                          #{tag}
                        </button>
                      </li>
                    ))}
              </ul>
            </div>
          ) : null}

          {media.length > 0 ? (
            <ul className="mt-3 grid grid-cols-2 gap-2.5">
              {media.map((item, index) => (
                <li key={item.publicId} className="group relative overflow-hidden rounded-[14px] border border-border bg-surface-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.url} alt={item.alt ?? ""} width={item.width} height={item.height} className="aspect-[4/3] w-full object-cover" />
                  <button
                    type="button"
                    aria-label={`Remove image ${index + 1}`}
                    onClick={() => setMedia((current) => current.filter((_, position) => position !== index))}
                    className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-surface/95 text-fg shadow-card transition hover:bg-surface"
                  >
                    <X aria-hidden="true" className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {!online ? (
            <p className="mt-3 rounded-card border border-warning/30 bg-warning-soft px-3 py-2 text-small text-warning">
              You&apos;re offline. This post will join your outbox and send when you reconnect.
            </p>
          ) : null}
          {error ? <p role="alert" className="mt-3 rounded-card border border-danger/30 bg-danger-soft px-3 py-2 text-small text-danger">{error}</p> : null}
        </div>

        <div className="sticky bottom-3 mt-5">
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="sr-only"
            id="composer-images"
            onChange={(event) => void addFiles(event.target.files)}
            disabled={mode === "POLL"}
          />
          <input
            ref={cameraInput}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            id="composer-camera"
            onChange={(event) => void addFiles(event.target.files)}
            disabled={mode === "POLL"}
          />
          <div className="grid grid-cols-5 items-center rounded-[14px] border border-border bg-surface py-1 shadow-card">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={mode === "POLL" || uploading || media.length >= 4}
              aria-label="Add images"
              className="flex h-11 items-center justify-center rounded-[10px] text-fg hover:bg-surface-2 disabled:opacity-40"
            >
              {uploading ? <Loader2 aria-hidden="true" className="size-5 animate-spin" /> : <ImageIcon aria-hidden="true" className="size-5" />}
            </button>
            <button
              type="button"
              onClick={() => cameraInput.current?.click()}
              disabled={mode === "POLL" || uploading || media.length >= 4}
              aria-label="Take photo"
              className="flex h-11 items-center justify-center rounded-[10px] text-fg hover:bg-surface-2 disabled:opacity-40"
            >
              <Camera aria-hidden="true" className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => setMode((current) => (current === "POLL" ? "POST" : "POLL"))}
              aria-label={mode === "POLL" ? "Switch to post" : "Create poll"}
              className={cn(
                "flex h-11 items-center justify-center rounded-[10px] hover:bg-surface-2",
                mode === "POLL" ? "text-accent-ink" : "text-fg",
              )}
            >
              <BarChart2 aria-hidden="true" className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => insert("@")}
              aria-label="Mention someone"
              className="flex h-11 items-center justify-center rounded-[10px] text-fg hover:bg-surface-2"
            >
              <AtSign aria-hidden="true" className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => insert("#")}
              aria-label="Add hashtag"
              className="flex h-11 items-center justify-center rounded-[10px] text-fg hover:bg-surface-2"
            >
              <Hash aria-hidden="true" className="size-5" />
            </button>
          </div>
          <p className="mt-2.5 flex items-center justify-center gap-1 text-tiny text-fg-subtle">
            <Lock aria-hidden="true" className="size-3" />
            Only {audience?.description ?? "your audience"} can see this
          </p>
        </div>
      </main>

      <BottomSheet
        open={audienceOpen}
        onClose={() => setAudienceOpen(false)}
        title="Who can see this?"
        hideClose
        footer={
          <Button
            fullWidth
            size="lg"
            className="rounded-full"
            onClick={() => { setAudienceId(audienceDraft); setAudienceOpen(false); }}
          >
            Done
          </Button>
        }
      >
        <div className="space-y-2 pb-2">
          {audiences.map((option) => {
            const selected = audienceDraft === option.id;
            const ScopeIcon =
              option.scope === "university"
                ? Globe
                : option.scope === "college" || option.scope === "faculty"
                  ? GraduationCap
                  : option.scope === "department"
                    ? Layers
                    : Users;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setAudienceDraft(option.id)}
                className={cn(
                  "flex min-h-[60px] w-full items-center gap-3 rounded-[14px] border px-3.5 py-2.5 text-left transition",
                  selected ? "border-accent/40 bg-accent-soft" : "border-border bg-surface hover:bg-surface-2",
                )}
              >
                <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", selected ? "text-accent-ink" : "text-fg")}>
                  <ScopeIcon aria-hidden="true" className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block truncate text-[0.9375rem] font-bold", selected ? "text-accent-soft-fg" : "text-fg")}>{option.label}</span>
                  <span className="block truncate text-tiny text-fg-muted">{option.description}</span>
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                    selected ? "border-accent bg-accent" : "border-border-strong",
                  )}
                >
                  {selected ? <span className="size-2 rounded-full bg-surface" /> : null}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-1 flex items-center gap-2 px-1 pb-1 text-tiny text-fg-muted">
          <Info aria-hidden="true" className="size-4 shrink-0 text-fg-subtle" />
          Only people in this audience will see your post.
        </p>
      </BottomSheet>
    </div>
  );
}

