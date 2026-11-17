"use client";

import { useActionState, useState } from "react";
import type { Visibility } from "@prisma/client";
import { updatePrivacyAction } from "@/app/(shell)/settings/privacy/actions";
import { emptyFormState } from "@/lib/action-state";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/navigation";
import { FormMessage } from "@/components/auth/auth-shell";

const options: Array<{ value: Visibility; label: string }> = [
  { value: "EVERYONE", label: "Everyone" },
  { value: "UNIVERSITY", label: "University" },
  { value: "NOBODY", label: "Nobody" },
];

export function PrivacyForm({
  departmentVisibility,
  levelVisibility,
}: {
  departmentVisibility: Visibility;
  levelVisibility: Visibility;
}) {
  const [state, action, pending] = useActionState(updatePrivacyAction, emptyFormState);
  const [department, setDepartment] = useState<Visibility>(departmentVisibility);
  const [level, setLevel] = useState<Visibility>(levelVisibility);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="departmentVisibility" value={department} />
      <input type="hidden" name="levelVisibility" value={level} />

      <section className="rounded-card border border-border bg-surface p-4">
        <h2 className="text-h3 text-fg">Who can see your department?</h2>
        <p className="mt-1 text-small text-fg-muted">
          Only verified students at your university can open your profile at all. This decides whether they see your
          department.
        </p>
        <div className="mt-3">
          <SegmentedControl label="Department visibility" value={department} onChange={setDepartment} options={options} />
        </div>
      </section>

      <section className="rounded-card border border-border bg-surface p-4">
        <h2 className="text-h3 text-fg">Who can see your level?</h2>
        <p className="mt-1 text-small text-fg-muted">
          &quot;My level&quot; always means your level inside your department. Hiding it also hides the level audience from
          your future posts.
        </p>
        <div className="mt-3">
          <SegmentedControl label="Level visibility" value={level} onChange={setLevel} options={options} />
        </div>
      </section>

      <FormMessage error={state.error} message={state.ok ? state.message : null} />
      <Button type="submit" loading={pending} loadingLabel="Saving…">
        Save privacy settings
      </Button>
    </form>
  );
}
