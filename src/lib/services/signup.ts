import "server-only";
import { cookies } from "next/headers";
import type { SignupDraft, VerificationMethod } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { platformDb } from "@/lib/db/platform";
import { withTenantTransaction } from "@/lib/db/tenant";
import { hmac, randomToken, safeEqual, sha256 } from "@/lib/crypto";
import { hashPassword } from "@/lib/auth/password";
import { writeAudit } from "@/lib/audit";
import { normalizeMatric, validateMatric } from "@/lib/domain/matric";
import { isStudentEmail } from "@/lib/domain/student-email";
import { academicStudentPath, type AcademicPathRow } from "./student-path";

const SIGNUP_COOKIE = "konnekt_signup";
export const SIGNUP_CSRF_COOKIE = "konnekt_signup_csrf";
const DRAFT_TTL_HOURS = 24;

export type Result<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; field?: string };

export class SignupError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
  ) {
    super(message);
  }
}

export function draftCsrfToken(token: string): string {
  return hmac(`signup-csrf:${token}`);
}

async function setDraftCookies(token: string): Promise<void> {
  const store = await cookies();
  store.set(SIGNUP_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DRAFT_TTL_HOURS * 60 * 60,
  });
  store.set(SIGNUP_CSRF_COOKIE, draftCsrfToken(token), {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DRAFT_TTL_HOURS * 60 * 60,
  });
}

export async function clearSignupCookies(): Promise<void> {
  const store = await cookies();
  store.set(SIGNUP_COOKIE, "", { path: "/", maxAge: 0, httpOnly: true, sameSite: "lax" });
  store.set(SIGNUP_CSRF_COOKIE, "", { path: "/", maxAge: 0, httpOnly: false, sameSite: "lax" });
}

export async function getSignupDraft(): Promise<SignupDraft | null> {
  const store = await cookies();
  const token = store.get(SIGNUP_COOKIE)?.value;
  if (!token) return null;
  const draft = await platformDb.signupDraft.findUnique({ where: { tokenHash: sha256(token) } });
  if (!draft) return null;
  if (draft.expiresAt.getTime() < Date.now()) {
    await platformDb.signupDraft.delete({ where: { id: draft.id } }).catch(() => undefined);
    return null;
  }
  return draft;
}

export async function assertDraftCsrf(request: Request): Promise<boolean> {
  const store = await cookies();
  const token = store.get(SIGNUP_COOKIE)?.value;
  const cookieToken = store.get(SIGNUP_CSRF_COOKIE)?.value;
  const headerToken = request.headers.get("x-konnekt-csrf");
  if (!token || !cookieToken || !headerToken) return false;
  if (!safeEqual(cookieToken, headerToken)) return false;
  return safeEqual(cookieToken, draftCsrfToken(token));
}

/**
 * Start or resume a signup draft. Drafts are bound to a single university and
 * expire after 24 hours; switching method keeps account details but clears
 * proof from the previous method so stale documents can never be attached.
 */
export async function startSignupDraft(universityId: string, method: VerificationMethod): Promise<SignupDraft> {
  const existing = await getSignupDraft();
  if (existing && existing.universityId === universityId) {
    if (existing.method === method) return existing;
    const updated = await platformDb.signupDraft.update({
      where: { id: existing.id },
      data: {
        method,
        matricNumber: null,
        matricNormalized: null,
        idImageRef: null,
        vouchId: null,
        studentEmail: null,
        studentEmailVerifiedAt: null,
      },
    });
    return updated;
  }

  if (existing) await discardSignupDraft(existing);

  const token = randomToken(24);
  const draft = await platformDb.signupDraft.create({
    data: {
      tokenHash: sha256(token),
      universityId,
      method,
      expiresAt: new Date(Date.now() + DRAFT_TTL_HOURS * 60 * 60 * 1000),
    },
  });
  await setDraftCookies(token);
  return draft;
}

export async function discardSignupDraft(draft: SignupDraft): Promise<void> {
  if (draft.idImageRef) {
    const { deletePrivateImage } = await import("@/lib/media/private-store");
    await deletePrivateImage(draft.idImageRef).catch(() => undefined);
  }
  await platformDb.signupDraft.delete({ where: { id: draft.id } }).catch(() => undefined);
}

export async function stageStudentEmail(draft: SignupDraft, studentEmail: string): Promise<Result<SignupDraft>> {
  const university = await platformDb.university.findUnique({ where: { id: draft.universityId } });
  if (!university) return { ok: false, error: "That university is no longer available." };
  if (university.status !== "ACTIVE") return { ok: false, error: "That university is not accepting sign-ups." };
  if (!isStudentEmail(studentEmail, university.studentEmailDomains)) {
    return { ok: false, error: "Use your university email address, or verify with your ID card instead.", field: "email" };
  }
  const existing = await platformDb.user.findUnique({ where: { email: studentEmail.toLowerCase() }, select: { id: true } });
  if (existing) {
    return { ok: false, error: "An account already uses that email. Try logging in instead.", field: "email" };
  }
  const updated = await platformDb.signupDraft.update({
    where: { id: draft.id },
    data: { studentEmail: studentEmail.toLowerCase(), studentEmailVerifiedAt: null },
  });
  return { ok: true, data: updated };
}

