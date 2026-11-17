import type { UserStatus, VerificationStatus } from "@prisma/client";

/**
 * Explicit state machines. Every status change goes through these guards so a
 * crafted request cannot jump e.g. SUSPENDED → VERIFIED.
 */
const USER_TRANSITIONS: Record<UserStatus, readonly UserStatus[]> = {
  UNVERIFIED: ["PENDING", "VERIFIED", "DELETED_PENDING"],
  PENDING: ["VERIFIED", "REJECTED", "UNVERIFIED", "DELETED_PENDING"],
  VERIFIED: ["SUSPENDED", "ALUMNI", "DELETED_PENDING"],
  REJECTED: ["PENDING", "DELETED_PENDING"],
  SUSPENDED: ["VERIFIED", "DELETED_PENDING"],
  ALUMNI: ["VERIFIED", "SUSPENDED", "DELETED_PENDING"],
  DELETED_PENDING: [],
};

export function canTransitionUserStatus(from: UserStatus, to: UserStatus): boolean {
  if (from === to) return false;
  return USER_TRANSITIONS[from].includes(to);
}

export function assertUserTransition(from: UserStatus, to: UserStatus): void {
  if (!canTransitionUserStatus(from, to)) {
    throw new Error(`Illegal user status transition: ${from} → ${to}`);
  }
}

const REQUEST_TRANSITIONS: Record<VerificationStatus, readonly VerificationStatus[]> = {
  PENDING: ["APPROVED", "REJECTED"],
  APPROVED: [],
  REJECTED: [],
};

export function canTransitionVerification(from: VerificationStatus, to: VerificationStatus): boolean {
  if (from === to) return false;
  return REQUEST_TRANSITIONS[from].includes(to);
}

/** Statuses that may use the app. */
export const ACTIVE_USER_STATUSES: readonly UserStatus[] = ["VERIFIED", "ALUMNI"];

/** Statuses that may start or resume verification. */
export const VERIFIABLE_USER_STATUSES: readonly UserStatus[] = ["UNVERIFIED", "PENDING", "REJECTED"];

export function isActiveStatus(status: UserStatus): boolean {
  return ACTIVE_USER_STATUSES.includes(status);
}

export const STATUS_LABELS: Record<UserStatus, string> = {
  UNVERIFIED: "Not verified",
  PENDING: "Waiting for review",
  VERIFIED: "Verified student",
  REJECTED: "Verification declined",
  SUSPENDED: "Suspended",
  ALUMNI: "Alumni",
  DELETED_PENDING: "Pending deletion",
};
