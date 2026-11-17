"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUniversityRole } from "@/lib/auth/guards";
import { decideVerification } from "@/lib/services/verification";
import {
  applyAcademicCsv,
  cancelInvite,
  createAcademicNode,
  deleteAcademicNode,
  inviteRole,
  isValidNodeType,
  moveAcademicNode,
  revokeRole,
  setStudentStatus,
  updateAcademicNode,
  updateUniversitySettings,
} from "@/lib/services/admin";
import { decisionReasonSchema, emailSchema, universitySettingsSchema } from "@/lib/validation/schemas";
import { checkAccentContrast } from "@/lib/domain/color";
import { acceptRoleInvite } from "@/lib/services/admin";
import { requireSessionUser } from "@/lib/auth/guards";
import type { FormState } from "@/lib/action-state";
import type { CsvRow } from "@/lib/domain/academic-csv";
import type { Role, UserStatus } from "@prisma/client";

const ADMIN_ROLES = ["UNIVERSITY_ADMIN"] as const;
const REVIEW_ROLES = ["UNIVERSITY_ADMIN", "REVIEWER"] as const;

export async function decideVerificationAction(prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUniversityRole([...REVIEW_ROLES]);
  const requestId = String(formData.get("requestId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const approve = decision === "approve";
  const note = String(formData.get("note") ?? "").trim();

  let reason: z.infer<typeof decisionReasonSchema> | undefined;
  if (!approve) {
    const parsed = decisionReasonSchema.safeParse(formData.get("reason"));
    if (!parsed.success) return { error: "Choose a reason for rejecting." };
    reason = parsed.data;
  }
  if (!requestId) return { error: "Request not found." };

  const result = await decideVerification({
    requestId,
    reviewerId: user.id,
    universityId: user.universityId,
    approve,
    reason,
    note,
    reviewerRoles: user.roles.filter((role) => role.universityId === user.universityId).map((role) => role.role),
  });
  if (!result.ok) return { error: result.error };

  revalidatePath("/admin");
  revalidatePath("/admin/verification");
  revalidatePath(`/admin/verification/${requestId}`);
  return { ok: true, message: approve ? "Request approved. The student can continue." : "Request declined." };
}

const studentStatusSchema = z.object({
  userId: z.string().min(1),
  target: z.enum(["SUSPENDED", "VERIFIED", "ALUMNI"]),
  reason: z.string().trim().max(300).optional(),
});

export async function studentStatusAction(prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUniversityRole([...ADMIN_ROLES]);
  const parsed = studentStatusSchema.safeParse({
    userId: formData.get("userId"),
    target: formData.get("target"),
    reason: (formData.get("reason") as string | null) ?? undefined,
  });
  if (!parsed.success) return { error: "Check the form and try again." };

  const result = await setStudentStatus({
    actorId: user.id,
    universityId: user.universityId,
    userId: parsed.data.userId,
    target: parsed.data.target,
    reason: parsed.data.reason,
  });
  if (!result.ok) return { error: result.error };

  revalidatePath("/admin/students");
  revalidatePath(`/admin/students/${parsed.data.userId}`);
  return {
    ok: true,
    message:
      parsed.data.target === "SUSPENDED"
        ? "Student suspended."
        : parsed.data.target === "ALUMNI"
          ? "Marked as alumni."
          : "Student reinstated.",
  };
}

/* ------------------------------ Academic tree ----------------------------- */

const nodeSchema = z.object({
  type: z.enum(["COLLEGE", "FACULTY", "DEPARTMENT"]),
  name: z.string().trim().min(2, "Give the node a name.").max(80),
  parentId: z.string().nullable(),
  levels: z.array(z.number().int()).default([]),
});

export async function createNodeAction(prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUniversityRole([...ADMIN_ROLES]);
  const levels = formData
    .getAll("levels")
    .map((value) => Number.parseInt(String(value), 10))
    .filter((value) => Number.isInteger(value));
  const parsed = nodeSchema.safeParse({
    type: formData.get("type"),
    name: formData.get("name"),
    parentId: (formData.get("parentId") as string | null) || null,
    levels,
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue?.message ?? "Check the form.", field: String(issue?.path[0] ?? "") };
  }
  const result = await createAcademicNode({
    actorId: user.id,
    universityId: user.universityId,
    ...parsed.data,
  });
  if (!result.ok) return { error: result.error };
  revalidatePath("/admin/academic");
  return { ok: true, message: "Node added." };
}

export async function updateNodeAction(prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUniversityRole([...ADMIN_ROLES]);
  const nodeId = String(formData.get("nodeId") ?? "");
  const name = formData.get("name");
  const isActive = formData.get("isActive");
  const levels = formData
    .getAll("levels")
    .map((value) => Number.parseInt(String(value), 10))
    .filter((value) => Number.isInteger(value));
  const result = await updateAcademicNode({
    actorId: user.id,
    universityId: user.universityId,
    nodeId,
    ...(name !== null ? { name: String(name) } : {}),
    ...(isActive !== null ? { isActive: isActive === "true" } : {}),
    ...(levels.length > 0 ? { levels } : {}),
  });
  if (!result.ok) return { error: result.error };
  revalidatePath("/admin/academic");
  return { ok: true, message: "Saved." };
}

export async function moveNodeAction(formData: FormData): Promise<void> {
  const user = await requireUniversityRole([...ADMIN_ROLES]);
  const nodeId = String(formData.get("nodeId") ?? "");
  const direction = String(formData.get("direction") ?? "") === "up" ? "up" : "down";
  await moveAcademicNode({ actorId: user.id, universityId: user.universityId, nodeId, direction });
  revalidatePath("/admin/academic");
}

export async function deleteNodeAction(prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUniversityRole([...ADMIN_ROLES]);
  const result = await deleteAcademicNode({
    actorId: user.id,
    universityId: user.universityId,
    nodeId: String(formData.get("nodeId") ?? ""),
  });
  if (!result.ok) return { error: result.error };
  revalidatePath("/admin/academic");
  return { ok: true, message: "Node removed." };
}

export async function importCsvAction(prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUniversityRole([...ADMIN_ROLES]);
  let rows: CsvRow[];
  try {
    rows = JSON.parse(String(formData.get("rows") ?? "[]")) as CsvRow[];
  } catch {
    return { error: "The import data was not readable. Preview it again." };
  }
  if (!Array.isArray(rows) || rows.length === 0) return { error: "Nothing to import." };
  if (rows.length > 500) return { error: "Import at most 500 rows at a time." };
  const result = await applyAcademicCsv({
    actorId: user.id,
    universityId: user.universityId,
    rows,
  });
  if (!result.ok) return { error: result.error };
  revalidatePath("/admin/academic");
  return { ok: true, message: `${result.created} ${result.created === 1 ? "node" : "nodes"} created.` };
}

/* -------------------------------- Settings -------------------------------- */

export async function universitySettingsAction(prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUniversityRole([...ADMIN_ROLES]);
  const domains = String(formData.get("studentEmailDomains") ?? "")
    .split(/[\s,;]+/)
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);
  const parsed = universitySettingsSchema.safeParse({
    name: formData.get("name"),
    shortName: formData.get("shortName"),
    accentColor: formData.get("accentColor"),
    logoUrl: (formData.get("logoUrl") as string | null) || null,
    studentEmailDomains: domains,
    idCardEnabled: formData.get("idCardEnabled") === "on",
    vouchingEnabled: formData.get("vouchingEnabled") === "on",
    matricPattern: formData.get("matricPattern"),
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue?.message ?? "Check the settings.", field: String(issue?.path[0] ?? "") };
  }

  const contrast = checkAccentContrast(parsed.data.accentColor);
  if (!contrast.passes) return { error: contrast.messages[0] ?? "That accent colour is not accessible." };

  let matricRegex: RegExp;
  try {
    matricRegex = new RegExp(parsed.data.matricPattern);
  } catch {
    return { error: "The matric pattern is not a valid regular expression.", field: "matricPattern" };
  }
  if (matricRegex.test("__konnekt_probe__")) {
    return { error: "The matric pattern matches everything. Make it more specific.", field: "matricPattern" };
  }

  const labels = {
    college: String(formData.get("labelCollege") ?? "College"),
    faculty: String(formData.get("labelFaculty") ?? "Faculty"),
    department: String(formData.get("labelDepartment") ?? "Department"),
  };

  const result = await updateUniversitySettings({
    actorId: user.id,
    universityId: user.universityId,
    settings: {
      ...parsed.data,
      logoUrl: parsed.data.logoUrl ?? null,
      labels,
      policyVersion: "2026-01-01",
      slug: "",
    },
  });
  if (!result.ok) return { error: result.error };
  revalidatePath("/admin/settings");
  revalidatePath("/admin", "layout");
  return { ok: true, message: "University settings saved." };
}

/* ---------------------------------- Team ---------------------------------- */

const inviteSchema = z.object({
  email: emailSchema,
  role: z.enum(["UNIVERSITY_ADMIN", "REVIEWER", "MODERATOR", "OFFICIAL"]),
});

export async function inviteTeamAction(prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUniversityRole([...ADMIN_ROLES]);
  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue?.message ?? "Check the invitation.", field: String(issue?.path[0] ?? "") };
  }
  const result = await inviteRole({
    actorId: user.id,
    universityId: user.universityId,
    email: parsed.data.email,
    role: parsed.data.role as Role,
  });
  if (!result.ok) return { error: result.error };
  revalidatePath("/admin/team");
  return { ok: true, message: "Invitation sent." };
}

