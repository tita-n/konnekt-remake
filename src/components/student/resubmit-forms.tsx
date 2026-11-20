"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { ImageUp, Loader2, Users } from "lucide-react";
import type { Voucher } from "@/lib/services/vouchers";
import { requestVouchAgainAction } from "@/app/status/resubmit/actions";
import { emptyFormState } from "@/lib/action-state";
import { Button } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/form-controls";
import { SegmentedControl } from "@/components/ui/navigation";
import { FormMessage } from "@/components/auth/auth-shell";
import { ClientImageError, compressImage, formatBytes } from "@/lib/client/image";

function readCookie(name: string): string | null {
  const match = document.cookie.split("; ").find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=").slice(1).join("=")) : null;
}

export function ResubmitForms({
  idCardEnabled,
  vouchers,
  matricPattern,
  defaultMatric,
}: {
  idCardEnabled: boolean;
  vouchers: Voucher[];
  matricPattern: string;
  defaultMatric: string;
}) {
  const router = useRouter();
  const [method, setMethod] = useState<"ID_CARD" | "VOUCH">(idCardEnabled ? "ID_CARD" : "VOUCH");
  const [vouchState, vouchAction, vouchPending] = useActionState(requestVouchAgainAction, emptyFormState);

  const [matric, setMatric] = useState(defaultMatric);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setError(null);
    setCompressing(true);
    try {
      const compressed = await compressImage(file);
      setBlob(compressed);
      setFileName(file.name);
      if (preview) URL.revokeObjectURL(preview);
      setPreview(URL.createObjectURL(compressed));
    } catch (err) {
      setError(err instanceof ClientImageError ? err.message : "We couldn't read that photo.");
      setBlob(null);
    } finally {
      setCompressing(false);
    }
  }

  async function submitId(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!blob) {
      setError("Choose a photo of your student ID.");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", new File([blob], "id-card.jpg", { type: "image/jpeg" }));
      form.append("matricNumber", matric.trim());
      const csrf = readCookie("konnekt_csrf");
      const response = await fetch("/api/verification/id-card", {
        method: "POST",
        body: form,
        headers: csrf ? { "x-konnekt-csrf": csrf } : undefined,
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) {
        setError(data.error ?? "Upload failed. Try again.");
        return;
      }
      router.replace("/status");
      router.refresh();
    } catch {
      setError("Your connection dropped. Try again.");
    } finally {
      setUploading(false);
    }
  }

  const options = [
    ...(idCardEnabled ? [{ value: "ID_CARD" as const, label: "ID card" }] : []),
    ...(vouchers.length > 0 ? [{ value: "VOUCH" as const, label: "Vouch" }] : []),
  ];

  return (
    <div className="space-y-5">
      {options.length > 1 ? (
        <SegmentedControl label="Verification method" value={method} onChange={setMethod} options={options} />
      ) : (
        <input type="hidden" value={method} />
      )}

      {method === "ID_CARD" ? (
        <form onSubmit={submitId} className="space-y-4">
          <TextField
            label="Matric number"
            value={matric}
            onChange={(event) => setMatric(event.target.value)}
            required
            placeholder="CSC/2022/1041"
            autoCapitalize="characters"
            spellCheck={false}
          />
          <div>
            <span className="mb-1.5 block text-small font-semibold text-fg">Photo of your ID</span>
            <label
              htmlFor="resubmit-photo"
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-card border border-dashed border-border-strong bg-surface px-4 py-6 text-center transition hover:border-accent"
            >
              {compressing ? (
                <Loader2 aria-hidden="true" className="size-5 animate-spin text-accent-ink" />
              ) : (
                <ImageUp aria-hidden="true" className="size-5 text-accent-ink" />
              )}
              <span className="text-small font-semibold text-fg">
                {compressing ? "Compressing…" : blob ? "Choose a different photo" : "Choose a photo"}
              </span>
              <span className="text-tiny text-fg-subtle">Clear, well-lit, all four corners visible.</span>
              <input
                id="resubmit-photo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(event) => void pick(event.target.files?.[0])}
              />
            </label>
            {preview && blob ? (
              <div className="mt-2.5 flex items-center gap-3 rounded-card border border-border bg-surface p-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="Preview of your resubmitted ID" className="h-14 w-20 rounded-[8px] object-cover" />
                <p className="text-small text-fg-muted">
                  {fileName} · {formatBytes(blob.size)}
                </p>
              </div>
            ) : null}
            <p className="mt-2 text-tiny text-fg-subtle">
              Matric format: <code className="rounded bg-surface-2 px-1 py-0.5">{matricPattern}</code>
            </p>
          </div>
          <FormMessage error={error} />
          <Button type="submit" fullWidth size="lg" loading={uploading} loadingLabel="Submitting…" disabled={compressing}>
            Submit for review
          </Button>
        </form>
      ) : (
        <form action={vouchAction} className="space-y-4">
          <SelectField
            label="Who can vouch for you?"
            name="voucherId"
            required
            placeholder="Choose a course rep or reviewer"
            options={vouchers.map((voucher) => ({
              value: voucher.id,
              label: `${voucher.fullName} — ${voucher.roleLabel}${voucher.departmentName ? `, ${voucher.departmentName}` : ""}`,
            }))}
            error={vouchState.field === "voucherId" ? vouchState.error : null}
          />
          <TextField
            label="Matric number"
            name="matricNumber"
            required
            defaultValue={defaultMatric}
            placeholder="CSC/2022/1041"
            error={vouchState.field === "matricNumber" ? vouchState.error : null}
          />
          <p className="flex items-start gap-2 rounded-card bg-surface-2 px-3.5 py-3 text-small text-fg-muted">
            <Users aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-accent-ink" />
            They&apos;ll get an email and can approve from their verification queue.
          </p>
          <FormMessage error={vouchState.error} />
          <Button type="submit" fullWidth size="lg" loading={vouchPending} loadingLabel="Sending…">
            Ask for a vouch
          </Button>
        </form>
      )}
    </div>
  );
}