export async function markStudentEmailVerified(draft: SignupDraft): Promise<SignupDraft> {
  return platformDb.signupDraft.update({
    where: { id: draft.id },
    data: { studentEmailVerifiedAt: new Date() },
  });
}
export async function getDraftById(id: string): Promise<SignupDraft | null> {
  return platformDb.signupDraft.findUnique({ where: { id } });
}

export async function saveIdCardProof(
  draft: SignupDraft,
  input: { matricNumber: string; idImageRef: string },
): Promise<Result<SignupDraft>> {
  const university = await platformDb.university.findUnique({ where: { id: draft.universityId } });
  if (!university) return { ok: false, error: "That university is no longer available." };
  if (!university.idCardEnabled) return { ok: false, error: "ID card verification is not available for this university." };

  const matric = validateMatric(input.matricNumber, university.matricPattern);
  if (!matric.ok) {
    return {
      ok: false,
      error:
        matric.error === "INVALID_PATTERN"
          ? "This university's matric format is misconfigured. Contact support."
          : "That matric number does not match this university's format. Check it and try again.",
      field: "matricNumber",
    };
  }

  const duplicate = await platformDb.user.findFirst({
    where: { universityId: university.id, status: "VERIFIED", matricNormalized: matric.normalized },
    select: { id: true },
  });
  if (duplicate) {
    return {
      ok: false,
      error: "An account is already verified with that matric number. If that is you, log in or contact support.",
      field: "matricNumber",
    };
  }

  const updated = await platformDb.signupDraft.update({
    where: { id: draft.id },
    data: {
      matricNumber: input.matricNumber.trim(),
      matricNormalized: matric.normalized,
      idImageRef: input.idImageRef,
    },
  });
  return { ok: true, data: updated };
}

export async function saveVouchProof(
  draft: SignupDraft,
  input: { matricNumber: string; voucherId: string },
): Promise<Result<SignupDraft>> {
  const university = await platformDb.university.findUnique({ where: { id: draft.universityId } });
  if (!university) return { ok: false, error: "That university is no longer available." };
  if (!university.vouchingEnabled) return { ok: false, error: "Vouching is not available for this university." };

  const matric = validateMatric(input.matricNumber, university.matricPattern);
  if (!matric.ok) return { ok: false, error: "That matric number does not match this university's format.", field: "matricNumber" };

  const duplicate = await platformDb.user.findFirst({
    where: { universityId: university.id, status: "VERIFIED", matricNormalized: matric.normalized },
    select: { id: true },
  });
  if (duplicate) {
    return { ok: false, error: "An account is already verified with that matric number.", field: "matricNumber" };
  }

  const voucher = await platformDb.user.findFirst({
    where: {
      id: input.voucherId,
      universityId: university.id,
      status: { in: ["VERIFIED", "ALUMNI"] },
      roles: { some: { universityId: university.id, role: { in: ["OFFICIAL", "REVIEWER"] } } },
    },
    select: { id: true },
  });
  if (!voucher) return { ok: false, error: "That voucher is not available. Pick another person.", field: "voucherId" };

  const updated = await platformDb.signupDraft.update({
    where: { id: draft.id },
    data: {
      matricNumber: input.matricNumber.trim(),
      matricNormalized: matric.normalized,
      vouchId: voucher.id,
      idImageRef: null,
    },
  });
  return { ok: true, data: updated };
}

export async function saveAccountDetails(
  draft: SignupDraft,
  input: { fullName: string; username: string; email: string; password: string },
): Promise<Result<SignupDraft>> {
  const email = input.email.toLowerCase();
  const [emailTaken, usernameTaken] = await Promise.all([
    platformDb.user.findUnique({ where: { email }, select: { id: true } }),
    platformDb.user.findUnique({ where: { username: input.username.toLowerCase() }, select: { id: true } }),
  ]);
  if (emailTaken) return { ok: false, error: "An account already uses that email. Try logging in.", field: "email" };
  if (usernameTaken) return { ok: false, error: "That username is taken. Try another.", field: "username" };

  if (draft.studentEmail && email !== draft.studentEmail) {
    return { ok: false, error: "Your account email must match your verified student email.", field: "email" };
  }

  const passwordHash = await hashPassword(input.password);
  const updated = await platformDb.signupDraft.update({
    where: { id: draft.id },
    data: {
      pendingFullName: input.fullName,
      pendingUsername: input.username.toLowerCase(),
      pendingEmail: email,
      pendingPasswordHash: passwordHash,
      emailCodeSentAt: new Date(),
    },
  });
  return { ok: true, data: updated };
}

