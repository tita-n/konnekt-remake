import { Button } from "@/components/ui/button";
import { Chip, SelectField, TextField } from "@/components/ui/form-controls";
import { PreviewToggle } from "./preview-toggle";
import { DEPARTMENT_CHOICES, INTERESTS, LEVELS } from "./index-shared";

/**
 * The two onboarding screens, shared by every direction.
 *
 * These mirror the live wizard (`src/app/(auth)/onboarding/`) one for one —
 * Department, Level, the postgraduate switch and Bio, then interests and the
 * submit CTA — so a direction can change the framing but can never invent a
 * field the product does not have. A direction that wants a different visual
 * treatment wraps these, it does not re-declare the inputs.
 */

export function OnboardingProfileFields({ submitLabel = "Continue" }: { submitLabel?: string }) {
  return (
    <div className="space-y-4">
      <SelectField
        label="Department"
        placeholder="Choose your department"
        options={DEPARTMENT_CHOICES.map((department) => ({ value: department.id, label: department.name }))}
      />
      <SelectField
        label="Level"
        placeholder="Choose your level"
        options={LEVELS.map((level) => ({ value: String(level), label: String(level) }))}
      />
      <PreviewToggle label="I'm a postgraduate student" />
      <TextField
        label="Bio"
        placeholder="A line about you — your course, what you're building, what you're looking for."
      />
      <Button size="lg" fullWidth>
        {submitLabel}
      </Button>
    </div>
  );
}

export function OnboardingInterestChips({
  picked = [],
  limit = 12,
  submitLabel = "Continue to communities",
  note,
}: {
  picked?: string[];
  limit?: number;
  submitLabel?: string;
  note?: string;
}) {
  const chosen = new Set(picked);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Your interests">
        {INTERESTS.slice(0, limit).map((interest) => (
          <Chip key={interest} selected={chosen.has(interest)} className="min-h-11">
            {interest}
          </Chip>
        ))}
      </div>
      <Button size="lg" fullWidth>
        {submitLabel}
      </Button>
      <p className="text-tiny text-fg-subtle">{note ?? "Pick at least 3 — you can add more later from your profile."}</p>
    </div>
  );
}
