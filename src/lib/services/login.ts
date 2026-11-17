import "server-only";
import { platformDb } from "@/lib/db/platform";
import { verifyPassword } from "@/lib/auth/password";
import { normalizeMatric } from "@/lib/domain/matric";

const DUMMY_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$c2FsdHNhbHRzYWx0c2FsdA$RdescudvJCsgt3ub+b+dWRWJTmaaJObG9m5W6m7T9b0";

export interface AuthenticatedUser {
  id: string;
  universityId: string;
  status: string;
  departmentNodeId: string | null;
  level: number | null;
  email: string;
  username: string;
  universityStatus: string;
}

export type LoginFailure = "INVALID" | "LOCKED" | "UNIVERSITY_OFF";

/**
 * Verify credentials. Failure is always the same message to the caller — no
 * account enumeration — and unknown accounts still pay an Argon2 verify.
 */
export async function authenticate(
  identifier: string,
  password: string,
): Promise<{ ok: true; user: AuthenticatedUser } | { ok: false; reason: LoginFailure }> {
  const value = identifier.trim().toLowerCase();
  const isEmail = value.includes("@");

  const user = await platformDb.user.findFirst({
    where: isEmail ? { email: value } : { username: value },
    select: {
      id: true,
      universityId: true,
      status: true,
      departmentNodeId: true,
      level: true,
      email: true,
      username: true,
      passwordHash: true,
      university: { select: { status: true } },
    },
  });

  const passwordOk = user ? await verifyPassword(user.passwordHash, password) : await verifyPassword(DUMMY_HASH, password);

  if (!user || !passwordOk) return { ok: false, reason: "INVALID" };
  // DELETED_PENDING users can still sign in to cancel their deletion.
  if (user.university.status === "OFF") return { ok: false, reason: "UNIVERSITY_OFF" };

  await platformDb.user.update({
    where: { id: user.id },
    data: { lastActiveAt: new Date() },
  });

  return {
    ok: true,
    user: {
      id: user.id,
      universityId: user.universityId,
      status: user.status,
      departmentNodeId: user.departmentNodeId,
      level: user.level,
      email: user.email,
      username: user.username,
      universityStatus: user.university.status,
    },
  };
}

/** Normalized matric helper re-exported for admin import/validation. */
export { normalizeMatric };
