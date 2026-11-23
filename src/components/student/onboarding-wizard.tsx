"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import type { DepartmentChoice } from "@/lib/services/academic";
import { finishOnboardingStep, saveInterestsStep, saveProfileStep } from "@/app/onboarding/actions";
import type { CommunityCardView } from "@/lib/communities/types";
import { apiGet } from "@/lib/posts/client";
import { CommunityCard } from "@/components/communities/community-card";
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
  const [finishState, finishAction, savingFinish] = useActionState(finishOnboardingStep, emptyFormState);
  const [communitySuggestions, setCommunitySuggestions] = useState<CommunityCardView[]>([]);
  const [loadingCommunities, setLoadingCommunities] = useState(false);
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
    if (!interestsState.ok) return;
    setStep(2);
    setLoadingCommunities(true);
    void apiGet<{ suggested: CommunityCardView[]; trending: CommunityCardView[] }>("/api/communities")
      .then(({ data }) => setCommunitySuggestions([...data.suggested, ...data.trending].slice(0, 6)))
      .catch(() => setCommunitySuggestions([]))
      .finally(() => setLoadingCommunities(false));
  }, [interestsState.ok]);

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
      <Stepper steps={["Profile", "Interests", "Communities"]} current={step} />
      <h1 className="mt-6 text-h1 text-fg">
        {step === 0 ? "Make your profile yours" : step === 1 ? "What are you into?" : "Find your people"}
      </h1>
      <p className="mt-1.5 text-body text-fg-muted">
        {step === 0
          ? "This is what classmates see. Your department and level put you in the right conversations."
          : step === 1
            ? "Pick at least 3. Your interests help people find you — and help us suggest communities."
            : "Join a few circles now, or skip and explore later. You can always find them in Communities."}
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
                className="inline-flex items-center gap-1.5 text-small font-semibold text-accent-ink underline-offset-2 hover:underline"
              >
                <Camera aria-hidden="true" className="size-4" />
                {photoUrl ? "Change photo" : "Add a photo"}
              </button>
              <p className="mt-0.5 text-small text-fg-subtle">Optional. Your initials work fine too.</p>
              {photoError ? <p className="mt-1 text-small text-danger">{photoError}</p> : null}
            </div>
            {uploading ? <Loader2 aria-hidden="true" className="ml-auto size-5 animate-spin text-accent-ink" /> : null}
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

          <div className="sticky bottom-0 z-10 -mx-5 border-t border-border/80 bg-bg/95 px-5 py-3.5 backdrop-blur-sm sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
            <Button type="submit" size="lg" fullWidth loading={savingProfile} loadingLabel="Saving…">
              Continue
            </Button>
          </div>
        </form>
      ) : step === 1 ? (
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
            <button type="button" onClick={() => setStep(0)} className="font-semibold text-accent-ink underline-offset-2 hover:underline">
              Back to profile
            </button>
          </div>

          <FormMessage error={interestsState.error} />

          <div className="sticky bottom-0 z-10 -mx-5 border-t border-border/80 bg-bg/95 px-5 py-3.5 backdrop-blur-sm sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
            <Button type="submit" size="lg" fullWidth loading={savingInterests} loadingLabel="Saving…" disabled={selected.length < 3}>
              {selected.length < 3 ? "Pick at least 3 interests" : "Continue to communities"}
            </Button>
          </div>
        </form>
      ) : (
        <form action={finishAction} className="mt-5 space-y-3">
          {loadingCommunities ? (
            <div className="flex items-center justify-center gap-2 rounded-card border border-border bg-surface py-8 text-small text-fg-muted">
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              Finding communities for you…
            </div>
          ) : communitySuggestions.length === 0 ? (
            <div className="rounded-card border border-border bg-surface p-4 text-center">
              <p className="text-small font-semibold text-fg">No suggestions yet</p>
              <p className="mt-1 text-small text-fg-muted">
                Communities are just getting started. You can start your own from the Communities tab.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {communitySuggestions.map((community) => (
                <CommunityCard key={community.id} community={community} />
              ))}
            </div>
          )}

          <FormMessage error={finishState.error} />

          <div className="sticky bottom-0 z-10 -mx-5 space-y-2 border-t border-border/80 bg-bg/95 px-5 py-3.5 backdrop-blur-sm sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
            <Button type="submit" size="lg" fullWidth loading={savingFinish} loadingLabel="Opening Pulse…">
              Finish and enter Konnekt
            </Button>
            <div className="flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="py-2 text-small font-semibold text-fg-muted hover:text-fg"
              >
                Back
              </button>
              <button type="submit" className="py-2 text-small font-semibold text-accent-ink hover:underline">
                Skip for now
              </button>
            </div>
          </div>
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
