"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarClock, FileText, Paperclip, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/auth/auth-shell";
import { apiPatch, apiPost, csrfToken } from "@/lib/posts/client";
import { fromDatetimeLocalValue, toDatetimeLocalValue } from "@/lib/domain/event-display";
import { ANNOUNCEMENT_CATEGORIES, MAX_ANNOUNCEMENT_BODY, MAX_ANNOUNCEMENT_TITLE, type AnnouncementCategory } from "@/lib/domain/announcements";
import type { EventAudienceOption } from "@/lib/services/event-options";
import type { SerializedAnnouncement } from "@/lib/services/announcements";

type Attachment = { fileKey: string; name: string; mimeType: string; sizeBytes: number };
type PublishMode = "now" | "schedule" | "draft";

export function AnnouncementComposer({
  mode,
  accounts,
  audiences,
  timezone,
  announcement,
}: {
  mode: "create" | "edit";
  accounts: Array<{ id: string; name: string; slug: string; canCritical: boolean }>;
  audiences: EventAudienceOption[];
  timezone: string;
  announcement?: SerializedAnnouncement;
}) {
  const router = useRouter();
  const [accountId, setAccountId] = useState(announcement?.officialAccount.id ?? accounts[0]?.id ?? "");
  const [title, setTitle] = useState(announcement?.title ?? "");
  const [body, setBody] = useState(announcement?.body ?? "");
  const [category, setCategory] = useState<AnnouncementCategory>((announcement?.category as AnnouncementCategory | undefined) ?? "GENERAL");
  const [critical, setCritical] = useState(announcement?.critical ?? false);
  const defaultAudience = announcement
    ? audiences.find((option) => option.kind === announcement.audienceKind && option.path.join("/") === announcement.audiencePath.join("/"))?.id
    : undefined;
  const [audienceId, setAudienceId] = useState(defaultAudience ?? audiences[0]?.id ?? "university");
  const [publishMode, setPublishMode] = useState<PublishMode>("now");
  const [publishAt, setPublishAt] = useState(() => {
    const next = new Date(Date.now() + 60 * 60 * 1000);
    next.setMinutes(0, 0, 0);
    return toDatetimeLocalValue(next, timezone);
  });
  const [attachments, setAttachments] = useState<Attachment[]>(
    announcement?.attachments.map((attachment) => ({
      fileKey: "",
      name: attachment.name,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
    })) ?? [],
  );
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const account = accounts.find((entry) => entry.id === accountId);
  const audience = audiences.find((entry) => entry.id === audienceId) ?? audiences[0];
  const canCritical = mode === "edit" ? true : Boolean(account?.canCritical);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (attachments.length >= 3) {
      setError("Attach at most 3 PDFs.");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/announcements/attachments", {
        method: "POST",
        headers: { "x-konnekt-csrf": csrfToken() },
        body: form,
      });
      const data = (await response.json().catch(() => ({}))) as Attachment & { error?: string };
      if (!response.ok || !data.fileKey) throw new Error(data.error ?? "Couldn't upload that PDF.");
      setAttachments((current) => [...current, data]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't upload that PDF.");
    } finally {
      setUploading(false);
    }
  };

  const submit = async (formEvent: React.FormEvent) => {
    formEvent.preventDefault();
    setError(null);
    if (!audience) {
      setError("Choose an audience.");
      return;
    }
    const payload = {
      officialAccountId: accountId,
      title: title.trim(),
      body: body.trim(),
      category,
      critical,
      audienceKind: audience.kind,
      audiencePath: audience.path,
      publishNow: publishMode === "now",
      saveDraft: publishMode === "draft",
      publishAt: fromDatetimeLocalValue(publishAt, timezone)?.toISOString(),
      attachments: attachments.filter((attachment) => attachment.fileKey),
    };
    setBusy(true);
    try {
      if (mode === "edit" && announcement) {
        await apiPatch(`/api/announcements/${announcement.id}`, payload);
        router.push(`/official/a/${announcement.id}`);
      } else {
        if (!account) throw new Error("Choose an official account.");
        const result = await apiPost<{ id: string }>(`/api/official/${encodeURIComponent(account.slug)}/announcements`, payload);
        router.push(`/official/a/${result.id}`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the announcement.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5 pb-12">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-h1 text-fg">{mode === "create" ? "New announcement" : "Edit announcement"}</h1>
          <p className="mt-1 text-small text-fg-muted">
            {critical ? "Critical notices stay on Pulse until every student acknowledges them." : "Published by a verified official account."}
          </p>
        </div>
        <Link href="/official" className="mt-1 text-small font-semibold text-fg-muted underline underline-offset-4">
          Cancel
        </Link>
      </header>

      <div>
        <label htmlFor="announcement-account" className="text-small font-semibold text-fg">
          Official account
        </label>
        <select
          id="announcement-account"
          value={accountId}
          onChange={(change) => {
            setAccountId(change.target.value);
            const next = accounts.find((entry) => entry.id === change.target.value);
            if (!next?.canCritical) setCritical(false);
          }}
          disabled={mode === "edit"}
          className="mt-1 min-h-11 w-full rounded-button border border-border bg-surface px-3 text-small text-fg disabled:opacity-60"
        >
          {accounts.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="announcement-title" className="text-small font-semibold text-fg">
          Title
        </label>
        <input
          id="announcement-title"
          value={title}
          onChange={(change) => setTitle(change.target.value)}
          required
          maxLength={MAX_ANNOUNCEMENT_TITLE}
          className="mt-1 min-h-11 w-full rounded-button border border-border bg-surface px-3 text-small text-fg"
        />
      </div>

      <div>
        <label htmlFor="announcement-body" className="text-small font-semibold text-fg">
          Notice
        </label>
        <textarea
          id="announcement-body"
          value={body}
          onChange={(change) => setBody(change.target.value)}
          required
          rows={8}
          maxLength={MAX_ANNOUNCEMENT_BODY}
          placeholder="What do students need to know?"
          className="mt-1 w-full rounded-button border border-border bg-surface px-3 py-2 text-small text-fg"
        />
        <p className="mt-1 text-right text-tiny text-fg-subtle">
          {body.length}/{MAX_ANNOUNCEMENT_BODY}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="announcement-category" className="text-small font-semibold text-fg">
            Category
          </label>
          <select
            id="announcement-category"
            value={category}
            onChange={(change) => setCategory(change.target.value as AnnouncementCategory)}
            className="mt-1 min-h-11 w-full rounded-button border border-border bg-surface px-3 text-small text-fg"
          >
            {ANNOUNCEMENT_CATEGORIES.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="announcement-audience" className="text-small font-semibold text-fg">
            Audience
          </label>
          <select
            id="announcement-audience"
            value={audienceId}
            onChange={(change) => setAudienceId(change.target.value)}
            className="mt-1 min-h-11 w-full rounded-button border border-border bg-surface px-3 text-small text-fg"
          >
            {audiences.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {canCritical ? (
        <label className="flex items-start gap-2 rounded-card border border-highlight/50 bg-highlight-soft/40 p-3 text-small text-fg">
          <input type="checkbox" checked={critical} onChange={(change) => setCritical(change.target.checked)} className="mt-0.5 size-5 accent-[var(--highlight)]" />
          <span>
            <span className="flex items-center gap-1 font-semibold">
              <AlertTriangle aria-hidden="true" className="size-4 text-highlight-fg" />
              Critical announcement
            </span>
            <span className="mt-0.5 block text-tiny text-fg-muted">
              Shows a persistent banner on Pulse until each student acknowledges. Maximum 2 per account per day.
            </span>
          </span>
        </label>
      ) : null}

      <fieldset>
        <legend className="text-small font-semibold text-fg">Attachments</legend>
        <p className="text-tiny text-fg-subtle">Up to 3 PDFs, 10 MB each. Total attachments are capped by the server.</p>
        <ul className="mt-2 space-y-2">
          {attachments.map((attachment, index) => (
            <li key={`${attachment.name}-${index}`} className="flex items-center gap-2 rounded-button border border-border bg-surface p-2">
              <FileText aria-hidden="true" className="size-4 shrink-0 text-accent-ink" />
              <span className="min-w-0 flex-1 truncate text-small text-fg">{attachment.name}</span>
              <span className="text-tiny text-fg-subtle">{(attachment.sizeBytes / (1024 * 1024)).toFixed(1)} MB</span>
              <button
                type="button"
                onClick={() => setAttachments((current) => current.filter((_, position) => position !== index))}
                aria-label={`Remove ${attachment.name}`}
                className="inline-flex size-8 items-center justify-center rounded-full text-fg-muted hover:bg-surface-2"
              >
                <Trash2 aria-hidden="true" className="size-4" />
              </button>
            </li>
          ))}
        </ul>
        {mode === "create" ? (
          <label className="mt-2 inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-button border border-border px-3 text-small font-semibold text-fg hover:bg-surface-2">
            <Paperclip aria-hidden="true" className="size-4" />
            {uploading ? "Uploading…" : "Attach a PDF"}
            <input
              type="file"
              accept="application/pdf"
              className="sr-only"
              onChange={(change) => {
                void upload(change.target.files?.[0]);
                change.target.value = "";
              }}
            />
          </label>
        ) : null}
      </fieldset>

      <fieldset>
        <legend className="text-small font-semibold text-fg">Publishing</legend>
        <div className="mt-2 space-y-2">
          {(
            [
              { value: "now", label: "Publish now" },
              { value: "schedule", label: "Schedule for later (up to 30 days)" },
              { value: "draft", label: "Save as draft" },
            ] as const
          ).map((option) => (
            <label key={option.value} className="flex min-h-10 items-center gap-2 text-small text-fg">
              <input
                type="radio"
                name="publish-mode"
                value={option.value}
                checked={publishMode === option.value}
                onChange={() => setPublishMode(option.value)}
                className="size-4 accent-[var(--accent)]"
              />
              {option.label}
            </label>
          ))}
        </div>
        {publishMode === "schedule" ? (
          <div className="mt-2">
            <label htmlFor="announcement-publish-at" className="flex items-center gap-1 text-small font-semibold text-fg">
              <CalendarClock aria-hidden="true" className="size-4" />
              Publish at ({timezone.replace(/_/g, " ")})
            </label>
            <input
              id="announcement-publish-at"
              type="datetime-local"
              value={publishAt}
              onChange={(change) => setPublishAt(change.target.value)}
              className="mt-1 min-h-11 w-full rounded-button border border-border bg-surface px-3 text-small text-fg"
            />
          </div>
        ) : null}
      </fieldset>

      <FormMessage error={error} message={null} />
      <Button type="submit" loading={busy} className="w-full sm:w-auto">
        {publishMode === "draft" ? "Save draft" : publishMode === "schedule" ? "Schedule announcement" : mode === "edit" ? "Save changes" : "Publish announcement"}
      </Button>
    </form>
  );
}
