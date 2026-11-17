"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireStudent } from "@/lib/auth/guards";
import { getSession, revokeAllSessions, revokeSession } from "@/lib/auth/session";
import { hashPassword, isPasswordBreached, verifyPassword } from "@/lib/auth/password";
import { tenantDb } from "@/lib/db/tenant";
import { emailSchema, passwordSchema, usernameSchema } from "@/lib/validation/schemas";
import { issueEmailCode, verifyEmailCode } from "@/lib/services/email-codes";
import { requestAccountDeletion } from "@/lib/services/verification";
import { rateLimit } from "@/lib/security/rate-limit";
import { requestContext } from "@/lib/security/request";
import { hashIp, sha256 } from "@/lib/crypto";
import { writeAudit } from "@/lib/audit";
import type { FormState } from "@/lib/action-state";

export async function changeUsernameAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireStudent("/settings/account");
  const parsed = usernameSchema.safeParse(formData.get("username"));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Choose a username.", field: "username" };
  }
  if (parsed.data === user.username) return { ok: true, message: "That's already your username." };

  const { platformDb } = await import("@/lib/db/platform");
  const taken = await platformDb.user.findUnique({ where: { username: parsed.data }, select: { id: true } });
  if (taken) return { error: "That username is taken.", field: "username" };

  const db = tenantDb(user.universityId);
  await db.user.update({ where: { id: user.id }, data: { username: parsed.data } });
  await writeAudit({
    actorId: user.id,
    universityId: user.universityId,
    action: "account.username_changed",
    targetType: "User",
    targetId: user.id,
    metadata: { previous: user.username, next: parsed.data },
  }).catch(() => undefined);
  revalidatePath("/settings/account");
  return { ok: true, message: "Username updated." };
}

const passwordChangeSchema = z
  .object({
    current: z.string().min(1, "Enter your current password."),
    next: passwordSchema,
    confirm: z.string(),
  })
  .refine((value) => value.next === value.confirm, { message: "Those passwords don't match.", path: ["confirm"] });

export async function changePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireStudent("/settings/account");
  const parsed = passwordChangeSchema.safeParse({
    current: formData.get("current"),
    next: formData.get("next"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue?.message ?? "Check your passwords.", field: String(issue?.path[0] ?? "") };
  }

  const context = await requestContext();
  const limit = await rateLimit("passwordResetComplete", hashIp(context.ip) ?? user.id);
  if (!limit.success) return { error: "Too many attempts. Try again later." };

  const { platformDb } = await import("@/lib/db/platform");
  const record = await platformDb.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
  if (!record || !(await verifyPassword(record.passwordHash, parsed.data.current))) {
    return { error: "Your current password is not correct.", field: "current" };
  }
  if (await isPasswordBreached(parsed.data.next)) {
    return { error: "That new password appears in data breaches. Choose another.", field: "next" };
  }

  const db = tenantDb(user.universityId);
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(parsed.data.next) } });
  await revokeAllSessions(user.id);
  await writeAudit({
    actorId: user.id,
    universityId: user.universityId,
    action: "account.password_changed",
    targetType: "User",
    targetId: user.id,
  }).catch(() => undefined);

  redirect("/login?passwordChanged=1");
}

export async function requestEmailChangeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireStudent("/settings/account");
  const parsedEmail = emailSchema.safeParse(formData.get("email"));
  const password = String(formData.get("password") ?? "");
  if (!parsedEmail.success) return { error: parsedEmail.error.issues[0]?.message ?? "Enter a valid email.", field: "email" };
  if (!password) return { error: "Confirm with your password.", field: "password" };
  if (parsedEmail.data === user.email) return { error: "That is already your email.", field: "email" };

  const context = await requestContext();
  const limit = await rateLimit("emailCodeSend", sha256(parsedEmail.data));
  if (!limit.success) return { error: "Too many requests. Try again in a few minutes." };

  const { platformDb } = await import("@/lib/db/platform");
  const [record, taken] = await Promise.all([
    platformDb.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } }),
    platformDb.user.findUnique({ where: { email: parsedEmail.data }, select: { id: true } }),
  ]);
  if (!record || !(await verifyPassword(record.passwordHash, password))) {
    return { error: "Your password is not correct.", field: "password" };
  }
  if (taken) return { error: "That email is already used by another account.", field: "email" };

  try {
    await issueEmailCode({ email: parsedEmail.data, purpose: "SIGNUP_EMAIL", userId: user.id, universityId: user.universityId });
  } catch {
    return { error: "We couldn't send that email. Try again." };
  }
  return { ok: true, step: "code", email: parsedEmail.data, message: "Code sent. Enter it below to confirm." };
}

export async function confirmEmailChangeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireStudent("/settings/account");
  const email = emailSchema.safeParse(formData.get("email"));
  const code = String(formData.get("code") ?? "");
  if (!email.success) return { error: "Enter your new email again." };
  if (!/^\d{6}$/.test(code)) return { error: "Enter the 6-digit code." };

  const result = await verifyEmailCode({ email: email.data, purpose: "SIGNUP_EMAIL", code });
  if (result !== "OK") return { error: "That code is wrong or expired." };

  const db = tenantDb(user.universityId);
  const { platformDb } = await import("@/lib/db/platform");
  const taken = await platformDb.user.findUnique({ where: { email: email.data }, select: { id: true } });
  if (taken && taken.id !== user.id) return { error: "That email is already used by another account." };

  await db.user.update({ where: { id: user.id }, data: { email: email.data, emailVerified: true } });
  await writeAudit({
    actorId: user.id,
    universityId: user.universityId,
    action: "account.email_changed",
    targetType: "User",
    targetId: user.id,
  }).catch(() => undefined);
  revalidatePath("/settings/account");
  return { ok: true, message: "Email updated and verified." };
}

export async function revokeSessionAction(formData: FormData): Promise<void> {
  const user = await requireStudent("/settings/account");
  const sessionId = String(formData.get("sessionId") ?? "");
  if (!sessionId) return;
  const revoked = await revokeSession(user.id, sessionId);
  if (revoked) {
    await writeAudit({
      actorId: user.id,
      universityId: user.universityId,
      action: "auth.session_revoked",
      targetType: "Session",
      targetId: sessionId,
    }).catch(() => undefined);
  }
  const session = await getSession();
  if (session?.session.id === sessionId) redirect("/login");
  revalidatePath("/settings/account");
}

const deleteSchema = z.object({
  confirm: z.string(),
  password: z.string().min(1, "Enter your password to confirm."),
});

export async function deleteAccountAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await getSession();
  if (!session) redirect("/login");
  const user = session.user;
  if (user.status === "DELETED_PENDING") redirect("/account/deleted");

  const parsed = deleteSchema.safeParse({
    confirm: formData.get("confirm"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  if (parsed.data.confirm.trim() !== user.username) {
    return { error: `Type your username, ${user.username}, to confirm.`, field: "confirm" };
  }

  const { platformDb } = await import("@/lib/db/platform");
  const record = await platformDb.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
  if (!record || !(await verifyPassword(record.passwordHash, parsed.data.password))) {
    return { error: "Your password is not correct.", field: "password" };
  }

  await requestAccountDeletion(user.id, user.universityId);
  redirect("/login?deletionRequested=1");
}