export interface CompletedSignup {
  userId: string;
  status: "PENDING" | "VERIFIED";
}

function uniqueError(error: unknown): string | null {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    const target = String(error.meta?.target ?? "");
    if (target.includes("email")) return "An account already uses that email. Try logging in.";
    if (target.includes("username")) return "That username was just taken. Pick another.";
    if (target.includes("matric") || target.includes("user_verified_matric")) {
      return "That matric number was just verified by another account. Contact support if this is a mistake.";
    }
    if (target.includes("verification_pending")) return "You already have a verification request under review.";
    return "That account could not be created. Check your details and try again.";
  }
  return null;
}

/**
 * Turn a fully proven draft into a real account. Runs in one tenant-scoped
 * transaction so a user is never created without its verification request.
 */
export async function completeSignup(draftId: string, emailVerified: boolean): Promise<Result<CompletedSignup>> {
  const draft = await getDraftById(draftId);
  if (!draft || draft.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: "Your signup session expired. Start again." };
  }
  if (!draft.pendingFullName || !draft.pendingUsername || !draft.pendingEmail || !draft.pendingPasswordHash) {
    return { ok: false, error: "Your signup session expired. Start again." };
  }
  if (!emailVerified) {
    return { ok: false, error: "Confirm your email address first." };
  }

  const university = await platformDb.university.findUnique({ where: { id: draft.universityId } });
  if (!university || university.status !== "ACTIVE") {
    return { ok: false, error: "That university is no longer accepting sign-ups." };
  }

  const verifiedByStudentEmail =
    draft.method === "STUDENT_EMAIL" && Boolean(draft.studentEmailVerifiedAt) && draft.studentEmail === draft.pendingEmail;
  const wantsId = draft.method === "ID_CARD";
  const wantsVouch = draft.method === "VOUCH";
  if (!verifiedByStudentEmail) {
    if (wantsId && !draft.idImageRef) return { ok: false, error: "Upload your ID card to continue." };
    if (wantsId && !draft.matricNormalized) return { ok: false, error: "Enter your matric number to continue." };
    if (wantsVouch && (!draft.vouchId || !draft.matricNormalized)) {
      return { ok: false, error: "Choose a voucher and enter your matric number." };
    }
  }

  const status = verifiedByStudentEmail ? "VERIFIED" : "PENDING";

  try {
    const created = await withTenantTransaction(draft.universityId, async (db) => {
      const user = await db.user.create({
        data: {
          universityId: draft.universityId,
          email: draft.pendingEmail!,
          emailVerified: true,
          username: draft.pendingUsername!,
          passwordHash: draft.pendingPasswordHash!,
          fullName: draft.pendingFullName!,
          status,
          matricNumber: draft.matricNumber,
          matricNormalized: draft.matricNormalized,
          consentPolicyVersion: university.policyVersion,
          consentAcceptedAt: new Date(),
          verifiedAt: verifiedByStudentEmail ? new Date() : null,
        },
        select: { id: true, status: true },
      });

      if (!verifiedByStudentEmail) {
        await db.verificationRequest.create({
          data: {
            userId: user.id,
            universityId: draft.universityId,
            method: draft.method,
            matricNumber: draft.matricNumber,
            matricNormalized: draft.matricNormalized,
            idImageRef: wantsId ? draft.idImageRef : null,
            voucherId: wantsVouch ? draft.vouchId : null,
            status: "PENDING",
          },
        });
      }
      return user;
    });

    await platformDb.signupDraft.delete({ where: { id: draft.id } }).catch(() => undefined);
    await clearSignupCookies();
    await writeAudit({
      actorId: created.id,
      universityId: draft.universityId,
      action: verifiedByStudentEmail ? "user.auto_verified" : "verification.submitted",
      targetType: "User",
      targetId: created.id,
      metadata: { method: draft.method },
    }).catch(() => undefined);

    return { ok: true, data: { userId: created.id, status } };
  } catch (error) {
    const message = uniqueError(error);
    if (message) return { ok: false, error: message };
    console.error("[signup] completion failed", error instanceof Error ? error.message : "unknown");
    return { ok: false, error: "We could not create your account. Please try again." };
  }
}

/** Count attempts in the last 24h for resubmission rate limiting. */
export async function verificationAttemptsLast24h(userId: string, universityId: string): Promise<number> {
  const db = (await import("@/lib/db/tenant")).tenantDb(universityId);
  return db.verificationRequest.count({
    where: { userId, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });
}

export function academicPathForUser(
  universityId: string,
  department: AcademicPathRow,
  level: number,
) {
  return academicStudentPath(universityId, department, level);
}

export { normalizeMatric };
