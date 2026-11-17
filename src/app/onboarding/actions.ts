"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireSessionUser } from "@/lib/auth/guards";
import { tenantDb } from "@/lib/db/tenant";
import { listDepartmentChoices } from "@/lib/services/academic";
import { bioSchema, interestsSchema, levelSchema } from "@/lib/validation/schemas";
import { writeAudit } from "@/lib/audit";
import type { FormState } from "@/lib/action-state";

const profileSchema = z.object({
  departmentId: z.string().min(1, "Pick your department."),
  level: levelSchema,
  bio: z.string().trim().max(280, "Keep your bio under 280 characters.").optional(),
  isPostgraduate: z.string().optional(),
});

export async function saveProfileStep(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireSessionUser();
  if (user.status === "SUSPENDED") redirect("/suspended");
  if (user.status === "DELETED_PENDING") redirect("/account/deleted");

  const parsed = profileSchema.safeParse({
    departmentId: formData.get("departmentId"),
    level: formData.get("level"),
    bio: (formData.get("bio") as string | null) ?? "",
    isPostgraduate: (formData.get("isPostgraduate") as string | null) ?? undefined,
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue?.message ?? "Check your profile details.", field: String(issue?.path[0] ?? "") };
  }

  const departments = await listDepartmentChoices(user.universityId);
  const department = departments.find((choice) => choice.id === parsed.data.departmentId);
  if (!department) return { error: "Pick a department from your university.", field: "departmentId" };
  if (!department.levels.includes(parsed.data.level)) {
    return { error: "Pick a level offered by your department.", field: "level" };
  }

  const db = tenantDb(user.universityId);
  await db.user.update({
    where: { id: user.id },
    data: {
      departmentNodeId: department.id,
      level: parsed.data.level,
      bio: parsed.data.bio?.trim() || null,
      isPostgraduate: parsed.data.isPostgraduate === "on",
    },
  });

  await writeAudit({
    actorId: user.id,
    universityId: user.universityId,
    action: "profile.academic_details_set",
    targetType: "User",
    targetId: user.id,
    metadata: { departmentId: department.id, level: parsed.data.level },
  }).catch(() => undefined);

  return { ok: true, step: "done" };
}

export async function saveInterestsStep(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireSessionUser();
  if (user.status === "SUSPENDED") redirect("/suspended");
  if (user.status === "DELETED_PENDING") redirect("/account/deleted");
  if (!user.departmentNodeId || !user.level) {
    return { error: "Finish your profile details first." };
  }

  const raw = formData.getAll("interests").filter((value): value is string => typeof value === "string");
  const parsed = interestsSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Pick at least 3 interests." };
  }

  const db = tenantDb(user.universityId);
  await db.user.update({ where: { id: user.id }, data: { interests: parsed.data } });

  await writeAudit({
    actorId: user.id,
    universityId: user.universityId,
    action: "onboarding.completed",
    targetType: "User",
    targetId: user.id,
    metadata: { interests: parsed.data.length },
  }).catch(() => undefined);

  redirect(user.status === "PENDING" || user.status === "REJECTED" || user.status === "UNVERIFIED" ? "/status" : "/pulse");
}

export { bioSchema };
