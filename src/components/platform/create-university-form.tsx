"use client";

import { useActionState, useState } from "react";
import { AlertCircle, Check, Plus } from "lucide-react";
import { createUniversityAction } from "@/app/platform/actions";
import { emptyFormState } from "@/lib/action-state";
import { checkAccentContrast, readableOn } from "@/lib/domain/color";
import { Button } from "@/components/ui/button";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);

export function CreateUniversityForm() {
  const [state, action, pending] = useActionState(createUniversityAction, emptyFormState);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [accent, setAccent] = useState("#147A57");
  const contrast = checkAccentContrast(accent);

  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="new-name" className="mb-1 block text-small font-semibold text-fg">University name</label>
          <input
            id="new-name"
            name="name"
            required
            maxLength={120}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (!slugTouched) setSlug(slugify(event.target.value));
            }}
            placeholder="e.g. Your University"
            className="h-10 w-full rounded-input border border-border bg-surface px-3 text-small"
          />
        </div>
        <div>
          <label htmlFor="new-short" className="mb-1 block text-small font-semibold text-fg">Short name</label>
          <input id="new-short" name="shortName" required maxLength={24} placeholder="UNILAG" className="h-10 w-full rounded-input border border-border bg-surface px-3 text-small" />
        </div>
        <div>
          <label htmlFor="new-slug" className="mb-1 block text-small font-semibold text-fg">URL slug</label>
          <input
            id="new-slug"
            name="slug"
            required
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            value={slug}
            onChange={(event) => { setSlugTouched(true); setSlug(slugify(event.target.value)); }}
            className="h-10 w-full rounded-input border border-border bg-surface px-3 font-mono text-[0.75rem]"
          />
          <p className="mt-1 text-[0.6875rem] text-fg-subtle">/signup/{slug || "your-university"}</p>
        </div>
        <div>
          <label htmlFor="new-accent" className="mb-1 block text-small font-semibold text-fg">Accent</label>
          <div className="flex gap-2">
            <input
              id="new-accent"
              name="accentColor"
              value={accent}
              onChange={(event) => setAccent(event.target.value)}
              pattern="^#[0-9a-fA-F]{6}$"
              required
              className="h-10 min-w-0 flex-1 rounded-input border border-border bg-surface px-3 font-mono text-small"
            />
            <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(accent) ? accent : "#147A57"} onChange={(event) => setAccent(event.target.value)} aria-label="Pick accent colour" className="h-10 w-12 rounded-input border border-border bg-surface p-1" />
          </div>
          <p className={`mt-1 flex items-center gap-1 text-[0.6875rem] font-semibold ${contrast.passes ? "text-success" : "text-danger"}`}>
            {contrast.passes ? <Check aria-hidden="true" className="size-3" /> : <AlertCircle aria-hidden="true" className="size-3" />}
            {contrast.passes ? "Passes WCAG AA" : "Fails contrast"}
          </p>
        </div>
        <div>
          <label htmlFor="new-matric" className="mb-1 block text-small font-semibold text-fg">Matric pattern</label>
          <input id="new-matric" name="matricPattern" required defaultValue="^[A-Z]{2,4}/\\d{4}/\\d{3,4}$" className="h-10 w-full rounded-input border border-border bg-surface px-3 font-mono text-[0.75rem]" />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="new-domains" className="mb-1 block text-small font-semibold text-fg">Student email domains</label>
          <input id="new-domains" name="studentEmailDomains" placeholder="student.unilag.edu.ng, unilag.edu.ng" className="h-10 w-full rounded-input border border-border bg-surface px-3 text-small" />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="new-admin" className="mb-1 block text-small font-semibold text-fg">First admin email <span className="font-normal text-fg-subtle">(optional)</span></label>
          <input id="new-admin" name="firstAdminEmail" type="email" placeholder="registrar@unilag.edu.ng" className="h-10 w-full rounded-input border border-border bg-surface px-3 text-small" />
          <p className="mt-1 text-[0.6875rem] text-fg-subtle">They&apos;ll get an invite link to accept after creating an account.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-small">
        <label className="flex items-center gap-2 font-semibold text-fg">
          <input type="checkbox" name="idCardEnabled" defaultChecked className="size-4 accent-[var(--accent)]" /> ID card review
        </label>
        <label className="flex items-center gap-2 font-semibold text-fg">
          <input type="checkbox" name="vouchingEnabled" className="size-4 accent-[var(--accent)]" /> Vouching
        </label>
      </div>

      <div className="rounded-input bg-surface-2 p-2 text-[0.75rem] text-fg-muted">
        Preview:{" "}
        <span className="rounded-button px-2 py-1 font-semibold" style={{ background: accent, color: readableOn(accent) }}>
          {name || "University"}
        </span>
      </div>

      {state.error ? (
        <p role="alert" className="flex items-start gap-2 text-small text-danger">
          <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p role="status" className="flex items-center gap-2 text-small font-semibold text-success">
          <Check aria-hidden="true" className="size-4" /> {state.message}
        </p>
      ) : null}
      <Button type="submit" loading={pending} disabled={!contrast.passes}>
        <Plus aria-hidden="true" className="size-4" /> Create and switch on
      </Button>
    </form>
  );
}
