"use client";

import { useActionState, useState } from "react";
import { AlertCircle, Check, ImagePlus, Loader2, ShieldCheck } from "lucide-react";
import { universitySettingsAction } from "@/app/admin/actions";
import { emptyFormState } from "@/lib/action-state";
import { checkAccentContrast, readableOn } from "@/lib/domain/color";
import { Button } from "@/components/ui/button";
import type { UniversitySettings } from "@/lib/services/admin";

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1] ?? "") : null;
}

export function UniversitySettingsForm({ settings }: { settings: UniversitySettings }) {
  const [state, formAction, pending] = useActionState(universitySettingsAction, emptyFormState);
  const [accent, setAccent] = useState(settings.accentColor);
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pattern, setPattern] = useState(settings.matricPattern);
  const [matricProbe, setMatricProbe] = useState("");
  const contrast = checkAccentContrast(accent);

  let patternValid = true;
  let probeMatches = false;
  try {
    const regex = new RegExp(pattern);
    probeMatches = regex.test(matricProbe);
  } catch {
    patternValid = false;
  }

  const uploadLogo = async (file: File) => {
    setUploading(true);
    setUploadError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const csrf = readCookie("konnekt_csrf");
      const response = await fetch("/api/admin/university/logo", {
        method: "POST",
        body,
        headers: csrf ? { "x-konnekt-csrf": csrf } : undefined,
      });
      const payload = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !payload.url) throw new Error(payload.error ?? "Upload failed.");
      setLogoUrl(payload.url);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <form action={formAction} className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
      <div className="space-y-4">
        <section className="rounded-card border border-border bg-surface p-4">
          <h2 className="text-h3 text-fg">Identity</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="uni-name" className="mb-1 block text-small font-semibold text-fg">University name</label>
              <input id="uni-name" name="name" defaultValue={settings.name} required maxLength={120} className="h-10 w-full rounded-input border border-border bg-surface px-3 text-small" />
            </div>
            <div>
              <label htmlFor="uni-short" className="mb-1 block text-small font-semibold text-fg">Short name</label>
              <input id="uni-short" name="shortName" defaultValue={settings.shortName} required maxLength={24} className="h-10 w-full rounded-input border border-border bg-surface px-3 text-small" />
            </div>
            <div>
              <label htmlFor="uni-accent" className="mb-1 block text-small font-semibold text-fg">Accent colour</label>
              <div className="flex gap-2">
                <input
                  id="uni-accent"
                  name="accentColor"
                  value={accent}
                  onChange={(event) => setAccent(event.target.value)}
                  required
                  pattern="^#[0-9a-fA-F]{6}$"
                  className="h-10 min-w-0 flex-1 rounded-input border border-border bg-surface px-3 font-mono text-small"
                />
                <input
                  type="color"
                  value={/^#[0-9a-fA-F]{6}$/.test(accent) ? accent : "#1B7F5A"}
                  onChange={(event) => setAccent(event.target.value)}
                  aria-label="Pick accent colour"
                  className="h-10 w-12 cursor-pointer rounded-input border border-border bg-surface p-1"
                />
              </div>
            </div>
          </div>

          <div className="mt-3">
            <p className="mb-1 text-small font-semibold text-fg">Contrast check</p>
            <div className="rounded-input border border-border bg-surface-2 p-2.5">
              <div className="flex flex-wrap gap-2 text-[0.75rem]">
                <span className="rounded-chip bg-surface px-2 py-1">On white {contrast.onWhite}:1</span>
                <span className="rounded-chip bg-surface px-2 py-1">On dark {contrast.onDark}:1</span>
                <span className="rounded-chip bg-surface px-2 py-1">Text on accent {contrast.primaryButton}:1</span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="rounded-button px-3 py-1.5 text-[0.75rem] font-bold" style={{ background: accent, color: readableOn(accent) }}>
                  Preview button
                </span>
                {contrast.passes ? (
                  <span className="flex items-center gap-1 text-[0.75rem] font-semibold text-success">
                    <Check aria-hidden="true" className="size-3.5" /> Passes WCAG AA
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[0.75rem] font-semibold text-danger">
                    <AlertCircle aria-hidden="true" className="size-3.5" /> Fix the contrast
                  </span>
                )}
              </div>
              {!contrast.passes ? (
                <ul className="mt-1.5 space-y-0.5 text-[0.6875rem] text-fg-muted">
                  {contrast.messages.map((message) => <li key={message}>{message}</li>)}
                </ul>
              ) : null}
            </div>
          </div>

          <div className="mt-4">
            <p className="mb-1 text-small font-semibold text-fg">Logo</p>
            <div className="flex items-center gap-3">
              <span className="flex size-14 items-center justify-center overflow-hidden rounded-[14px] border border-border bg-surface-2">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt="Current university logo" className="size-full object-contain" />
                ) : (
                  <ImagePlus aria-hidden="true" className="size-5 text-fg-subtle" />
                )}
              </span>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-button border border-border px-3 py-2 text-small font-semibold text-fg hover:bg-surface-2">
                {uploading ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <ImagePlus aria-hidden="true" className="size-4" />}
                {logoUrl ? "Replace logo" : "Upload logo"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  disabled={uploading}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadLogo(file);
                  }}
                />
              </label>
              {logoUrl ? (
                <button
                  type="button"
                  onClick={() => setLogoUrl(null)}
                  className="text-small font-semibold text-danger hover:underline"
                >
                  Remove
                </button>
              ) : null}
            </div>
            <input type="hidden" name="logoUrl" value={logoUrl ?? ""} />
            {uploadError ? <p role="alert" className="mt-1 text-small text-danger">{uploadError}</p> : null}
          </div>
        </section>

        <section className="rounded-card border border-border bg-surface p-4">
          <h2 className="text-h3 text-fg">Verification</h2>
          <div className="mt-3 space-y-3">
            <label className="flex items-start justify-between gap-4">
              <span>
                <span className="block text-small font-semibold text-fg">Student email</span>
                <span className="block text-[0.75rem] text-fg-muted">
                  Always on when domains are configured. Add your student email domains below.
                </span>
              </span>
              <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-accent" />
            </label>
            <div>
              <label htmlFor="uni-domains" className="mb-1 block text-small font-semibold text-fg">Student email domains</label>
              <input
                id="uni-domains"
                name="studentEmailDomains"
                defaultValue={settings.studentEmailDomains.join(", ")}
                placeholder="student.demo.edu.ng, demo.edu.ng"
                className="h-10 w-full rounded-input border border-border bg-surface px-3 text-small"
              />
              <p className="mt-1 text-[0.75rem] text-fg-subtle">Comma or space separated. Only these addresses can auto-verify.</p>
            </div>
            <label className="flex items-center justify-between gap-4 rounded-input border border-border px-3 py-2">
              <span>
                <span className="block text-small font-semibold text-fg">ID card review</span>
                <span className="block text-[0.75rem] text-fg-muted">Manual review with a private image.</span>
              </span>
              <input type="checkbox" name="idCardEnabled" defaultChecked={settings.idCardEnabled} className="size-4 accent-[var(--accent)]" />
            </label>
            <label className="flex items-center justify-between gap-4 rounded-input border border-border px-3 py-2">
              <span>
                <span className="block text-small font-semibold text-fg">Vouching</span>
                <span className="block text-[0.75rem] text-fg-muted">Let reviewers vouch for students they know.</span>
              </span>
              <input type="checkbox" name="vouchingEnabled" defaultChecked={settings.vouchingEnabled} className="size-4 accent-[var(--accent)]" />
            </label>
            <div>
              <label htmlFor="uni-pattern" className="mb-1 block text-small font-semibold text-fg">Matric number pattern</label>
              <input
                id="uni-pattern"
                name="matricPattern"
                value={pattern}
                onChange={(event) => setPattern(event.target.value)}
                required
                className="h-10 w-full rounded-input border border-border bg-surface px-3 font-mono text-[0.75rem]"
              />
              <div className="mt-2 flex items-center gap-2">
                <input
                  aria-label="Test a matric number"
                  value={matricProbe}
                  onChange={(event) => setMatricProbe(event.target.value)}
                  placeholder="Test a matric number"
                  className="h-9 min-w-0 flex-1 rounded-input border border-border bg-surface px-3 font-mono text-[0.75rem]"
                />
                <span className={`text-[0.75rem] font-semibold ${!patternValid ? "text-danger" : probeMatches ? "text-success" : "text-fg-subtle"}`}>
                  {!patternValid ? "Invalid regex" : !matricProbe ? "Try a real one" : probeMatches ? "Matches" : "No match"}
                </span>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="space-y-4">
        <section className="rounded-card border border-border bg-surface p-4">
          <h2 className="text-h3 text-fg">Labels</h2>
          <p className="mt-1 text-small text-fg-muted">Match your university&apos;s language.</p>
          <div className="mt-3 space-y-3">
            <div>
              <label htmlFor="label-college" className="mb-1 block text-small font-semibold text-fg">Top layer</label>
              <input id="label-college" name="labelCollege" defaultValue={settings.labels.college} maxLength={24} className="h-10 w-full rounded-input border border-border bg-surface px-3 text-small" />
            </div>
            <div>
              <label htmlFor="label-faculty" className="mb-1 block text-small font-semibold text-fg">Middle layer</label>
              <input id="label-faculty" name="labelFaculty" defaultValue={settings.labels.faculty} maxLength={24} className="h-10 w-full rounded-input border border-border bg-surface px-3 text-small" />
            </div>
            <div>
              <label htmlFor="label-department" className="mb-1 block text-small font-semibold text-fg">Department layer</label>
              <input id="label-department" name="labelDepartment" defaultValue={settings.labels.department} maxLength={24} className="h-10 w-full rounded-input border border-border bg-surface px-3 text-small" />
            </div>
          </div>
        </section>

        <section className="rounded-card border border-border bg-surface p-4">
          <h2 className="text-h3 text-fg">Public page</h2>
          <p className="mt-1 text-small text-fg-muted">Students find this university at</p>
          <p className="mt-2 break-all rounded-input bg-surface-2 px-3 py-2 font-mono text-[0.75rem] text-fg">/signup/{settings.slug}</p>
          <p className="mt-2 text-[0.75rem] text-fg-subtle">The slug is permanent; contact the platform team to change it.</p>
        </section>

        {state.error ? (
          <p role="alert" className="flex items-start gap-2 rounded-input border border-danger/30 bg-danger-soft px-3 py-2 text-small text-danger">
            <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> {state.error}
          </p>
        ) : null}
        {state.ok ? (
          <p role="status" className="flex items-center gap-2 rounded-input border border-success/30 bg-success-soft px-3 py-2 text-small font-semibold text-success">
            <Check aria-hidden="true" className="size-4" /> {state.message}
          </p>
        ) : null}
        <Button type="submit" loading={pending} fullWidth disabled={!contrast.passes || !patternValid || uploading}>
          Save university settings
        </Button>
        <p className="text-center text-[0.6875rem] text-fg-subtle">
          Accent and logo changes apply across the student app immediately.
        </p>
      </div>
    </form>
  );
}
