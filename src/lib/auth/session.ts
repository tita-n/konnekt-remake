import "server-only";
import { cookies, headers } from "next/headers";
import type { UserStatus } from "@prisma/client";
import { env, isProduction } from "@/lib/env";
import { platformDb } from "@/lib/db/platform";
import { hashIp, hmac, randomToken, safeEqual, sha256 } from "@/lib/crypto";
import { sessionCookieOptions } from "./cookie-options";

export const SESSION_COOKIE = "konnekt_session";
export const CSRF_COOKIE = "konnekt_csrf";

const sessionTtlMs = env.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;

export interface SessionUser {
  id: string;
  universityId: string;
  email: string;
  emailVerified: boolean;
  username: string;
  fullName: string;
  photoUrl: string | null;
  bio: string | null;
  status: UserStatus;
  matricNumber: string | null;
  departmentNodeId: string | null;
  level: number | null;
  isPostgraduate: boolean;
  interests: string[];
  departmentVisibility: "EVERYONE" | "UNIVERSITY" | "NOBODY";
  levelVisibility: "EVERYONE" | "UNIVERSITY" | "NOBODY";
  createdAt: Date;
  onboardingCompletedAt: Date | null;
  deletedRequestedAt: Date | null;
  purgeAfter: Date | null;
  roles: Array<{ role: string; universityId: string | null }>;
  university: {
    id: string;
    name: string;
    shortName: string;
    slug: string;
    logoUrl: string | null;
    accentColor: string;
    status: "WAITLIST" | "ACTIVE" | "OFF";
    labels: unknown;
    featureFlags: unknown;
    idCardEnabled: boolean;
    vouchingEnabled: boolean;
    studentEmailDomains: string[];
    matricPattern: string;
    policyVersion: string;
  };
}

export interface SessionRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

function cookieOptions(maxAgeSeconds: number) {
  return sessionCookieOptions(maxAgeSeconds, isProduction);
}

function requestMeta() {
  const h = headers();
  return Promise.resolve(h).then((h) => ({
    userAgent: h.get("user-agent")?.slice(0, 255) ?? null,
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null,
  }));
}

export async function createSession(userId: string, universityId: string): Promise<string> {
  const token = randomToken(32);
  const meta = await requestMeta();
  const expiresAt = new Date(Date.now() + sessionTtlMs);

  await platformDb.session.create({
    data: {
      userId,
      universityId,
      tokenHash: sha256(token),
      userAgent: meta.userAgent,
      ipHash: hashIp(meta.ip),
      expiresAt,
    },
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, cookieOptions(env.SESSION_TTL_DAYS * 24 * 60 * 60));
  // Readable by JS on purpose: the double-submit CSRF token must be readable.
  store.set(CSRF_COOKIE, csrfTokenFor(token), {
    ...cookieOptions(env.SESSION_TTL_DAYS * 24 * 60 * 60),
    httpOnly: false,
  });
  return token;
}

export function csrfTokenFor(sessionToken: string): string {
  return hmac(`csrf:${sessionToken}`);
}

export async function clearSessionCookies(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", { ...cookieOptions(0), maxAge: 0 });
  store.set(CSRF_COOKIE, "", { ...cookieOptions(0), httpOnly: false, maxAge: 0 });
}

export async function revokeCurrentSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await platformDb.session.updateMany({
      where: { tokenHash: sha256(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  await clearSessionCookies();
}

export async function revokeAllSessions(userId: string, exceptToken?: string): Promise<number> {
  const result = await platformDb.session.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(exceptToken ? { tokenHash: { not: sha256(exceptToken) } } : {}),
    },
    data: { revokedAt: new Date() },
  });
  return result.count;
}

export async function revokeSession(userId: string, sessionId: string): Promise<boolean> {
  const result = await platformDb.session.updateMany({
    where: { id: sessionId, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return result.count === 1;
}

/** Resolve the current session, or null. Never throws for a stale cookie. */
export async function getSession(): Promise<{ session: SessionRecord; user: SessionUser } | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await platformDb.session.findFirst({
    where: { tokenHash: sha256(token), revokedAt: null, expiresAt: { gt: new Date() } },
    select: { id: true, userId: true, tokenHash: true, expiresAt: true, revokedAt: true },
  });
  if (!session) return null;

  const user = await platformDb.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      universityId: true,
      email: true,
      emailVerified: true,
      username: true,
      fullName: true,
      photoUrl: true,
      bio: true,
      status: true,
      matricNumber: true,
      departmentNodeId: true,
      level: true,
      isPostgraduate: true,
      interests: true,
      departmentVisibility: true,
      levelVisibility: true,
      createdAt: true,
      onboardingCompletedAt: true,
      deletedRequestedAt: true,
      purgeAfter: true,
      roles: { select: { role: true, universityId: true } },
      university: {
        select: {
          id: true,
          name: true,
          shortName: true,
          slug: true,
          logoUrl: true,
          accentColor: true,
          status: true,
          labels: true,
          featureFlags: true,
          idCardEnabled: true,
          vouchingEnabled: true,
          studentEmailDomains: true,
          matricPattern: true,
          policyVersion: true,
        },
      },
    },
  });
  if (!user) return null;

  // Touch lastSeen at most once an hour per session to avoid write amplification.
  const lastSeenCutoff = new Date(Date.now() - 60 * 60 * 1000);
  await platformDb.session
    .updateMany({ where: { id: session.id, lastSeenAt: { lt: lastSeenCutoff } }, data: { lastSeenAt: new Date() } })
    .catch(() => undefined);

  return { session, user };
}

/**
 * Double-submit CSRF: the header must equal the readable cookie, and both must
 * derive from the current session token (so a stolen cookie alone is useless
 * without the httpOnly session cookie).
 */
export async function assertCsrf(request: Request): Promise<boolean> {
  const store = await cookies();
  const cookieToken = store.get(CSRF_COOKIE)?.value;
  const sessionToken = store.get(SESSION_COOKIE)?.value;
  const headerToken = request.headers.get("x-konnekt-csrf");
  if (!cookieToken || !sessionToken || !headerToken) return false;
  if (!safeEqual(cookieToken, headerToken)) return false;
  return safeEqual(cookieToken, csrfTokenFor(sessionToken));
}

export async function listSessions(userId: string) {
  return platformDb.session.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastSeenAt: "desc" },
    select: { id: true, userAgent: true, createdAt: true, lastSeenAt: true, expiresAt: true },
  });
}
