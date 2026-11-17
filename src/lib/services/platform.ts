import "server-only";
import type { Role, UniversityStatus } from "@prisma/client";
import { platformDb } from "@/lib/db/platform";
import { env, hasCloudinary, hasResend, isProduction } from "@/lib/env";
import { checkAccentContrast } from "@/lib/domain/color";
import { sha256, randomToken } from "@/lib/crypto";
import { sendUniversityInvite } from "@/lib/email";
import { writeAudit } from "@/lib/audit";
import { DEFAULT_LABELS, parseFeatureFlags, parseLabels } from "./universities";
import { PAGE_SIZE } from "./admin";

/* ------------------------------- Overview ------------------------------- */

export async function getPlatformOverview() {
  const [universities, active, waitlist, students, pendingReviews, waitlistEntries] = await Promise.all([
    platformDb.university.count(),
    platformDb.university.count({ where: { status: "ACTIVE" } }),
    platformDb.university.count({ where: { status: "WAITLIST" } }),
    platformDb.user.count({ where: { status: { in: ["VERIFIED", "ALUMNI"] } } }),
    platformDb.verificationRequest.count({ where: { status: "PENDING" } }),
    platformDb.waitlistEntry.count(),
  ]);
  const recentAudit = await platformDb.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 8,
    select: {
      id: true,
      action: true,
      createdAt: true,
      university: { select: { shortName: true } },
      actor: { select: { fullName: true } },
    },
  });
  const byUniversity = await platformDb.university.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      shortName: true,
      status: true,
      accentColor: true,
      _count: { select: { users: true, verificationRequests: true } },
    },
  });
  return { universities, active, waitlist, students, pendingReviews, waitlistEntries, recentAudit, byUniversity };
}

/* ------------------------------ Universities ----------------------------- */

export interface PlatformUniversity {
  id: string;
  name: string;
  shortName: string;
  slug: string;
  logoUrl: string | null;
  accentColor: string;
  status: UniversityStatus;
  labels: ReturnType<typeof parseLabels>;
  featureFlags: Record<string, boolean>;
  studentEmailDomains: string[];
  idCardEnabled: boolean;
  vouchingEnabled: boolean;
  matricPattern: string;
  policyVersion: string;
  createdAt: Date;
  userCount: number;
  pendingCount: number;
}

function toPlatformUniversity(row: {
  id: string;
  name: string;
  shortName: string;
  slug: string;
  logoUrl: string | null;
  accentColor: string;
  status: UniversityStatus;
  labels: unknown;
  featureFlags: unknown;
  studentEmailDomains: string[];
  idCardEnabled: boolean;
  vouchingEnabled: boolean;
  matricPattern: string;
  policyVersion: string;
  createdAt: Date;
  _count: { users: number; verificationRequests: number };
}): PlatformUniversity {
  return {
    id: row.id,
    name: row.name,
    shortName: row.shortName,
    slug: row.slug,
    logoUrl: row.logoUrl,
    accentColor: row.accentColor,
    status: row.status,
    labels: parseLabels(row.labels),
    featureFlags: parseFeatureFlags(row.featureFlags),
    studentEmailDomains: row.studentEmailDomains,
    idCardEnabled: row.idCardEnabled,
    vouchingEnabled: row.vouchingEnabled,
    matricPattern: row.matricPattern,
    policyVersion: row.policyVersion,
    createdAt: row.createdAt,
    userCount: row._count.users,
    pendingCount: row._count.verificationRequests,
  };
}

