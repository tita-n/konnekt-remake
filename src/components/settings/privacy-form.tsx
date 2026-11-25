"use client";

import { useActionState, useState } from "react";
import type { Visibility } from "@prisma/client";
import { updatePrivacyAction } from "@/app/(shell)/settings/privacy/actions";
import { emptyFormState } from "@/lib/action-state";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/navigation";
import { FormMessage } from "@/components/auth/auth-shell";
import { apiPost } from "@/lib/posts/client";

const options: Array<{ value: Visibility; label: string }> = [
  { value: "EVERYONE", label: "Everyone" },
  { value: "UNIVERSITY", label: "University" },
  { value: "NOBODY", label: "Nobody" },
];

export function PrivacyForm({
  departmentVisibility,
  levelVisibility,
  showEventAttendance,
}: {
  departmentVisibility: Visibility;
  levelVisibility: Visibility;
  showEventAttendance: boolean;
}) {
  const [state, action, pending] = useActionState(updatePrivacyAction, emptyFormState);
  const [department, setDepartment] = useState<Visibility>(departmentVisibility);
  const [level, setLevel] = useState<Visibility>(levelVisibility);
  const [showGoing, setShowGoing] = useState(showEventAttendance);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);
  const [attendanceBusy, setAttendanceBusy] = useState(false);

  const toggleAttendance = async (next: boolean) => {
    setShowGoing(next);
    setAttendanceBusy(true);
    setAttendanceError(null);
    try {
      await apiPost("/api/profile/events-privacy", { show: next });
    } catch (error) {
      setShowGoing(!next);
      setAttendanceError(error instanceof Error ? error.message : "Couldn't save that setting.");
    } finally {
      setAttendanceBusy(false);
    }
  };

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

      <section className="rounded-card border border-border bg-surface p-4">
        <h2 className="text-h3 text-fg">Show me as going</h2>
        <p className="mt-1 text-small text-fg-muted">
          When this is on, other students can see you in the attendee avatars on events you RSVP to. Organisers can
          always see their attendee list, and nobody can see who is on the waitlist.
        </p>
        <label className="mt-3 flex min-h-11 items-center justify-between gap-3 rounded-button border border-border px-3 text-small font-semibold text-fg">
          Show my attendance on events
          <input
            type="checkbox"
            checked={showGoing}
            disabled={attendanceBusy}
            onChange={(change) => void toggleAttendance(change.target.checked)}
            className="size-5 accent-[var(--accent)]"
          />
        </label>
        {attendanceError ? <p className="mt-2 text-small text-danger">{attendanceError}</p> : null}
      </section>

      <FormMessage error={state.error} message={state.ok ? state.message : null} />
      <Button type="submit" loading={pending} loadingLabel="Saving…">
        Save privacy settings
      </Button>
    </form>
  );
}
