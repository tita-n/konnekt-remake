"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStudent } from "@/lib/auth/guards";
import { tenantDb } from "@/lib/db/tenant";
import { listDepartmentChoices } from "@/lib/services/academic";
import { bioSchema, fullNameSchema, interestsSchema, levelSchema } from "@/lib/validation/schemas";
import { writeAudit } from "@/lib/audit";
import type { FormState } from "@/lib/action-state";

const schema = z.object({
  fullName: fullNameSchema,
  bio: z.string().trim().max(280, "Keep your bio under 280 characters.").optional(),
  departmentId: z.string().min(1, "Pick your department."),
  level: levelSchema,
  isPostgraduate: z.string().optional(),
  interests: interestsSchema,
});

export async function updateProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireStudent("/settings/profile");
  const rawInterests = formData.getAll("interests").filter((value): value is string => typeof value === "string");

  const parsed = schema.safeParse({
    fullName: formData.get("fullName"),
    bio: (formData.get("bio") as string | null) ?? "",
    departmentId: formData.get("departmentId"),
    level: formData.get("level"),
    isPostgraduate: (formData.get("isPostgraduate") as string | null) ?? undefined,
    interests: rawInterests,
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue?.message ?? "Check your profile.", field: String(issue?.path[0] ?? "") };
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
      fullName: parsed.data.fullName,
      bio: parsed.data.bio?.trim() || null,
      departmentNodeId: department.id,
      level: parsed.data.level,
      isPostgraduate: parsed.data.isPostgraduate === "on",
      interests: parsed.data.interests,
    },
  });

  await writeAudit({
    actorId: user.id,
    universityId: user.universityId,
    action: "profile.updated",
    targetType: "User",
    targetId: user.id,
    metadata: { departmentId: department.id, level: parsed.data.level, interests: parsed.data.interests.length },
  }).catch(() => undefined);

  revalidatePath("/profile/me");
  revalidatePath("/settings/profile");
  return { ok: true, message: "Profile saved." };
}

