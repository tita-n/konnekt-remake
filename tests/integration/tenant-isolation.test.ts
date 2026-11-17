import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { platformDb } from "@/lib/db/platform";
import { tenantDb } from "@/lib/db/tenant";
import { decideVerification } from "@/lib/services/verification";
import { acceptRoleInvite, inviteRole } from "@/lib/services/admin";
import { lastOutboxMessage } from "@/lib/email";
import { sha256 } from "@/lib/crypto";

const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
let universityA: { id: string };
let universityB: { id: string };
let userA: { id: string };
let userB: { id: string };

beforeAll(async () => {
  universityA = await platformDb.university.create({
    data: {
      name: `Isolation A ${suffix}`,
      shortName: "ISO-A",
      slug: `isolation-a-${suffix}`,
      status: "ACTIVE",
      matricPattern: "^[A-Z]{3}/\\d{4}/\\d{3,4}$",
      studentEmailDomains: [`a-${suffix}.edu.ng`],
      labels: {},
    },
    select: { id: true },
  });
  universityB = await platformDb.university.create({
    data: {
      name: `Isolation B ${suffix}`,
      shortName: "ISO-B",
      slug: `isolation-b-${suffix}`,
      status: "ACTIVE",
      matricPattern: "^[A-Z]{3}/\\d{4}/\\d{3,4}$",
      studentEmailDomains: [`b-${suffix}.edu.ng`],
      labels: {},
    },
    select: { id: true },
  });

  const base = {
    passwordHash: "not-a-real-hash",
    emailVerified: true,
    status: "VERIFIED" as const,
    consentPolicyVersion: "2026-01-01",
    consentAcceptedAt: new Date(),
  };
  userA = await platformDb.user.create({
    data: {
      ...base,
      universityId: universityA.id,
      email: `student-a-${suffix}@a-${suffix}.edu.ng`,
      username: `studenta${suffix}`.slice(0, 20),
      fullName: "Student Alpha",
      matricNumber: "AAA/2024/100",
      matricNormalized: "AAA/2024/100",
      level: 300,
      verifiedAt: new Date(),
    },
    select: { id: true },
  });
  userB = await platformDb.user.create({
    data: {
      ...base,
      universityId: universityB.id,
      email: `student-b-${suffix}@b-${suffix}.edu.ng`,
      username: `studentb${suffix}`.slice(0, 20),
      fullName: "Student Beta",
      matricNumber: "BBB/2024/200",
      matricNormalized: "BBB/2024/200",
      level: 200,
      verifiedAt: new Date(),
    },
    select: { id: true },
  });
});

afterAll(async () => {
  await platformDb.$disconnect();
});

describe("tenant isolation", () => {
  it("only returns rows for the bound university", async () => {
    const a = await tenantDb(universityA.id).user.findMany({ select: { id: true, universityId: true } });
    expect(a.length).toBeGreaterThan(0);
    expect(a.every((row) => row.universityId === universityA.id)).toBe(true);

    const bRows = await tenantDb(universityB.id).user.findMany({ select: { universityId: true } });
    expect(bRows.every((row) => row.universityId === universityB.id)).toBe(true);
  });

  it("cannot read another university's user even with the exact id", async () => {
    const found = await tenantDb(universityA.id).user.findFirst({ where: { id: userB.id } });
    expect(found).toBeNull();
    const byEmail = await tenantDb(universityA.id).user.findFirst({ where: { email: `student-b-${suffix}@b-${suffix}.edu.ng` } });
    expect(byEmail).toBeNull();
  });

  it("refuses a write that names another university", async () => {
    await expect(
      tenantDb(universityA.id).user.create({
        data: {
          universityId: universityB.id,
          email: `cross-${suffix}@evil.edu.ng`,
          username: `cross${suffix}`.slice(0, 20),
          fullName: "Cross Tenant",
          passwordHash: "x",
        },
      }),
    ).rejects.toThrow(/refusing to write/i);
  });

  it("cannot touch platform-owned models through the tenant client", () => {
    expect(() => (tenantDb(universityA.id) as unknown as Record<string, unknown>).university).toThrow(/not tenant-scoped/i);
    expect(() => (tenantDb(universityA.id) as unknown as Record<string, unknown>).waitlistEntry).toThrow(/not tenant-scoped/i);
  });

  it("scopes counts and updates", async () => {
    const count = await tenantDb(universityA.id).user.count();
    const globalCount = await platformDb.user.count();
    expect(count).toBeLessThan(globalCount);
    const updated = await tenantDb(universityA.id).user.updateMany({
      where: { id: userB.id },
      data: { bio: "should never apply" },
    });
    expect(updated.count).toBe(0);
    expect((await platformDb.user.findUnique({ where: { id: userB.id }, select: { bio: true } }))?.bio).toBeNull();
  });
});

