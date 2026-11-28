import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { tenantDb } from "@/lib/db/tenant";
import { rateLimit } from "@/lib/security/rate-limit";
import { listAcademicNodes } from "@/lib/services/academic";
import { lineageFor } from "@/lib/services/student-path";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";

/**
 * Machine-readable export of the user's own data (NDPA 2023 access right).
 * Deliberately excludes password hashes, session tokens, CSRF secrets and ID
 * image references: those are security material, not user content.
 */
export async function GET(): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Log in first." }, { status: 401 });
  const user = session.user;

  const limit = await rateLimit("dataExport", user.id);
  if (!limit.success) {
    return NextResponse.json({ error: "Exports are limited to 3 per day." }, { status: 429 });
  }

  const db = tenantDb(user.universityId);
  const [account, requests, sessions, audit, nodes, drafts] = await Promise.all([
    db.user.findFirst({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        emailVerified: true,
        username: true,
        fullName: true,
        photoUrl: true,
        bio: true,
        status: true,
        matricNumber: true,
        level: true,
        isPostgraduate: true,
        interests: true,
        consentPolicyVersion: true,
        consentAcceptedAt: true,
        departmentVisibility: true,
        levelVisibility: true,
        createdAt: true,
        lastActiveAt: true,
        verifiedAt: true,
      },
    }),
    db.verificationRequest.findMany({
      where: { userId: user.id },
      select: {
        method: true,
        status: true,
        matricNumber: true,
        createdAt: true,
        decidedAt: true,
        decisionReason: true,
        decisionNote: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    db.session.findMany({
      where: { userId: user.id },
      select: { createdAt: true, lastSeenAt: true, expiresAt: true, revokedAt: true, userAgent: true },
      orderBy: { createdAt: "asc" },
    }),
    db.auditLog.findMany({
      where: { actorId: user.id },
      select: { action: true, targetType: true, targetId: true, createdAt: true, metadata: true },
      orderBy: { createdAt: "asc" },
      take: 500,
    }),
    listAcademicNodes(user.universityId),
    db.draft.findMany({
      where: { userId: user.id },
      select: { type: true, contextKey: true, payload: true, audience: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const lineage = user.departmentNodeId ? lineageFor(nodes, user.departmentNodeId) : null;

  const payload = {
    exportVersion: 1,
    generatedAt: new Date().toISOString(),
    notice:
      "This file contains the personal data Konnekt holds about you. ID card images are deleted after review and are not included. Passwords and session secrets are never exported.",
    university: {
      name: user.university.name,
      shortName: user.university.shortName,
      slug: user.university.slug,
    },
    account,
    academic: lineage
      ? {
          college: lineage.college?.name ?? null,
          faculty: lineage.faculty?.name ?? null,
          department: lineage.department?.name ?? null,
        }
      : null,
    verificationHistory: requests,
    drafts,
    sessions,
    auditTrail: audit,
  };

  await writeAudit({
    actorId: user.id,
    universityId: user.universityId,
    action: "account.data_exported",
    targetType: "User",
    targetId: user.id,
  }).catch(() => undefined);

  const filename = `konnekt-data-${user.username}-${new Date().toISOString().slice(0, 10)}.json`;
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
