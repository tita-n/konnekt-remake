import "server-only";
import type { EmailCodePurpose } from "@prisma/client";
import { platformDb } from "@/lib/db/platform";
import { generateEmailCode, hashCode, safeEqual } from "@/lib/crypto";
import { sendVerificationCode } from "@/lib/email";

const EXPIRY_MINUTES = 10;
const MAX_ATTEMPTS = 5;

export type VerifyCodeResult = "OK" | "INVALID" | "EXPIRED" | "TOO_MANY" | "NOT_FOUND";

export async function issueEmailCode(input: {
  email: string;
  purpose: EmailCodePurpose;
  userId?: string | null;
  universityId?: string | null;
}): Promise<void> {
  const email = input.email.toLowerCase();
  const now = new Date();

  // Only the newest code can work; older unused codes are burned.
  await platformDb.emailCode.updateMany({
    where: { email, purpose: input.purpose, consumedAt: null },
    data: { consumedAt: now },
  });

  const code = generateEmailCode();
  await platformDb.emailCode.create({
    data: {
      email,
      purpose: input.purpose,
      userId: input.userId ?? null,
      universityId: input.universityId ?? null,
      codeHash: hashCode(email, input.purpose, code),
      expiresAt: new Date(now.getTime() + EXPIRY_MINUTES * 60 * 1000),
    },
  });

  await sendVerificationCode(email, code, input.purpose);
}

export async function verifyEmailCode(input: {
  email: string;
  purpose: EmailCodePurpose;
  code: string;
}): Promise<VerifyCodeResult> {
  const email = input.email.toLowerCase();
  const record = await platformDb.emailCode.findFirst({
    where: { email, purpose: input.purpose, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!record) return "NOT_FOUND";
  if (record.attempts >= MAX_ATTEMPTS) return "TOO_MANY";
  if (record.expiresAt.getTime() < Date.now()) return "EXPIRED";

  await platformDb.emailCode.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });

  if (!safeEqual(record.codeHash, hashCode(email, input.purpose, input.code.trim()))) {
    return "INVALID";
  }

  const consumed = await platformDb.emailCode.updateMany({
    where: { id: record.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  return consumed.count === 1 ? "OK" : "INVALID";
}

/** Consume and clear every outstanding code for an email (e.g. after signup). */
export async function burnEmailCodes(email: string): Promise<void> {
  await platformDb.emailCode.updateMany({
    where: { email: email.toLowerCase(), consumedAt: null },
    data: { consumedAt: new Date() },
  });
}

export const CODE_POLICY = { expiryMinutes: EXPIRY_MINUTES, maxAttempts: MAX_ATTEMPTS };