describe("database-level guarantees", () => {
  it("enforces one verified student per matric number per university", async () => {
    const duplicate = await platformDb.user.create({
      data: {
        universityId: universityA.id,
        email: `dup-${suffix}@a-${suffix}.edu.ng`,
        username: `dup${suffix}`.slice(0, 20),
        fullName: "Duplicate Matric",
        passwordHash: "x",
        status: "UNVERIFIED",
        matricNumber: "AAA/2024/100",
        matricNormalized: "AAA/2024/100",
      },
      select: { id: true },
    });
    await expect(
      platformDb.user.update({ where: { id: duplicate.id }, data: { status: "VERIFIED" } }),
    ).rejects.toThrow();
    // The same matric number is fine at a different university.
    const otherUniversity = await platformDb.user.create({
      data: {
        universityId: universityB.id,
        email: `same-matric-${suffix}@b-${suffix}.edu.ng`,
        username: `same${suffix}`.slice(0, 20),
        fullName: "Same Matric Other Uni",
        passwordHash: "x",
        status: "VERIFIED",
        matricNumber: "AAA/2024/100",
        matricNormalized: "AAA/2024/100",
        verifiedAt: new Date(),
      },
      select: { id: true },
    });
    expect(otherUniversity.id).toBeTruthy();
  });

  it("allows only one pending verification request per user", async () => {
    const data = {
      universityId: universityA.id,
      userId: userA.id,
      method: "ID_CARD" as const,
      matricNumber: "AAA/2024/100",
      matricNormalized: "AAA/2024/100",
      status: "PENDING" as const,
    };
    await platformDb.verificationRequest.create({ data });
    await expect(platformDb.verificationRequest.create({ data })).rejects.toThrow();
  });

  it("keeps the audit log append-only at the database level", async () => {
    const event = await platformDb.auditLog.findFirst({
      where: { actorId: userA.id },
      select: { id: true },
    });
    // No audit event is required for this user; create one through the write path used in production.
    if (!event) {
      await platformDb.auditLog.create({
        data: {
          actorId: userA.id,
          universityId: universityA.id,
          action: "test.append_only",
          targetType: "User",
          targetId: userA.id,
          metadata: {},
        },
      });
    }
    await expect(
      platformDb.$executeRawUnsafe(`UPDATE "AuditLog" SET action = 'tampered'`),
    ).rejects.toThrow();
    await expect(platformDb.$executeRawUnsafe(`DELETE FROM "AuditLog"`)).rejects.toThrow();
  });
});

describe("verification decisions", () => {
  it("approves a pending request exactly once and clears the image reference", async () => {
    const user = await platformDb.user.create({
      data: {
        universityId: universityA.id,
        email: `approve-${suffix}@a-${suffix}.edu.ng`,
        username: `approve${suffix}`.slice(0, 20),
        fullName: "Approve Me",
        passwordHash: "x",
        status: "PENDING",
        matricNumber: "AAA/2024/555",
        matricNormalized: "AAA/2024/555",
      },
      select: { id: true, email: true },
    });
    const request = await platformDb.verificationRequest.create({
      data: {
        universityId: universityA.id,
        userId: user.id,
        method: "ID_CARD",
        matricNumber: "AAA/2024/555",
        matricNormalized: "AAA/2024/555",
        idImageRef: "local:does-not-exist",
        status: "PENDING",
      },
      select: { id: true },
    });

    const result = await decideVerification({
      requestId: request.id,
      reviewerId: userA.id,
      universityId: universityA.id,
      approve: true,
      reviewerRoles: ["REVIEWER"],
    });
    expect(result, JSON.stringify(result)).toMatchObject({ ok: true });
    expect((await platformDb.user.findUnique({ where: { id: user.id }, select: { status: true } }))?.status).toBe("VERIFIED");
    expect(
      (await platformDb.verificationRequest.findUnique({ where: { id: request.id }, select: { idImageRef: true, status: true } }))
        ?.idImageRef,
    ).toBeNull();

    const again = await decideVerification({
      requestId: request.id,
      reviewerId: userA.id,
      universityId: universityA.id,
      approve: true,
      reviewerRoles: ["REVIEWER"],
    });
    expect(again.ok).toBe(false);
  });

  it("does not allow a reviewer from another university to decide", async () => {
    const user = await platformDb.user.create({
      data: {
        universityId: universityA.id,
        email: `cross-review-${suffix}@a-${suffix}.edu.ng`,
        username: `crossrev${suffix}`.slice(0, 20),
        fullName: "Cross Review",
        passwordHash: "x",
        status: "PENDING",
        matricNumber: "AAA/2024/556",
        matricNormalized: "AAA/2024/556",
      },
      select: { id: true },
    });
    const request = await platformDb.verificationRequest.create({
      data: {
        universityId: universityA.id,
        userId: user.id,
        method: "ID_CARD",
        matricNumber: "AAA/2024/556",
        matricNormalized: "AAA/2024/556",
        status: "PENDING",
      },
      select: { id: true },
    });
    const result = await decideVerification({
      requestId: request.id,
      reviewerId: userB.id,
      universityId: universityB.id,
      approve: true,
      reviewerRoles: ["UNIVERSITY_ADMIN"],
    });
    expect(result.ok).toBe(false);
  });
});

describe("role invitations", () => {
  it("binds acceptance to the invited email and is single use", async () => {
    const email = `reviewer-${suffix}@a-${suffix}.edu.ng`;
    const invited = await inviteRole({
      actorId: userA.id,
      universityId: universityA.id,
      email,
      role: "REVIEWER",
    });
    expect(invited.ok).toBe(true);

    const message = lastOutboxMessage(email);
    expect(message).toBeTruthy();
    const token = message?.text.match(/\/invite\/([A-Za-z0-9_-]+)/)?.[1];
    expect(token).toBeTruthy();

    const invite = await platformDb.roleInvite.findUnique({ where: { tokenHash: sha256(token!) } });
    expect(invite?.role).toBe("REVIEWER");

    const wrong = await acceptRoleInvite({ token: token!, userId: userB.id, userEmail: `student-b-${suffix}@b-${suffix}.edu.ng` });
    expect(wrong.ok).toBe(false);

    const accepted = await acceptRoleInvite({ token: token!, userId: userA.id, userEmail: email });
    expect(accepted.ok).toBe(true);
    const assignment = await platformDb.roleAssignment.findFirst({
      where: { userId: userA.id, universityId: universityA.id, role: "REVIEWER" },
    });
    expect(assignment).not.toBeNull();

    const reused = await acceptRoleInvite({ token: token!, userId: userA.id, userEmail: email });
    expect(reused.ok).toBe(false);
  });
});