export async function revokeRoleAction(prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUniversityRole([...ADMIN_ROLES]);
  const result = await revokeRole({
    actorId: user.id,
    universityId: user.universityId,
    assignmentId: String(formData.get("assignmentId") ?? ""),
  });
  if (!result.ok) return { error: result.error };
  revalidatePath("/admin/team");
  return { ok: true, message: "Role removed." };
}

export async function cancelInviteAction(prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUniversityRole([...ADMIN_ROLES]);
  const result = await cancelInvite({
    actorId: user.id,
    universityId: user.universityId,
    inviteId: String(formData.get("inviteId") ?? ""),
  });
  if (!result.ok) return { error: result.error };
  revalidatePath("/admin/team");
  return { ok: true, message: "Invitation cancelled." };
}

/* ---------------------------- Invite acceptance --------------------------- */

export async function acceptInviteAction(prev: FormState, formData: FormData): Promise<FormState> {
  const token = String(formData.get("token") ?? "");
  if (!token) return { error: "This invitation link is incomplete." };
  const user = await requireSessionUser(`/invite/${token}`);
  const result = await acceptRoleInvite({ token, userId: user.id, userEmail: user.email });
  if (!result.ok) return { error: result.error };
  revalidatePath("/admin");
  return { ok: true, message: "You now have access. Open your console." };
}

export type { UserStatus };
