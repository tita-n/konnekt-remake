"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Clock3, Globe2, ImagePlus, Loader2, Lock, Plus, ShieldCheck, Trash2, Users } from "lucide-react";
import {
  COMMUNITY_CATEGORIES,
  COMMUNITY_PRIVACY_DESCRIPTIONS,
  COMMUNITY_RULE_TEMPLATES,
  MAX_COMMUNITY_RULES,
  type CommunityCategory,
  type CommunityPrivacy,
} from "@/lib/domain/community";
import { apiGet, apiPost } from "@/lib/posts/client";
import { uploadPostImage } from "@/lib/client/post-image";
import { Button } from "@/components/ui/button";
import { TextArea, TextField, SelectField } from "@/components/ui/form-controls";
import { cn } from "@/lib/utils";
import type { CommunityCardView } from "@/lib/communities/types";
import { CommunityCard } from "./community-card";

const PRIVACY_OPTIONS: Array<{ value: CommunityPrivacy; label: string; icon: typeof Globe2 }> = [
  { value: "PUBLIC", label: "Public", icon: Globe2 },
  { value: "REQUEST", label: "Request to join", icon: Clock3 },
  { value: "INVITE_ONLY", label: "Invite only", icon: Lock },
];

/** One 4px accent bar that fills as the required parts of the form are ready. */
function FormProgress({ ready, total }: { ready: number; total: number }) {
  const percent = Math.round((ready / total) * 100);
  return (
    <div className="h-1 w-full bg-surface-2" aria-hidden="true">
      <span
        className="block h-full bg-accent transition-[width] duration-200 ease-out"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

function FormSection({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="rounded-card border border-border bg-surface p-4">
      <h2 id={id} className="font-display text-h1 font-bold text-fg">
        {title}
      </h2>
      {description ? <p className="mt-0.5 text-small text-fg-muted">{description}</p> : null}
      <div className={description ? "mt-3.5" : "mt-3"}>{children}</div>
    </section>
  );
}

interface NameState {
  checking: boolean;
  available: boolean | null;
  message: string | null;
}

export function NewCommunityForm() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<CommunityCategory>("ACADEMIC");
  const [privacy, setPrivacy] = useState<CommunityPrivacy>("PUBLIC");
  const [allowMemberUploads, setAllowMemberUploads] = useState(false);
  const [icon, setIcon] = useState<{ publicId: string; url: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [rules, setRules] = useState(COMMUNITY_RULE_TEMPLATES.slice(0, 3).map((rule) => ({ ...rule })));
  const [nameState, setNameState] = useState<NameState>({ checking: false, available: null, message: null });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formReady = [
    name.trim().length >= 3,
    description.trim().length >= 5,
    rules.some((rule) => rule.title.trim() && rule.body.trim()),
    Boolean(icon),
  ].filter(Boolean).length;

  useEffect(() => {
    if (name.trim().length < 3) {
      setNameState({ checking: false, available: null, message: null });
      return;
    }
    setNameState((state) => ({ ...state, checking: true }));
    const timer = window.setTimeout(async () => {
      try {
        const { data } = await apiGet<{ available: boolean; message: string | null }>(
          `/api/communities/name?name=${encodeURIComponent(name.trim())}`,
        );
        setNameState({ checking: false, available: data.available, message: data.message });
      } catch {
        setNameState({ checking: false, available: null, message: null });
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [name]);

  async function uploadIcon(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const uploaded = await uploadPostImage(file);
      setIcon({ publicId: uploaded.publicId, url: uploaded.url });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't upload that image.");
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    setError(null);
    if (nameState.available === false) {
      setError(nameState.message ?? "That name isn't available.");
      return;
    }
    if (name.trim().length < 3) {
      setError("Give your community a name of at least 3 characters.");
      return;
    }
    if (description.trim().length < 5) {
      setError("Add a short description so people know what this is for.");
      return;
    }
    const cleanedRules = rules.map((rule) => ({ title: rule.title.trim(), body: rule.body.trim() })).filter((rule) => rule.title && rule.body);
    setSubmitting(true);
    try {
      const result = await apiPost<{ id: string; slug: string }>("/api/communities", {
        name: name.trim(),
        description: description.trim(),
        category,
        privacy,
        allowMemberUploads,
        iconPublicId: icon?.publicId,
        rules: cleanedRules,
      });
      router.push(`/c/${result.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create that community.");
      setSubmitting(false);
    }
  }

  const previewCommunity: CommunityCardView = {
    id: "preview",
    name: name.trim() || "Your community name",
    slug: "preview",
    description: description.trim() || "Tell students what this space is for and who should join.",
    category,
    privacy,
    status: "ACTIVE",
    isOfficial: false,
    iconUrl: icon?.url ?? null,
    bannerUrl: null,
    memberCount: 1,
    postCount: 0,
    recentActivity: null,
    viewer: {
      joinState: privacy === "REQUEST" ? "CAN_REQUEST" : privacy === "INVITE_ONLY" ? "INVITE_REQUIRED" : "CAN_JOIN",
      isMember: false,
      role: null,
      pendingRequest: false,
      hasInvite: false,
      muted: false,
      canModerate: false,
      canManage: false,
    },
  };

  return (
    <div className="min-h-dvh bg-surface text-fg">
      <header className="sticky top-0 z-40 border-b border-border bg-surface">
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-2 px-3">
          <Link href="/communities" aria-label="Close" className="flex size-11 items-center justify-center rounded-full text-fg hover:bg-surface-2">
            <ArrowLeft aria-hidden="true" className="size-5" />
          </Link>
          <h1 className="flex-1 text-center font-display text-[1.0625rem] font-bold">New community</h1>
          <span className="size-11" aria-hidden="true" />
        </div>
        <FormProgress ready={formReady} total={4} />
      </header>

      <main className="mx-auto w-full max-w-2xl space-y-4 px-4 pb-28 pt-4">
        <FormSection id="icon-title" title="Icon and cover" description="Optional — a clay default is generated from the name.">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-[20px] border border-dashed border-border-strong bg-surface text-fg-subtle transition hover:border-accent"
              aria-label="Upload community icon"
            >
              {icon ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={icon.url} alt="" className="size-full object-cover" />
              ) : uploading ? (
                <Loader2 aria-hidden="true" className="size-5 animate-spin" />
              ) : (
                <ImagePlus aria-hidden="true" className="size-6" />
              )}
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              aria-label="Community icon file"
              className="sr-only"
              onChange={(event) => void uploadIcon(event.target.files?.[0])}
            />
            <div>
              <p className="text-small font-semibold text-fg">Community icon</p>
              <p className="text-tiny text-fg-muted">Optional. Square images look best.</p>
              {icon ? (
                <button type="button" className="mt-1 text-tiny font-semibold text-danger" onClick={() => setIcon(null)}>
                  Remove
                </button>
              ) : null}
            </div>
          </div>
        </FormSection>

        <FormSection id="basics-title" title="Basics" description="What people see in Discover and on your community page.">
          <div className="space-y-4">
            <TextField
              label="Community name"
          required
          value={name}
          onChange={(event) => setName(event.target.value.slice(0, 40))}
          placeholder="e.g. Software Engineering Class of 2028"
          hint="Official, SUG and university names are reserved for verified official communities."
              error={nameState.available === false ? nameState.message : null}
              trailing={
                nameState.checking ? (
                  <Loader2 aria-hidden="true" className="mr-2 size-4 animate-spin text-fg-subtle" />
                ) : nameState.available ? (
                  <Check aria-hidden="true" className="mr-2 size-4 text-success" />
                ) : null
              }
            />

            <TextArea
              label="Description"
              required
              value={description}
              onChange={(event) => setDescription(event.target.value.slice(0, 500))}
              placeholder="What is this community for, and who should join?"
              hint={`${description.length}/500`}
              rows={4}
            />

            <SelectField
              label="Category"
              value={category}
              onChange={(event) => setCategory(event.target.value as CommunityCategory)}
              options={COMMUNITY_CATEGORIES.map((entry) => ({ value: entry.value, label: entry.label }))}
            />
          </div>
        </FormSection>

        <FormSection id="privacy-title" title="Who can join?" description="You can change this later in community settings.">
          <fieldset>
            <legend className="sr-only">Who can join this community?</legend>
            <div className="space-y-2">
              {PRIVACY_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={cn(
                    "flex min-h-[72px] cursor-pointer items-center gap-3 rounded-[14px] border p-3.5 transition-colors duration-150",
                    privacy === option.value ? "border-accent bg-accent-soft" : "border-border bg-surface hover:bg-surface-2",
                  )}
                >
                  <input
                    type="radio"
                    name="privacy"
                    value={option.value}
                    checked={privacy === option.value}
                    onChange={() => setPrivacy(option.value)}
                    className="size-4 shrink-0 accent-[var(--accent)]"
                  />
                  <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-[10px]", privacy === option.value ? "accent-tile" : "neutral-tile")}>
                    <option.icon aria-hidden="true" className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-small font-bold text-fg">{option.label}</span>
                    <span className="mt-0.5 block text-tiny leading-relaxed text-fg-muted">
                      {COMMUNITY_PRIVACY_DESCRIPTIONS[option.value]}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </FormSection>

        <label className="flex items-start gap-3 rounded-card border border-border bg-surface p-4">
          <input
            type="checkbox"
            checked={allowMemberUploads}
            onChange={(event) => setAllowMemberUploads(event.target.checked)}
            className="mt-1 size-4 accent-[var(--accent)]"
          />
          <span>
            <span className="block text-small font-semibold text-fg">Let members add resources</span>
            <span className="mt-0.5 block text-tiny text-fg-muted">
              Moderators can always upload. Turn this on if members can share files and links too.
            </span>
          </span>
        </label>

        <section>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-[0.9375rem] font-semibold text-fg">Community rules</h2>
              <p className="mt-0.5 text-tiny text-fg-muted">Shown on the About tab. You can edit these later.</p>
            </div>
            <span className="text-tiny text-fg-subtle">{rules.length}/{MAX_COMMUNITY_RULES}</span>
          </div>
          <div className="mt-2 space-y-2.5">
            {rules.map((rule, index) => (
              <div key={index} className="rounded-card border border-border bg-surface p-3">
                <div className="flex items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-full bg-accent-soft text-tiny font-bold text-accent-ink">
                    {index + 1}
                  </span>
                  <input
                    value={rule.title}
                    onChange={(event) =>
                      setRules((current) => current.map((item, i) => (i === index ? { ...item, title: event.target.value.slice(0, 60) } : item)))
                    }
                    placeholder="Rule title"
                    aria-label={`Rule ${index + 1} title`}
                    className="min-w-0 flex-1 bg-transparent text-small font-semibold text-fg outline-none placeholder:text-fg-subtle"
                  />
                  <button
                    type="button"
                    aria-label={`Remove rule ${index + 1}`}
                    onClick={() => setRules((current) => current.filter((_, i) => i !== index))}
                    className="flex -m-1.5 size-11 items-center justify-center rounded-full text-fg-subtle hover:bg-surface-2 hover:text-danger"
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                  </button>
                </div>
                <textarea
                  value={rule.body}
                  onChange={(event) =>
                    setRules((current) => current.map((item, i) => (i === index ? { ...item, body: event.target.value.slice(0, 300) } : item)))
                  }
                  placeholder="Explain the rule"
                  aria-label={`Rule ${index + 1} description`}
                  rows={2}
                  className="mt-1.5 w-full resize-none bg-transparent text-small text-fg-muted outline-none placeholder:text-fg-subtle"
                />
              </div>
            ))}
          </div>
          {rules.length < MAX_COMMUNITY_RULES ? (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2"
              leftIcon={<Plus className="size-4" />}
              onClick={() => setRules((current) => [...current, { title: "", body: "" }])}
            >
              Add a rule
            </Button>
          ) : null}
        </section>

        <FormSection id="preview-title" title="Preview" description="This is how your community appears in Discover.">
          <div className="pointer-events-none select-none" inert>
            <CommunityCard community={previewCommunity} />
          </div>
        </FormSection>

        <div className="rounded-card accent-tile p-3.5 text-small text-accent-soft-fg">
          <p className="flex items-center gap-1.5 font-semibold">
            <ShieldCheck aria-hidden="true" className="size-4" />
            Built for one university
          </p>
          <p className="mt-1 text-tiny leading-relaxed">
            Every member is a verified student here. Names, joins and moderation actions are audited.
          </p>
        </div>

        {error ? (
          <p role="alert" className="rounded-card border border-danger/30 bg-danger-soft px-3.5 py-3 text-small font-medium text-danger">
            {error}
          </p>
        ) : null}
      </main>

      <div className="action-bar action-bar-fixed">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <Button fullWidth size="lg" loading={submitting} onClick={() => void submit()} leftIcon={<Users className="size-4" />}>
            Create community
          </Button>
        </div>
      </div>
    </div>
  );
}