export async function listPlatformUniversities(filters: { q?: string; status?: UniversityStatus | "ALL" } = {}) {
  const rows = await platformDb.university.findMany({
    where: {
      ...(filters.status && filters.status !== "ALL" ? { status: filters.status } : {}),
      ...(filters.q?.trim()
        ? {
            OR: [
              { name: { contains: filters.q.trim(), mode: "insensitive" as const } },
              { shortName: { contains: filters.q.trim(), mode: "insensitive" as const } },
              { slug: { contains: filters.q.trim(), mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: [{ status: "asc" }, { name: "asc" }],
    take: 200,
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
      studentEmailDomains: true,
      idCardEnabled: true,
      vouchingEnabled: true,
      matricPattern: true,
      policyVersion: true,
      createdAt: true,
      _count: { select: { users: true, verificationRequests: true } },
    },
  });
  return rows.map(toPlatformUniversity);
}

export async function getPlatformUniversity(id: string) {
  const row = await platformDb.university.findUnique({
    where: { id },
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
      studentEmailDomains: true,
      idCardEnabled: true,
      vouchingEnabled: true,
      matricPattern: true,
      policyVersion: true,
      createdAt: true,
      _count: { select: { users: true, verificationRequests: true } },
      users: {
        where: { roles: { some: { role: { in: ["UNIVERSITY_ADMIN", "REVIEWER"] } } } },
        take: 20,
        select: { id: true, fullName: true, email: true, roles: { select: { role: true } } },
      },
      roleInvites: {
        where: { acceptedAt: null, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: "desc" },
        select: { id: true, email: true, role: true, expiresAt: true },
      },
    },
  });
  return row ? { ...toPlatformUniversity(row), staff: row.users, invites: row.roleInvites } : null;
}

export interface CreateUniversityInput {
  actorId: string;
  name: string;
  shortName: string;
  slug: string;
  accentColor: string;
  matricPattern: string;
  idCardEnabled: boolean;
  vouchingEnabled: boolean;
  studentEmailDomains: string[];
  labels: { college: string; faculty: string; department: string };
  firstAdminEmail?: string;
}

export async function createUniversity(
  input: CreateUniversityInput,
): Promise<{ ok: boolean; error?: string; universityId?: string }> {
  const contrast = checkAccentContrast(input.accentColor);
  if (!contrast.passes) return { ok: false, error: contrast.messages[0] ?? "That accent is not accessible." };
  const slugTaken = await platformDb.university.findUnique({ where: { slug: input.slug }, select: { id: true } });
  if (slugTaken) return { ok: false, error: "That URL slug is already in use." };

  try {
    const university = await platformDb.university.create({
      data: {
        name: input.name.trim(),
        shortName: input.shortName.trim(),
        slug: input.slug,
        accentColor: input.accentColor.toLowerCase(),
        status: "ACTIVE",
        matricPattern: input.matricPattern,
        idCardEnabled: input.idCardEnabled,
        vouchingEnabled: input.vouchingEnabled,
        studentEmailDomains: input.studentEmailDomains,
        labels: input.labels,
        featureFlags: {},
      },
      select: { id: true },
    });
    await writeAudit({
      actorId: input.actorId,
      universityId: university.id,
      action: "platform.university_created",
      targetType: "University",
      targetId: university.id,
      metadata: { name: input.name, slug: input.slug, accentColor: input.accentColor },
    });
    if (input.firstAdminEmail?.trim()) {
      await inviteUniversityAdmin({
        actorId: input.actorId,
        universityId: university.id,
        email: input.firstAdminEmail,
        role: "UNIVERSITY_ADMIN",
      });
    }
    return { ok: true, universityId: university.id };
  } catch (error) {
    console.error("[platform] create university failed", error instanceof Error ? error.message : "unknown");
    return { ok: false, error: "Could not create that university." };
  }
}

export async function setUniversityStatus(input: {
  actorId: string;
  universityId: string;
  status: UniversityStatus;
}): Promise<{ ok: boolean; error?: string }> {
  const university = await platformDb.university.findUnique({
    where: { id: input.universityId },
    select: { id: true, status: true, name: true },
  });
  if (!university) return { ok: false, error: "University not found." };
  if (university.status === input.status) return { ok: true };
  if (input.status === "OFF" && university.status === "WAITLIST") {
    return { ok: false, error: "A university still on the waitlist cannot be switched off." };
  }
  await platformDb.university.update({ where: { id: university.id }, data: { status: input.status } });
  if (input.status !== "ACTIVE") {
    // Removing a space from the app must not leave live sessions behind.
    await platformDb.session.updateMany({
      where: { universityId: university.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  await writeAudit({
    actorId: input.actorId,
    universityId: university.id,
    action: input.status === "ACTIVE" ? "platform.university_activated" : input.status === "OFF" ? "platform.university_switched_off" : "platform.university_waitlisted",
    targetType: "University",
    targetId: university.id,
    metadata: { from: university.status, to: input.status },
  });
  return { ok: true };
}

export async function updateUniversityFeatures(input: {
  actorId: string;
  universityId: string;
  idCardEnabled: boolean;
  vouchingEnabled: boolean;
  featureFlags: Record<string, boolean>;
}): Promise<{ ok: boolean; error?: string }> {
  const university = await platformDb.university.findUnique({
    where: { id: input.universityId },
    select: { id: true, status: true },
  });
  if (!university) return { ok: false, error: "University not found." };
  await platformDb.university.update({
    where: { id: university.id },
    data: {
      idCardEnabled: input.idCardEnabled,
      vouchingEnabled: input.vouchingEnabled,
      featureFlags: input.featureFlags,
    },
  });
  await writeAudit({
    actorId: input.actorId,
    universityId: university.id,
    action: "platform.features_updated",
    targetType: "University",
    targetId: university.id,
    metadata: { ...input.featureFlags, idCardEnabled: input.idCardEnabled, vouchingEnabled: input.vouchingEnabled },
  });
  return { ok: true };
}

const BUILT_IN_FLAGS = [
  { key: "feed", label: "Feed", description: "Posts and the home timeline (Phase 1).", locked: true },
  { key: "communities", label: "Communities", description: "Groups and community pages (Phase 2).", locked: true },
  { key: "events", label: "Events", description: "Campus events and RSVPs (Phase 2).", locked: true },
  { key: "messaging", label: "Messaging", description: "Direct messages (Phase 3).", locked: true },
  { key: "campusVoice", label: "Campus Voice", description: "Anonymous campus polls (Phase 3).", locked: true },
  { key: "marketplace", label: "Marketplace", description: "Student marketplace (Phase 4).", locked: true },
];

export function featureFlagOptions(flags: Record<string, boolean>) {
  return BUILT_IN_FLAGS.map((flag) => ({ ...flag, enabled: Boolean(flags[flag.key]) }));
}

/* ------------------------------- Waitlist -------------------------------- */

export async function listWaitlist(filters: { kind?: "UNIVERSITY" | "STUDENT" | "ALL"; page: number }) {
  const page = Math.max(1, Math.trunc(filters.page) || 1);
  const where = filters.kind && filters.kind !== "ALL" ? { kind: filters.kind } : {};
  const [rows, total] = await Promise.all([
    platformDb.waitlistEntry.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: { id: true, kind: true, universityName: true, email: true, createdAt: true },
    }),
    platformDb.waitlistEntry.count({ where }),
  ]);
  return { rows, total, page, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function waitlistCsv(): Promise<string> {
  const rows = await platformDb.waitlistEntry.findMany({
    orderBy: { createdAt: "asc" },
    take: 5000,
    select: { kind: true, universityName: true, email: true, createdAt: true },
  });
  const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const lines = ["kind,university,email,created_at"];
  for (const row of rows) {
    lines.push(
      [row.kind, row.universityName ?? "", row.email, row.createdAt.toISOString()].map(escape).join(","),
    );
  }
  return lines.join("\n");
}

/* --------------------------------- Audit --------------------------------- */

export async function queryAudit(filters: {
  action?: string;
  universityId?: string;
  page: number;
}) {
  const page = Math.max(1, Math.trunc(filters.page) || 1);
  const where = {
    ...(filters.action?.trim()
      ? { action: { contains: filters.action.trim(), mode: "insensitive" as const } }
      : {}),
    ...(filters.universityId ? { universityId: filters.universityId } : {}),
  };
  const [rows, total, universities] = await Promise.all([
    platformDb.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        action: true,
        targetType: true,
        targetId: true,
        metadata: true,
        createdAt: true,
        actor: { select: { fullName: true, email: true } },
        university: { select: { shortName: true } },
      },
    }),
    platformDb.auditLog.count({ where }),
    platformDb.university.findMany({ orderBy: { name: "asc" }, select: { id: true, shortName: true } }),
  ]);
  return {
    rows,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    universities,
  };
}

/* --------------------------------- Health -------------------------------- */

export interface HealthCheck {
  key: string;
  label: string;
  status: "ok" | "warn" | "fail";
  detail: string;
}

export async function getPlatformHealth(): Promise<{ checks: HealthCheck[]; latencyMs: number; nodeEnv: string }> {
  const started = performance.now();
  let dbStatus: HealthCheck = { key: "database", label: "Postgres", status: "ok", detail: "Reachable" };
  try {
    await platformDb.$queryRaw`SELECT 1`;
  } catch {
    dbStatus = { key: "database", label: "Postgres", status: "fail", detail: "Cannot reach the database" };
  }
  const latencyMs = Math.round(performance.now() - started);

  const checks: HealthCheck[] = [
    dbStatus,
    {
      key: "email",
      label: "Transactional email",
      status: hasResend ? "ok" : isProduction ? "fail" : "warn",
      detail: hasResend ? `Resend · ${env.EMAIL_FROM}` : isProduction ? "RESEND_API_KEY missing" : "Capture outbox (development)",
    },
    {
      key: "media",
      label: "Private ID storage",
      status: hasCloudinary ? "ok" : isProduction ? "fail" : "warn",
      detail: hasCloudinary ? "Cloudinary authenticated assets" : isProduction ? "Cloudinary credentials missing" : "Local private dir (development)",
    },
    {
      key: "rate-limit",
      label: "Rate limiting",
      status: env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN ? "ok" : isProduction ? "fail" : "warn",
      detail: env.UPSTASH_REDIS_REST_URL ? "Upstash sliding window" : "In-memory (development)",
    },
    {
      key: "bot-protection",
      label: "Bot protection",
      status: env.TURNSTILE_BYPASS ? "warn" : env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ? "ok" : "fail",
      detail: env.TURNSTILE_BYPASS ? "Turnstile bypassed locally" : "Cloudflare Turnstile",
    },
    {
      key: "errors",
      label: "Error monitoring",
      status: env.NEXT_PUBLIC_SENTRY_DSN ? "ok" : "warn",
      detail: env.NEXT_PUBLIC_SENTRY_DSN ? "Sentry configured" : "Sentry DSN not set",
    },
    {
      key: "audit",
      label: "Audit trail",
      status: "ok",
      detail: "Append-only · DB-enforced",
    },
  ];
  return { checks, latencyMs, nodeEnv: env.NODE_ENV };
}

/** Invite a university admin (also used when the platform creates a space). */
export async function inviteUniversityAdmin(input: {
  actorId: string;
  universityId: string;
  email: string;
  role?: Role;
}): Promise<{ ok: boolean; error?: string }> {
  const university = await platformDb.university.findUnique({
    where: { id: input.universityId },
    select: { name: true, status: true },
  });
  if (!university) return { ok: false, error: "University not found." };
  if (university.status !== "ACTIVE") {
    return { ok: false, error: "Activate the university before inviting its first admin." };
  }
  const email = input.email.trim().toLowerCase();
  const role = input.role ?? "UNIVERSITY_ADMIN";
  const pending = await platformDb.roleInvite.findFirst({
    where: { universityId: input.universityId, email, role, acceptedAt: null, expiresAt: { gt: new Date() } },
    select: { id: true },
  });
  if (pending) return { ok: false, error: "An invitation is already pending for that email." };
  const token = randomToken(32);
  await platformDb.roleInvite.create({
    data: {
      universityId: input.universityId,
      email,
      role,
      tokenHash: sha256(token),
      invitedBy: input.actorId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
  await sendUniversityInvite(email, {
    universityName: university.name,
    roleLabel: role.replaceAll("_", " ").toLowerCase(),
    url: `${env.APP_URL}/invite/${token}`,
  });
  await writeAudit({
    actorId: input.actorId,
    universityId: input.universityId,
    action: "platform.admin_invited",
    targetType: "RoleInvite",
    targetId: email,
    metadata: { role },
  });
  return { ok: true };
}

export { DEFAULT_LABELS };
