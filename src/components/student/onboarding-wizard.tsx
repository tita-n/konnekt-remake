"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import type { DepartmentChoice } from "@/lib/services/academic";
import { saveInterestsStep, saveProfileStep } from "@/app/onboarding/actions";
import { emptyFormState } from "@/lib/action-state";
import { Avatar } from "@/components/ui/display";
import { Button } from "@/components/ui/button";
import { Chip, SelectField, Switch, TextArea } from "@/components/ui/form-controls";
import { Dialog } from "@/components/ui/overlays";
import { ImageCropper } from "@/components/ui/image-cropper";
import { Stepper } from "@/components/ui/navigation";
import { FormMessage } from "@/components/auth/auth-shell";
import { ClientImageError, compressImage } from "@/lib/client/image";
import { useToast } from "@/components/providers/toast-provider";

function readCookie(name: string): string | null {
  const match = document.cookie.split("; ").find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=").slice(1).join("=")) : null;
}

export function OnboardingWizard({
  departments,
  interests,
  initial,
  labels,
}: {
  departments: DepartmentChoice[];
  interests: string[];
  initial: {
    bio: string;
    departmentId: string;
    level: number | null;
    isPostgraduate: boolean;
    interests: string[];
    photoUrl: string | null;
    fullName: string;
  };
  labels: { college?: string; faculty?: string; department?: string };
}) {
  const [step, setStep] = useState(0);
  const [profileState, profileAction, savingProfile] = useActionState(saveProfileStep, emptyFormState);
  const [interestsState, interestsAction, savingInterests] = useActionState(saveInterestsStep, emptyFormState);
  const [departmentId, setDepartmentId] = useState(initial.departmentId);
  const [level, setLevel] = useState<number | null>(initial.level);
  const [postgraduate, setPostgraduate] = useState(initial.isPostgraduate);
  const [selected, setSelected] = useState<string[]>(initial.interests);
  const [photoUrl, setPhotoUrl] = useState(initial.photoUrl);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const { toast } = useToast();

  const department = useMemo(() => departments.find((item) => item.id === departmentId), [departmentId, departments]);
  const levels = useMemo(() => department?.levels ?? [], [department]);

  useEffect(() => {
    if (profileState.ok) setStep(1);
  }, [profileState.ok]);

  useEffect(() => {
    if (levels.length > 0 && (!level || !levels.includes(level))) {
      setLevel(levels[0] ?? null);
    }
  }, [levels, level]);

  async function uploadAvatar(blob: Blob) {
    setUploading(true);
    setPhotoError(null);
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
        setPhotoError(data.error ?? "Upload failed. Try again.");
        return;
      }
      setPhotoUrl(data.photoUrl);
      setCropFile(null);
      toast({ title: "Photo updated", variant: "success" });
    } catch {
      setPhotoError("Your connection dropped. Try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <Stepper steps={["Profile", "Interests"]} current={step} />
      <h1 className="mt-6 text-h1 text-fg">{step === 0 ? "Make your profile yours" : "What are you into?"}</h1>
      <p className="mt-1.5 text-body text-fg-muted">
        {step === 0
          ? "This is what classmates see. Your department and level put you in the right conversations."
          : "Pick at least 3. Your interests help people find you — and help us build better communities."}
      </p>

      {step === 0 ? (
        <form action={profileAction} className="mt-6 space-y-5">
          <div className="flex items-center gap-4 rounded-card border border-border bg-surface p-4">
            <Avatar name={initial.fullName} src={photoUrl} size="lg" />
            <div className="min-w-0">
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
                      const compressed = await compressImage(file);
                      setCropFile(new File([compressed], "avatar.jpg", { type: "image/jpeg" }));
                    } catch (error) {
                      setPhotoError(error instanceof ClientImageError ? error.message : "Choose a different photo.");
                    }
                  };
                  input.click();
                }}
                className="inline-flex items-center gap-1.5 text-small font-semibold text-accent underline-offset-2 hover:underline"
              >
                <Camera aria-hidden="true" className="size-4" />
                {photoUrl ? "Change photo" : "Add a photo"}
              </button>
              <p className="mt-0.5 text-small text-fg-subtle">Optional. Your initials work fine too.</p>
              {photoError ? <p className="mt-1 text-small text-danger">{photoError}</p> : null}
            </div>
            {uploading ? <Loader2 aria-hidden="true" className="ml-auto size-5 animate-spin text-accent" /> : null}
          </div>

          <SelectField
            label="Department"
            name="departmentId"
            required
            value={departmentId}
            onChange={(event) => setDepartmentId(event.target.value)}
            options={departments.map((item) => ({
              value: item.id,
              label: item.lineage.length ? `${item.name} — ${item.lineage.map((node) => node.name).join(" · ")}` : item.name,
            }))}
            placeholder="Choose your department"
            hint={department ? `Your ${labels.department ?? "department"} sets your campus audience.` : undefined}
            error={profileState.field === "departmentId" ? profileState.error : null}
          />

          <SelectField
            label="Level"
            name="level"
            required
            value={level ? String(level) : ""}
            onChange={(event) => setLevel(Number(event.target.value))}
            options={levels.map((value) => ({ value: String(value), label: `${value} level` }))}
            placeholder={levels.length ? "Choose your level" : "Pick a department first"}
            disabled={levels.length === 0}
            hint="Your level is always understood within your department."
            error={profileState.field === "level" ? profileState.error : null}
          />

          <div className="rounded-card border border-border bg-surface p-4">
            <Switch
              checked={postgraduate}
              onCheckedChange={setPostgraduate}
              label="I'm a postgraduate student"
              description="Shows a postgraduate badge on your profile."
            />
            <input type="hidden" name="isPostgraduate" value={postgraduate ? "on" : ""} />
          </div>

          <TextArea
            label="Bio"
            name="bio"
            defaultValue={initial.bio}
            placeholder="A line about you — your course, what you're building, what you're looking for."
            maxLength={280}
            hint="Up to 280 characters. Keep it kind."
            error={profileState.field === "bio" ? profileState.error : null}
          />

          <FormMessage error={profileState.error && !profileState.field ? profileState.error : null} />

          <Button type="submit" size="lg" fullWidth loading={savingProfile} loadingLabel="Saving…">
            Continue
          </Button>
        </form>
      ) : (
        <form action={interestsAction} className="mt-6 space-y-4">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Your interests">
            {interests.map((interest) => {
              const active = selected.includes(interest);
              return (
                <Chip
                  key={interest}
                  selected={active}
                  aria-pressed={active}
                  onClick={() => {
                    setSelected((current) =>
                      current.includes(interest)
                        ? current.filter((value) => value !== interest)
                        : current.length >= 12
                          ? current
                          : [...current, interest],
                    );
                  }}
                >
                  {interest}
                </Chip>
              );
            })}
          </div>
          {selected.map((interest) => (
            <input key={interest} type="hidden" name="interests" value={interest} />
          ))}

          <div className="flex items-center justify-between rounded-card bg-surface-2 px-3.5 py-3 text-small">
            <span className="text-fg-muted">
              {selected.length} selected · minimum 3
            </span>
            <button type="button" onClick={() => setStep(0)} className="font-semibold text-accent underline-offset-2 hover:underline">
              Back to profile
            </button>
          </div>

          <FormMessage error={interestsState.error} />

          <Button type="submit" size="lg" fullWidth loading={savingInterests} loadingLabel="Finishing…" disabled={selected.length < 3}>
            {selected.length < 3 ? "Pick at least 3 interests" : "Finish and enter Konnekt"}
          </Button>
        </form>
      )}

      <Dialog open={Boolean(cropFile)} onClose={() => setCropFile(null)} title="Position your photo" description="Drag to move it; pinch or use the slider to zoom.">
        {cropFile ? (
          <ImageCropper file={cropFile} saving={uploading} onCancel={() => setCropFile(null)} onSave={(blob) => void uploadAvatar(blob)} />
        ) : null}
      </Dialog>
    </div>
  );
}
