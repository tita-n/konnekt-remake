"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ImageUp, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/form-controls";
import { FormMessage } from "./auth-shell";
import { ClientImageError, compressImage, formatBytes } from "@/lib/client/image";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=").slice(1).join("=")) : null;
}

export function IdCardForm({
  slug,
  matricPattern,
  matricExample,
}: {
  slug: string;
  matricPattern: string;
  matricExample: string;
}) {
  const router = useRouter();
  const [matric, setMatric] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [compressed, setCompressed] = useState<Blob | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [field, setField] = useState<string | null>(null);

  async function onPick(selected: File | null) {
    setError(null);
    setField(null);
    setCompressed(null);
    setFile(selected);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    if (!selected) return;

    setCompressing(true);
    try {
      const blob = await compressImage(selected);
      setCompressed(blob);
      setPreview(URL.createObjectURL(blob));
    } catch (err) {
      setError(err instanceof ClientImageError ? err.message : "We couldn't process that photo.");
      setFile(null);
    } finally {
      setCompressing(false);
    }
  }

  function matricLooksValid(): boolean {
    try {
      return new RegExp(matricPattern).test(matric.trim().toUpperCase().replace(/\s+/g, ""));
    } catch {
      return false;
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setField(null);
    if (!compressed) {
      setError("Choose a photo of your student ID first.");
      return;
    }
    if (!matricLooksValid()) {
      setError(`That matric number does not match this university's format (e.g. ${matricExample}).`);
      setField("matricNumber");
      return;
    }

    setSubmitting(true);
    try {
      const form = new FormData();
      form.append("file", new File([compressed], "id-card.jpg", { type: "image/jpeg" }));
      form.append("matricNumber", matric.trim());
      form.append("slug", slug);
      const csrf = readCookie("konnekt_signup_csrf");
      const response = await fetch("/api/signup/id-card", {
        method: "POST",
        body: form,
        headers: csrf ? { "x-konnekt-csrf": csrf } : undefined,
      });
      const data = (await response.json()) as { ok?: boolean; error?: string; field?: string };
      if (!response.ok || !data.ok) {
        setError(data.error ?? "Upload failed. Try again.");
        setField(data.field ?? null);
        return;
      }
      router.push(`/signup/${slug}/account`);
    } catch {
      setError("Your connection dropped. Check your network and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <TextField
        label="Matric number"
        name="matricNumber"
        required
        value={matric}
        onChange={(event) => setMatric(event.target.value)}
        placeholder={matricExample}
        autoCapitalize="characters"
        spellCheck={false}
        hint={`On your ID or registration slip, e.g. ${matricExample}.`}
        error={field === "matricNumber" ? error : null}
      />

      <div>
        <span className="mb-1.5 block text-small font-semibold text-fg">Photo of your ID</span>
        <label
          htmlFor="id-photo"
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-card border border-dashed border-border-strong bg-surface px-4 py-7 text-center transition hover:border-accent hover:bg-surface-2/50 focus-within:border-accent"
        >
          {compressing ? (
            <>
              <Loader2 aria-hidden="true" className="size-6 animate-spin text-accent" />
              <span className="text-small text-fg-muted">Compressing for your data…</span>
            </>
          ) : (
            <>
              <ImageUp aria-hidden="true" className="size-6 text-accent" />
              <span className="text-small font-semibold text-fg">
                {file ? "Choose a different photo" : "Take or choose a photo"}
              </span>
              <span className="max-w-xs text-tiny text-fg-subtle">
                JPEG, PNG or WebP · compressed under 400 KB · ID card or course registration slip
              </span>
            </>
          )}
          <input
            id="id-photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(event) => void onPick(event.target.files?.[0] ?? null)}
          />
        </label>
        {preview && compressed ? (
          <div className="mt-3 flex items-center gap-3 rounded-card border border-border bg-surface p-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Preview of your ID card" className="h-16 w-24 rounded-[8px] border border-border object-cover" />
            <div className="min-w-0 text-small">
              <p className="truncate font-medium text-fg">{file?.name}</p>
              <p className="text-fg-subtle">Compressed to {formatBytes(compressed.size)}</p>
            </div>
          </div>
        ) : null}
      </div>

      <div className="rounded-card bg-surface-2 px-3.5 py-3 text-small text-fg-muted">
        <p className="flex items-start gap-2">
          <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-accent" />
          <span>
            Only reviewers at this university can see this photo. It is deleted automatically once your request is
            approved or declined — we keep the decision, not the image.
          </span>
        </p>
      </div>

      <FormMessage error={error && !field ? error : null} />

      <Button type="submit" fullWidth loading={submitting || compressing} loadingLabel={submitting ? "Uploading…" : "Preparing…"}>
        Submit for review
      </Button>
      <p className="text-center text-tiny text-fg-subtle">
        Next you&apos;ll create your account. You can finish your profile while reviewers check your ID.
      </p>
    </form>
  );
}
