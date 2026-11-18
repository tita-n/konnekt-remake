"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  AtSign,
  BarChart3,
  Check,
  ChevronDown,
  Hash,
  ImagePlus,
  Loader2,
  Lock,
  Plus,
  Trash2,
  Users,
  X,
} from "lucide-react";
import type { DraftView } from "@/lib/posts/types";
import { ApiError, apiDelete, apiGet, apiPost } from "@/lib/posts/client";
import { uploadPostImage, type UploadedPostImage } from "@/lib/client/post-image";
import { enqueueOutbox } from "@/lib/offline/store";
import { Avatar } from "@/components/ui/display";
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

const MODES: Array<{ value: Mode; label: string; icon: typeof BarChart3 }> = [
  { value: "POST", label: "Post", icon: ImagePlus },
  { value: "QUESTION", label: "Question", icon: Users },
  { value: "POLL", label: "Poll", icon: BarChart3 },
];

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
  const [mode, setMode] = useState<Mode>(
    initialDraft?.type === "QUESTION" || initialDraft?.type === "POLL" || initialDraft?.type === "POST"
      ? initialDraft.type
      : initialType,
  );
  const [online, setOnline] = useState(true);
  const [body, setBody] = useState(initialDraft?.payload.body ?? "");
  const [questionTitle, setQuestionTitle] = useState(initialDraft?.payload.questionTitle ?? "");
  const [topicTag, setTopicTag] = useState(initialDraft?.payload.topicTag ?? "");
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
  const caret = useRef(0);
  const idempotencyKey = useRef(initialDraft ? crypto.randomUUID() : crypto.randomUUID());
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

  // Debounced server-side draft autosave. An empty composer never creates one.
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
    <div className="min-h-dvh bg-bg text-fg">
      <header className="glass sticky top-0 z-40 border-b border-border">
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-2 px-2">
          <Link href="/pulse" aria-label="Close composer" className="flex size-11 items-center justify-center rounded-full hover:bg-surface-2">
            <X aria-hidden="true" className="size-5" />
          </Link>
          <div className="min-w-0 flex-1 text-center">
            <p className="text-[0.9375rem] font-semibold">
              {mode === "POST" ? "Post" : mode === "QUESTION" ? "Question" : "Poll"}
            </p>
            <p className="text-tiny text-fg-subtle">{draftState === "saved" ? "Draft saved" : draftState === "saving" ? "Saving draft…" : "New post"}</p>
          </div>
          <Button size="sm" onClick={() => void submit()} loading={submitting} loadingLabel="Posting…">
            Post
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl px-4 pb-10 pt-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Post type">
          {MODES.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={mode === item.value}
              onClick={() => setMode(item.value)}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-chip border px-3 text-small font-semibold transition",
                mode === item.value ? "border-accent bg-accent text-accent-fg" : "border-border bg-surface text-fg-muted hover:text-fg",
              )}
            >
              <item.icon aria-hidden="true" className="size-4" />
              {item.label}
            </button>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-3">
          <Avatar name={viewer.fullName} src={viewer.photoUrl} size="md" verified />
          <div className="min-w-0">
            <p className="truncate text-[0.9375rem] font-semibold">{viewer.fullName}</p>
            <p className="truncate text-small text-fg-subtle">@{viewer.username}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setAudienceOpen(true)}
          className="mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-chip bg-accent-soft px-3 text-small font-semibold text-accent-soft-fg hover:brightness-95"
        >
          <Users aria-hidden="true" className="size-4" />
          Posting to {audience?.label ?? "your audience"}
          <ChevronDown aria-hidden="true" className="size-3.5" />
        </button>

        {mode === "QUESTION" ? (
          <div className="mt-4 space-y-3">
            <div>
              <label htmlFor="question-title" className="text-small font-semibold text-fg">Ask a clear question</label>
              <input
                id="question-title"
                value={questionTitle}
                onChange={(event) => setQuestionTitle(event.target.value.slice(0, 140))}
                placeholder="Does anyone have the CSC 204 past questions?"
                className="mt-1.5 h-11 w-full rounded-input border border-border bg-surface px-3.5 text-body text-fg placeholder:text-fg-subtle focus:border-accent"
              />
              <p className="mt-1 text-right text-tiny text-fg-subtle">{questionTitle.length}/140</p>
            </div>
            <div>
              <label htmlFor="topic-tag" className="text-small font-semibold text-fg">Topic (optional)</label>
              <input
                id="topic-tag"
                value={topicTag}
                onChange={(event) => setTopicTag(event.target.value.replace(/^#/, "").slice(0, 50))}
                placeholder="CSC 204"
                className="mt-1.5 h-11 w-full rounded-input border border-border bg-surface px-3.5 text-body text-fg placeholder:text-fg-subtle focus:border-accent"
              />
            </div>
          </div>
        ) : null}

        <div className="mt-3">
          <label htmlFor="post-body" className="sr-only">
            {mode === "POLL" ? "Poll question" : mode === "QUESTION" ? "Details" : "What's happening on campus?"}
          </label>
          <textarea
            id="post-body"
            ref={textarea}
            value={body}
            onSelect={(event) => { caret.current = event.currentTarget.selectionStart; }}
            onChange={(event) => {
              const next = event.target.value.slice(0, 2000);
              setBody(next);
              caret.current = event.target.selectionStart;
              requestAnimationFrame(() => {
                const node = textarea.current;
                if (!node) return;
                node.style.height = "auto";
                node.style.height = `${Math.min(node.scrollHeight, 420)}px`;
              });
            }}
            rows={5}
            placeholder={
              mode === "POLL"
                ? "Ask your poll question…"
                : mode === "QUESTION"
                  ? "Add the details that will help people answer…"
                  : "What's happening on campus?"
            }
            className="min-h-32 w-full resize-none rounded-card border border-border bg-surface px-3.5 py-3 text-body leading-relaxed text-fg placeholder:text-fg-subtle focus:border-accent"
          />
          <p className={cn("mt-1 text-right text-tiny", body.length > 1900 ? "text-warning" : "text-fg-subtle")}>{body.length}/2000</p>
        </div>

        {suggestions && suggestions.items.length > 0 ? (
          <div className="mt-1 overflow-hidden rounded-card border border-border bg-surface shadow-floating">
            <p className="border-b border-border px-3 py-1.5 text-tiny font-semibold uppercase tracking-wide text-fg-subtle">
              {suggestions.kind === "mention" ? "People at your university" : "Hashtags"}
            </p>
            <ul className="max-h-52 overflow-y-auto">
              {suggestions.kind === "mention"
                ? (suggestions.items as Array<{ username: string; fullName: string; photoUrl: string | null }>).map((person) => (
                    <li key={person.username}>
                      <button type="button" onClick={() => applySuggestion(person.username)} className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-surface-2">
                        <Avatar name={person.fullName} src={person.photoUrl} size="xs" />
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

        {mode === "POLL" ? (
          <fieldset className="mt-4 rounded-card border border-border bg-surface p-3.5">
            <legend className="px-1 text-small font-semibold text-fg">Poll options</legend>
            <div className="mt-1 space-y-2">
              {pollOptions.map((option, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-tiny font-semibold text-fg-muted">
                    {index + 1}
                  </span>
                  <input
                    aria-label={`Option ${index + 1}`}
                    value={option}
                    onChange={(event) =>
                      setPollOptions((current) => current.map((value, position) => (position === index ? event.target.value.slice(0, 80) : value)))
                    }
                    placeholder={index === 0 ? "University Library" : index === 1 ? "Faculty Reading Room" : "Another option"}
                    className="h-10 min-w-0 flex-1 rounded-input border border-border bg-surface px-3 text-small text-fg placeholder:text-fg-subtle focus:border-accent"
                  />
                  {pollOptions.length > 2 ? (
                    <button type="button" aria-label={`Remove option ${index + 1}`} onClick={() => setPollOptions((current) => current.filter((_, position) => position !== index))} className="flex size-9 items-center justify-center rounded-full text-fg-subtle hover:bg-surface-2">
                      <X aria-hidden="true" className="size-4" />
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
            {pollOptions.length < 4 ? (
              <button type="button" onClick={() => setPollOptions((current) => [...current, ""])} className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-chip px-2 text-small font-semibold text-accent hover:bg-accent-soft">
                <Plus aria-hidden="true" className="size-4" /> Add option
              </button>
            ) : null}
            <div className="mt-3 border-t border-border pt-3">
              <p className="text-small font-semibold text-fg">Duration</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {([1, 3, 7] as const).map((days) => (
                  <button
                    key={days}
                    type="button"
                    aria-pressed={pollDays === days}
                    onClick={() => setPollDays(days)}
                    className={cn(
                      "h-9 rounded-chip border px-3 text-small font-medium",
                      pollDays === days ? "border-accent bg-accent-soft text-accent-soft-fg" : "border-border text-fg-muted",
                    )}
                  >
                    {days === 1 ? "1 day" : `${days} days`}
                  </button>
                ))}
              </div>
            </div>
          </fieldset>
        ) : null}

        {media.length > 0 ? (
          <ul className="mt-4 grid grid-cols-2 gap-2">
            {media.map((item, index) => (
              <li key={item.publicId} className="relative overflow-hidden rounded-card border border-border bg-surface-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.url} alt={item.alt ?? ""} width={item.width} height={item.height} className="aspect-square w-full object-cover" />
                <button
                  type="button"
                  aria-label={`Remove image ${index + 1}`}
                  onClick={() => setMedia((current) => current.filter((_, position) => position !== index))}
                  className="absolute right-1.5 top-1.5 flex size-9 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/75"
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                </button>
                <label className="sr-only" htmlFor={`alt-${index}`}>Alt text for image {index + 1}</label>
                <input
                  id={`alt-${index}`}
                  value={item.alt ?? ""}
                  onChange={(event) =>
                    setMedia((current) => current.map((value, position) => (position === index ? { ...value, alt: event.target.value.slice(0, 240) } : value)))
                  }
                  placeholder="Alt text (optional)"
                  className="h-9 w-full border-t border-border bg-surface px-2 text-tiny text-fg placeholder:text-fg-subtle"
                />
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
          <div className="flex items-center gap-0.5">
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
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={mode === "POLL" || uploading || media.length >= 4}
              aria-label="Add images"
              className="flex size-11 items-center justify-center rounded-full text-fg-muted hover:bg-surface-2 disabled:opacity-40"
            >
              {uploading ? <Loader2 aria-hidden="true" className="size-5 animate-spin" /> : <ImagePlus aria-hidden="true" className="size-5" />}
            </button>
            <button type="button" onClick={() => insert("#")} aria-label="Add hashtag" className="flex size-11 items-center justify-center rounded-full text-fg-muted hover:bg-surface-2">
              <Hash aria-hidden="true" className="size-5" />
            </button>
            <button type="button" onClick={() => insert("@")} aria-label="Mention someone" className="flex size-11 items-center justify-center rounded-full text-fg-muted hover:bg-surface-2">
              <AtSign aria-hidden="true" className="size-5" />
            </button>
          </div>
          <p className="flex items-center gap-1 text-tiny text-fg-subtle">
            <Lock aria-hidden="true" className="size-3" />
            Only {audience?.description ?? "your audience"} can see this
          </p>
        </div>

        {!online ? (
          <p className="mt-3 rounded-card border border-warning/30 bg-warning-soft px-3 py-2 text-small text-warning">
            You&apos;re offline. This post will join your outbox and send when you reconnect.
          </p>
        ) : null}
        {error ? <p role="alert" className="mt-3 rounded-card border border-danger/30 bg-danger-soft px-3 py-2 text-small text-danger">{error}</p> : null}

        <p className="mt-4 text-center text-tiny leading-relaxed text-fg-subtle">
          Be kind. Posts are visible only to the audience you pick, and moderators can review reported content.
        </p>
      </main>

      <BottomSheet open={audienceOpen} onClose={() => setAudienceOpen(false)} title="Who can see this?" description="You can only choose audiences along your own path.">
        <div className="space-y-1.5 pb-4">
          {audiences.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => { setAudienceId(option.id); setAudienceOpen(false); }}
              className={cn(
                "flex min-h-14 w-full items-center gap-3 rounded-card border px-3 py-2.5 text-left transition",
                audienceId === option.id ? "border-accent bg-accent-soft" : "border-border hover:bg-surface-2",
              )}
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface text-accent">
                {option.scope === "university" ? <Users aria-hidden="true" className="size-4" /> : <Lock aria-hidden="true" className="size-4" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-small font-semibold text-fg">{option.label}</span>
                <span className="block truncate text-tiny text-fg-subtle">{option.description}</span>
              </span>
              {audienceId === option.id ? <Check aria-hidden="true" className="size-5 shrink-0 text-accent" /> : null}
            </button>
          ))}
        </div>
        <p className="pb-2 text-tiny text-fg-subtle">A repost always keeps the original audience, so it can never widen who sees it.</p>
      </BottomSheet>
    </div>
  );
}
