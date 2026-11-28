"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2 } from "lucide-react";
import type { DepartmentChoice } from "@/lib/services/academic";
import { updateProfileAction } from "@/app/(shell)/settings/profile/actions";
import { emptyFormState } from "@/lib/action-state";
import { Avatar } from "@/components/ui/display";
import { Button } from "@/components/ui/button";
import { Chip, SelectField, Switch, TextArea, TextField } from "@/components/ui/form-controls";
import { Dialog } from "@/components/ui/overlays";
import { ImageCropper } from "@/components/ui/image-cropper";
import { FormMessage } from "@/components/auth/auth-shell";
import { ClientImageError, compressImage } from "@/lib/client/image";
import { useToast } from "@/components/providers/toast-provider";

function readCookie(name: string): string | null {
  const match = document.cookie.split("; ").find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=").slice(1).join("=")) : null;
}

export function ProfileEditForm({
  initial,
  departments,
  interests: catalog,
}: {
  initial: {
    fullName: string;
    bio: string;
    departmentId: string;
    level: number | null;
    isPostgraduate: boolean;
    interests: string[];
    photoUrl: string | null;
  };
  departments: DepartmentChoice[];
  interests: string[];
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(updateProfileAction, emptyFormState);
  const [fullName, setFullName] = useState(initial.fullName);
  const [bio, setBio] = useState(initial.bio);
  const [departmentId, setDepartmentId] = useState(initial.departmentId);
  const [level, setLevel] = useState<number | null>(initial.level);
  const [postgraduate, setPostgraduate] = useState(initial.isPostgraduate);
  const [selected, setSelected] = useState<string[]>(initial.interests);
  const [photoUrl, setPhotoUrl] = useState(initial.photoUrl);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const { toast } = useToast();

  const department = useMemo(() => departments.find((item) => item.id === departmentId), [departmentId, departments]);
  const levels = useMemo(() => department?.levels ?? [], [department]);

  useEffect(() => {
    if (levels.length && (!level || !levels.includes(level))) setLevel(levels[0] ?? null);
  }, [levels, level]);

  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  useEffect(() => {
    if (state.ok) {
      setDirty(false);
      toast({ title: "Profile saved", variant: "success" });
      router.refresh();
    }
  }, [state.ok, router, toast]);

  async function uploadAvatar(blob: Blob) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", new File([blob], "avatar.jpg", { type: "image/jpeg" }));
      const csrf = readCookie("konnekt_csrf");
      const response = await fetch("/api/profile/avatar", {
        method: "POST",
        body: form,
        headers: csrf ? { "x-konnekt-csrf": csrf } : undefined,
      });
      const data = (await response.json()) as { ok?: boolean; photoUrl?: string; error?: string };
      if (!response.ok || !data.ok || !data.photoUrl) {
        toast({ title: "Upload failed", description: data.error, variant: "error" });
        return;
      }
      setPhotoUrl(data.photoUrl);
      setCropFile(null);
      setDirty(true);
      toast({ title: "Photo updated", variant: "success" });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-4 rounded-card border border-border bg-surface p-4">
        <Avatar name={fullName || initial.fullName} src={photoUrl} size="lg" verified />
        <div>
          <button
            type="button"
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = "image/jpeg,image/png,image/webp";
              input.onchange = async () => {
                const file = input.files?.[0];
                if (!file) return;
                try {
                  const blob = await compressImage(file);
                  setCropFile(new File([blob], "avatar.jpg", { type: "image/jpeg" }));
                } catch (error) {
                  toast({
                    title: "Couldn't use that photo",
                    description: error instanceof ClientImageError ? error.message : undefined,
                    variant: "error",
                  });
                }
              };
              input.click();
            }}
            className="inline-flex min-h-11 items-center gap-1.5 text-small font-semibold text-accent-ink underline-offset-2 hover:underline"
          >
            <Camera aria-hidden="true" className="size-4" />
            Change photo
          </button>
          <p className="mt-0.5 text-small text-fg-subtle">Square crop, compressed for slow connections.</p>
        </div>
        {uploading ? <Loader2 aria-hidden="true" className="ml-auto size-5 animate-spin text-accent-ink" /> : null}
      </div>

      <form
        action={action}
        onChange={() => setDirty(true)}
        className="mt-5 space-y-5"
      >
        <TextField
          label="Full name"
          name="fullName"
          required
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          error={state.field === "fullName" ? state.error : null}
        />
        <TextArea
          label="Bio"
          name="bio"
          value={bio}
          onChange={(event) => setBio(event.target.value)}
          maxLength={280}
          hint={`${bio.length}/280`}
          error={state.field === "bio" ? state.error : null}
        />
        <SelectField
          label="Department"
          name="departmentId"
          required
          value={departmentId}
          onChange={(event) => setDepartmentId(event.target.value)}
          options={departments.map((item) => ({ value: item.id, label: item.name }))}
          error={state.field === "departmentId" ? state.error : null}
        />
        <SelectField
          label="Level"
          name="level"
          required
          value={level ? String(level) : ""}
          onChange={(event) => setLevel(Number(event.target.value))}
          options={levels.map((value) => ({ value: String(value), label: `${value} level` }))}
          disabled={levels.length === 0}
          error={state.field === "level" ? state.error : null}
        />
        <div className="rounded-card border border-border bg-surface p-4">
          <Switch
            checked={postgraduate}
            onCheckedChange={(value) => {
              setPostgraduate(value);
              setDirty(true);
            }}
            label="Postgraduate student"
          />
          <input type="hidden" name="isPostgraduate" value={postgraduate ? "on" : ""} />
        </div>

        <fieldset onChange={() => setDirty(true)}>
          <legend className="mb-2 text-small font-semibold text-fg">Interests (3–12)</legend>
          <div className="flex flex-wrap gap-2">
            {catalog.map((interest) => (
              <Chip
                key={interest}
                selected={selected.includes(interest)}
                onClick={() =>
                  setSelected((current) =>
                    current.includes(interest)
                      ? current.filter((value) => value !== interest)
                      : current.length >= 12
                        ? current
                        : [...current, interest],
                  )
                }
              >
                {interest}
              </Chip>
            ))}
          </div>
          {selected.map((interest) => (
            <input key={interest} type="hidden" name="interests" value={interest} />
          ))}
        </fieldset>

        <FormMessage error={state.error} message={state.ok ? state.message : null} />

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="submit" loading={pending} loadingLabel="Saving…" disabled={!dirty}>
            Save changes
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => (dirty ? setDiscardOpen(true) : router.back())}
          >
            Discard
          </Button>
        </div>
        <p className="text-tiny text-fg-subtle">
          {dirty ? "You have unsaved changes." : "All changes saved."}
        </p>
      </form>

      <Dialog
        open={cropFile !== null}
        onClose={() => setCropFile(null)}
        title="Position your photo"
        description="Drag to move it; use the slider to zoom."
      >
        {cropFile ? (
          <ImageCropper
            file={cropFile}
            saving={uploading}
            onCancel={() => setCropFile(null)}
            onSave={(blob) => void uploadAvatar(blob)}
          />
        ) : null}
      </Dialog>

      <Dialog
        open={discardOpen}
        onClose={() => setDiscardOpen(false)}
        title="Discard your changes?"
        description="Your edits to this form will be lost."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDiscardOpen(false)}>
              Keep editing
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setDiscardOpen(false);
                router.push("/settings");
              }}
            >
              Discard changes
            </Button>
          </>
        }
      />
    </div>
  );
}
