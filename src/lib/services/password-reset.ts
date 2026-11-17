import "server-only";
import { platformDb } from "@/lib/db/platform";
import { hashPassword } from "@/lib/auth/password";
import { randomToken, sha256 } from "@/lib/crypto";
import { revokeAllSessions } from "@/lib/auth/session";
import { writeAudit } from "@/lib/audit";
import { sendPasswordResetLink } from "@/lib/email";
import { isPasswordBreached } from "@/lib/auth/password";
import { env } from "@/lib/env";

const TOKEN_TTL_MINUTES = 30;

/**
 * Always resolves successfully, whether or not the address exists. This is the
 * only account-enumeration-safe behaviour.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const user = await platformDb.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true, email: true, universityId: true, status: true },
  });
  if (!user || user.status === "SUSPENDED" || user.status === "DELETED_PENDING") return;

  const token = randomToken(32);
  await platformDb.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000),
    },
  });

  const url = `${env.APP_URL}/reset-password?token=${token}`;
  await sendPasswordResetLink(user.email, url);

  await writeAudit({
    actorId: user.id,
    universityId: user.universityId,
    action: "auth.password_reset_requested",
    targetType: "User",
    targetId: user.id,
  }).catch(() => undefined);
}

export type ResetFailure = "INVALID_TOKEN" | "EXPIRED" | "WEAK" | "BREACHED";

export async function completePasswordReset(
  token: string,
  newPassword: string,
): Promise<{ ok: true } | { ok: false; reason: ResetFailure }> {
  const record = await platformDb.passwordResetToken.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: { select: { id: true, universityId: true, status: true } } },
  });
  if (!record || record.usedAt) return { ok: false, reason: "INVALID_TOKEN" };
  if (record.expiresAt.getTime() < Date.now()) return { ok: false, reason: "EXPIRED" };
  if (record.user.status === "DELETED_PENDING") return { ok: false, reason: "INVALID_TOKEN" };
  if (await isPasswordBreached(newPassword)) return { ok: false, reason: "BREACHED" };

  const passwordHash = await hashPassword(newPassword);
  const claimed = await platformDb.passwordResetToken.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (claimed.count !== 1) return { ok: false, reason: "INVALID_TOKEN" };

  await platformDb.user.update({ where: { id: record.user.id }, data: { passwordHash } });
  await revokeAllSessions(record.user.id);
  await writeAudit({
    actorId: record.user.id,
    universityId: record.user.universityId,
    action: "auth.password_reset_completed",
    targetType: "User",
    targetId: record.user.id,
  }).catch(() => undefined);

  return { ok: true };
}
