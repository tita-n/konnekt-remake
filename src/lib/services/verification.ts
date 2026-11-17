import "server-only";
import type { DecisionReason, VerificationMethod } from "@prisma/client";
import { tenantDb, withTenantTransaction } from "@/lib/db/tenant";
import { platformDb } from "@/lib/db/platform";
import { assertUserTransition } from "@/lib/domain/status";
import { validateMatric } from "@/lib/domain/matric";
import { DECISION_REASON_LABELS } from "@/lib/validation/schemas";
import { deletePrivateImage } from "@/lib/media/private-store";
import { sendVerificationDecision, sendVouchRequest } from "@/lib/email";
import { writeAudit } from "@/lib/audit";
import { revokeAllSessions } from "@/lib/auth/session";

export const MAX_RESUBMISSIONS_PER_24H = 3;

export async function attemptsLast24h(userId: string, universityId: string): Promise<number> {
  const db = tenantDb(universityId);
  return db.verificationRequest.count({
    where: { userId, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });
}

export interface SubmitIdResult {
  ok: boolean;
  error?: string;
  field?: string;
}

export async function submitIdVerification(input: {
  userId: string;
  universityId: string;
  userStatus: string;
  matricNumber: string;
  idImageRef: string;
}): Promise<SubmitIdResult> {
  const university = await platformDb.university.findUnique({ where: { id: input.universityId } });
  if (!university || university.status !== "ACTIVE") return { ok: false, error: "This university is not accepting requests." };
  if (!university.idCardEnabled) return { ok: false, error: "ID card verification is not enabled here." };
  if (!["UNVERIFIED", "REJECTED", "PENDING"].includes(input.userStatus)) {
    return { ok: false, error: "Your account cannot submit a new verification request." };
  }
  if (input.userStatus === "PENDING") {
    return { ok: false, error: "You already have a request under review." };
  }

  const attempts = await attemptsLast24h(input.userId, input.universityId);
  if (attempts >= MAX_RESUBMISSIONS_PER_24H) {
    return { ok: false, error: "You've reached 3 attempts in 24 hours. Try again tomorrow." };
  }

  const matric = validateMatric(input.matricNumber, university.matricPattern);
  if (!matric.ok) return { ok: false, error: "That matric number does not match your university's format.", field: "matricNumber" };

  const db = tenantDb(input.universityId);
  const duplicate = await db.user.findFirst({
    where: {
      status: "VERIFIED",
      matricNormalized: matric.normalized,
      id: { not: input.userId },
    },
    select: { id: true },
  });
  if (duplicate) {
    return { ok: false, error: "Another verified account already uses that matric number.", field: "matricNumber" };
  }

  try {
    await withTenantTransaction(input.universityId, async (tx) => {
      const pending = await tx.verificationRequest.findFirst({
        where: { userId: input.userId, status: "PENDING" },
        select: { id: true },
      });
      if (pending) throw new Error("PENDING_EXISTS");

      await tx.verificationRequest.create({
        data: {
          userId: input.userId,
          universityId: input.universityId,
          method: "ID_CARD",
          matricNumber: input.matricNumber.trim(),
          matricNormalized: matric.normalized,
          idImageRef: input.idImageRef,
          status: "PENDING",
        },
      });
      await tx.user.update({
        where: { id: input.userId },
        data: {
          status: "PENDING",
          matricNumber: input.matricNumber.trim(),
          matricNormalized: matric.normalized,
        },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "PENDING_EXISTS") {
      await deletePrivateImage(input.idImageRef);
      return { ok: false, error: "You already have a request under review." };
    }
    await deletePrivateImage(input.idImageRef);
    console.error("[verification] submit failed", error instanceof Error ? error.message : "unknown");
    return { ok: false, error: "We couldn't submit that request. Try again." };
  }

  await writeAudit({
    actorId: input.userId,
    universityId: input.universityId,
    action: "verification.submitted",
    targetType: "User",
    targetId: input.userId,
    metadata: { method: "ID_CARD" },
  }).catch(() => undefined);

  return { ok: true };
}

export async function submitVouchVerification(input: {
  userId: string;
  universityId: string;
  userStatus: string;
  userFullName: string;
  userUsername: string;
  matricNumber: string;
  voucherId: string;
}): Promise<SubmitIdResult> {
  const university = await platformDb.university.findUnique({ where: { id: input.universityId } });
  if (!university || university.status !== "ACTIVE") return { ok: false, error: "This university is not accepting requests." };
  if (!university.vouchingEnabled) return { ok: false, error: "Vouching is not enabled here." };
  if (input.userStatus === "PENDING") return { ok: false, error: "You already have a request under review." };
  if (!["UNVERIFIED", "REJECTED"].includes(input.userStatus)) {
    return { ok: false, error: "Your account cannot submit a new verification request." };
  }

  const attempts = await attemptsLast24h(input.userId, input.universityId);
  if (attempts >= MAX_RESUBMISSIONS_PER_24H) return { ok: false, error: "You've reached 3 attempts in 24 hours." };

  const matric = validateMatric(input.matricNumber, university.matricPattern);
  if (!matric.ok) return { ok: false, error: "That matric number does not match your university's format.", field: "matricNumber" };

  const db = tenantDb(input.universityId);
  const [voucher, duplicate] = await Promise.all([
    db.user.findFirst({
      where: {
        id: input.voucherId,
        status: "VERIFIED",
        roles: { some: { universityId: input.universityId, role: { in: ["REVIEWER", "OFFICIAL"] } } },
      },
      select: { id: true, email: true, fullName: true },
    }),
    db.user.findFirst({
      where: { status: "VERIFIED", matricNormalized: matric.normalized, id: { not: input.userId } },
      select: { id: true },
    }),
  ]);
  if (!voucher) return { ok: false, error: "Pick a voucher from your university.", field: "voucherId" };
  if (duplicate) return { ok: false, error: "Another verified account already uses that matric number.", field: "matricNumber" };

  await withTenantTransaction(input.universityId, async (tx) => {
    await tx.verificationRequest.create({
      data: {
        userId: input.userId,
        universityId: input.universityId,
        method: "VOUCH",
        matricNumber: input.matricNumber.trim(),
        matricNormalized: matric.normalized,
        voucherId: voucher.id,
        status: "PENDING",
      },
    });
    await tx.user.update({ where: { id: input.userId }, data: { status: "PENDING" } });
  });

  await sendVouchRequest(voucher.email, {
    studentName: input.userFullName,
    studentUsername: input.userUsername,
    shortName: university.shortName,
  }).catch(() => undefined);

  await writeAudit({
    actorId: input.userId,
    universityId: input.universityId,
    action: "verification.submitted",
    targetType: "User",
    targetId: input.userId,
    metadata: { method: "VOUCH", voucherId: voucher.id },
  }).catch(() => undefined);

  return { ok: true };
}

export interface DecisionInput {
  requestId: string;
  reviewerId: string;
  universityId: string;
  approve: boolean;
  reason?: DecisionReason;
  note?: string;
  reviewerRoles: string[];
}

/**
 * Approve or reject a verification request. The image is destroyed as part of
 * the decision, the user status transitions through the state machine, and the
 * whole thing is audited. Vouchers may only decide their own VOUCH requests.
 */
export async function decideVerification(input: DecisionInput): Promise<{ ok: boolean; error?: string }> {
  const db = tenantDb(input.universityId);
  const request = await db.verificationRequest.findFirst({
    where: { id: input.requestId },
    include: { user: { select: { id: true, email: true, status: true } } },
  });
  if (!request) return { ok: false, error: "Request not found." };
  if (request.status !== "PENDING") return { ok: false, error: "This request was already decided." };

  const isReviewer = input.reviewerRoles.includes("REVIEWER") || input.reviewerRoles.includes("UNIVERSITY_ADMIN");
  const isOwnVouch = request.method === "VOUCH" && request.voucherId === input.reviewerId;
  if (!isReviewer && !isOwnVouch) return { ok: false, error: "You cannot decide this request." };

  if (!input.approve && !input.reason) return { ok: false, error: "Choose a reason for rejecting." };

  const university = await platformDb.university.findUnique({
    where: { id: input.universityId },
    select: { shortName: true },
  });

  try {
    await withTenantTransaction(input.universityId, async (tx) => {
      const claimed = await tx.verificationRequest.updateMany({
        where: { id: request.id, status: "PENDING" },
        data: {
          status: input.approve ? "APPROVED" : "REJECTED",
          reviewerId: input.reviewerId,
          decisionReason: input.approve ? null : input.reason,
          decisionNote: input.note?.trim() || null,
          decidedAt: new Date(),
          idImageRef: null,
        },
      });
      if (claimed.count !== 1) throw new Error("ALREADY_DECIDED");

      if (input.approve) {
        const target = request.user.status;
        if (!["PENDING", "UNVERIFIED", "REJECTED"].includes(target)) throw new Error("BAD_STATUS");
        assertUserTransition("PENDING", "VERIFIED");
        await tx.user.update({
          where: { id: request.userId },
          data: {
            status: "VERIFIED",
            verifiedAt: new Date(),
            matricNumber: request.matricNumber,
            matricNormalized: request.matricNormalized,
          },
        });
      } else {
        assertUserTransition("PENDING", "REJECTED");
        await tx.user.update({ where: { id: request.userId }, data: { status: "REJECTED" } });
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "ALREADY_DECIDED") return { ok: false, error: "Someone else just decided this request." };
    if (message === "BAD_STATUS") return { ok: false, error: "That student's account cannot be approved right now." };
    console.error("[verification] decision failed", error);
    return { ok: false, error: "Could not save that decision. Try again." };
  }

  // The decision record stays; the private image does not.
  await deletePrivateImage(request.idImageRef);

  await writeAudit({
    actorId: input.reviewerId,
    universityId: input.universityId,
    action: input.approve ? "verification.approved" : "verification.rejected",
    targetType: "VerificationRequest",
    targetId: request.id,
    metadata: { reason: input.approve ? "APPROVED" : (input.reason ?? "OTHER"), hasNote: Boolean(input.note) },
  }).catch(() => undefined);

  await sendVerificationDecision(request.user.email, {
    approved: input.approve,
    reasonLabel: input.reason ? DECISION_REASON_LABELS[input.reason] : undefined,
    note: input.note,
    shortName: university?.shortName ?? "your university",
  }).catch(() => undefined);

  return { ok: true };
}

/** Cancel a pending deletion inside the 30-day grace period. */
export async function cancelAccountDeletion(userId: string, universityId: string): Promise<void> {
  const db = tenantDb(universityId);
  await db.user.updateMany({
    where: { id: userId, status: "DELETED_PENDING" },
    data: { status: "VERIFIED", deletedRequestedAt: null, purgeAfter: null },
  });
  await writeAudit({
    actorId: userId,
    universityId,
    action: "account.deletion_cancelled",
    targetType: "User",
    targetId: userId,
  }).catch(() => undefined);
}

/** Soft-delete with a 30-day grace period. Sessions are revoked immediately. */
export async function requestAccountDeletion(userId: string, universityId: string, reason?: string): Promise<void> {
  const db = tenantDb(universityId);
  await db.user.update({
    where: { id: userId },
    data: { status: "DELETED_PENDING", deletedRequestedAt: new Date(), purgeAfter: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
  });
  await revokeAllSessions(userId);
  await writeAudit({
    actorId: userId,
    universityId,
    action: "account.deletion_requested",
    targetType: "User",
    targetId: userId,
    metadata: reason ? { reason: reason.slice(0, 120) } : {},
  }).catch(() => undefined);
}

export type { VerificationMethod };
