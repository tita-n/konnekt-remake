"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStudent } from "@/lib/auth/guards";
import { tenantDb } from "@/lib/db/tenant";
import { visibilitySchema } from "@/lib/validation/schemas";
import { writeAudit } from "@/lib/audit";
import type { FormState } from "@/lib/action-state";

const schema = z.object({
  departmentVisibility: visibilitySchema,
  levelVisibility: visibilitySchema,
});

export async function updatePrivacyAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireStudent("/settings/privacy");
  const parsed = schema.safeParse({
    departmentVisibility: formData.get("departmentVisibility"),
    levelVisibility: formData.get("levelVisibility"),
  });
  if (!parsed.success) return { error: "Choose an option for each setting." };

  const db = tenantDb(user.universityId);
  await db.user.update({
    where: { id: user.id },
    data: {
      departmentVisibility: parsed.data.departmentVisibility,
      levelVisibility: parsed.data.levelVisibility,
    },
  });
  await writeAudit({
    actorId: user.id,
    universityId: user.universityId,
    action: "account.privacy_updated",
    targetType: "User",
    targetId: user.id,
    metadata: {
      department: parsed.data.departmentVisibility,
      level: parsed.data.levelVisibility,
    },
  }).catch(() => undefined);
  revalidatePath("/settings/privacy");
  return { ok: true, message: "Privacy saved." };
}
