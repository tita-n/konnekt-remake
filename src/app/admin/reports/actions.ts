"use server";

import { revalidatePath } from "next/cache";
import { requireUniversityRole } from "@/lib/auth/guards";
import { moderateReport, reinstateStudent, type ModerationDecision } from "@/lib/services/moderation";

export interface ModerationFormState {
  ok: boolean;
  error: string | null;
  message: string | null;
}

const DECISIONS = new Set<ModerationDecision>(["REMOVE", "KEEP", "WARN", "SUSPEND"]);

export async function moderateReportAction(
  _previous: ModerationFormState,
  formData: FormData,
): Promise<ModerationFormState> {
  const user = await requireUniversityRole(["UNIVERSITY_ADMIN", "MODERATOR"]);
  const reportId = String(formData.get("reportId") ?? "");
  const decision = String(formData.get("decision") ?? "") as ModerationDecision;
  const reason = String(formData.get("reason") ?? "");
  if (!reportId || !DECISIONS.has(decision)) {
    return { ok: false, error: "Choose an action for this report.", message: null };
  }
  const durationValue = String(formData.get("duration") ?? "");
  const durationDays =
    decision === "SUSPEND"
      ? durationValue === "permanent"
        ? null
        : durationValue === "30"
          ? 30
          : durationValue === "7"
            ? 7
            : 1
      : null;
  try {
    const result = await moderateReport(user, {
      reportId,
      decision,
      reason,
      durationDays,
    });
    revalidatePath("/admin/reports");
    revalidatePath(`/admin/reports/${reportId}`);
    return {
      ok: true,
      error: null,
      message:
        result.flagged
          ? `Action recorded. ${result.strikes} active strikes — the account is flagged for admin review.`
          : `Action recorded. ${result.strikes} active ${result.strikes === 1 ? "strike" : "strikes"}.`,
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Couldn't record that action.", message: null };
  }
}

export async function reinstateStudentAction(
  _previous: ModerationFormState,
  formData: FormData,
): Promise<ModerationFormState> {
  const user = await requireUniversityRole(["UNIVERSITY_ADMIN"]);
  const studentId = String(formData.get("studentId") ?? "");
  if (!studentId) return { ok: false, error: "Student not found.", message: null };
  try {
    await reinstateStudent(user, studentId);
    revalidatePath(`/admin/students/${studentId}/moderation`);
    return { ok: true, error: null, message: "The account has been reinstated." };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Couldn't reinstate the account.", message: null };
  }
}
