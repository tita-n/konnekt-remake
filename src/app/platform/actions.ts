"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { UniversityStatus } from "@prisma/client";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import {
  createUniversity,
  inviteUniversityAdmin,
  setUniversityStatus,
  updateUniversityFeatures,
} from "@/lib/services/platform";
import { emailSchema, slugSchema, universityNameSchema } from "@/lib/validation/schemas";
import { checkAccentContrast, hexColourSchema } from "@/lib/domain/color";
import { writeAudit } from "@/lib/audit";
import type { FormState } from "@/lib/action-state";

const createSchema = z.object({
  name: universityNameSchema,
  shortName: z.string().trim().min(2, "Short name is required.").max(24),
  slug: slugSchema,
  accentColor: hexColourSchema,
  matricPattern: z.string().trim().min(1, "Enter the matric format.").max(200),
  idCardEnabled: z.boolean(),
  vouchingEnabled: z.boolean(),
  studentEmailDomains: z.array(z.string().trim().min(3).max(120)).max(10),
  firstAdminEmail: z.string().trim().optional(),
});

export async function createUniversityAction(prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requirePlatformAdmin();
  const domains = String(formData.get("studentEmailDomains") ?? "")
    .split(/[\s,;]+/)
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);
  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    shortName: formData.get("shortName"),
    slug: formData.get("slug"),
    accentColor: formData.get("accentColor"),
    matricPattern: formData.get("matricPattern"),
    idCardEnabled: formData.get("idCardEnabled") === "on",
    vouchingEnabled: formData.get("vouchingEnabled") === "on",
    studentEmailDomains: domains,
    firstAdminEmail: (formData.get("firstAdminEmail") as string | null) ?? undefined,
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue?.message ?? "Check the form.", field: String(issue?.path[0] ?? "") };
  }
  const firstAdminEmail = parsed.data.firstAdminEmail?.trim() || undefined;
  if (firstAdminEmail) {
    const emailCheck = emailSchema.safeParse(firstAdminEmail);
    if (!emailCheck.success) return { error: "Enter a valid email for the first admin.", field: "firstAdminEmail" };
  }
  const contrast = checkAccentContrast(parsed.data.accentColor);
  if (!contrast.passes) return { error: contrast.messages[0] ?? "That accent is not accessible." };
  try {
    new RegExp(parsed.data.matricPattern);
  } catch {
    return { error: "The matric pattern is not a valid regular expression.", field: "matricPattern" };
  }

  const result = await createUniversity({
    actorId: admin.id,
    ...parsed.data,
    firstAdminEmail,
    labels: { college: "College", faculty: "Faculty", department: "Department" },
  });
  if (!result.ok) return { error: result.error };
  revalidatePath("/platform");
  revalidatePath("/platform/universities");
  return { ok: true, message: "University created and switched on." };
}

export async function setStatusAction(prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requirePlatformAdmin();
  const universityId = String(formData.get("universityId") ?? "");
  const status = String(formData.get("status") ?? "") as UniversityStatus;
  if (!["WAITLIST", "ACTIVE", "OFF"].includes(status)) return { error: "Unknown status." };
  const result = await setUniversityStatus({ actorId: admin.id, universityId, status });
  if (!result.ok) return { error: result.error };
  revalidatePath("/platform");
  revalidatePath("/platform/universities");
  revalidatePath(`/platform/universities/${universityId}`);
  return {
    ok: true,
    message: status === "ACTIVE" ? "University is live." : status === "OFF" ? "University switched off." : "Moved to the waitlist.",
  };
}

export async function updateFeaturesAction(prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requirePlatformAdmin();
  const universityId = String(formData.get("universityId") ?? "");
  const known = ["feed", "communities", "events", "messaging", "campusVoice", "marketplace"] as const;
  const featureFlags = Object.fromEntries(known.map((flag) => [flag, formData.get(flag) === "on"]));
  const result = await updateUniversityFeatures({
    actorId: admin.id,
    universityId,
    idCardEnabled: formData.get("idCardEnabled") === "on",
    vouchingEnabled: formData.get("vouchingEnabled") === "on",
    featureFlags,
  });
  if (!result.ok) return { error: result.error };
  revalidatePath(`/platform/universities/${universityId}`);
  return { ok: true, message: "Capabilities updated." };
}

export async function inviteAdminAction(prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requirePlatformAdmin();
  const universityId = String(formData.get("universityId") ?? "");
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { error: "Enter a valid email address.", field: "email" };
  const result = await inviteUniversityAdmin({
    actorId: admin.id,
    universityId,
    email: parsed.data,
    role: "UNIVERSITY_ADMIN",
  });
  if (!result.ok) return { error: result.error };
  revalidatePath(`/platform/universities/${universityId}`);
  return { ok: true, message: "Invitation sent." };
}

export async function cancelPlatformInviteAction(prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requirePlatformAdmin();
  const inviteId = String(formData.get("inviteId") ?? "");
  const { platformDb } = await import("@/lib/db/platform");
  const result = await platformDb.roleInvite.deleteMany({ where: { id: inviteId, acceptedAt: null } });
  if (result.count !== 1) return { error: "Invitation not found." };
  await writeAudit({
    actorId: admin.id,
    universityId: String(formData.get("universityId") ?? "") || null,
    action: "platform.invite_cancelled",
    targetType: "RoleInvite",
    targetId: inviteId,
  });
  revalidatePath(`/platform/universities/${formData.get("universityId") ?? ""}`);
  return { ok: true, message: "Invitation cancelled." };
}
