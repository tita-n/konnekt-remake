import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { platformDb } from "@/lib/db/platform";
import { tenantDb } from "@/lib/db/tenant";
import { buildStudentPath } from "@/lib/domain/academic";
import { DraftConflict } from "@/lib/posts/errors";
import {
  deleteDraft,
  getDraftForContext,
  listDrafts,
  saveDraft,
} from "@/lib/services/posts";
import type { SocialViewer } from "@/lib/services/social";

const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
let universityId: string;
let otherUniversityId: string;
let first: SocialViewer;
let second: SocialViewer;
let otherTenant: SocialViewer;

function viewer(input: { id: string; universityId: string; departmentId: string; username: string }): SocialViewer {
  return {
    userId: input.id,
    universityId: input.universityId,
    studentPath: buildStudentPath({
      universityId: input.universityId,
      department: { id: input.departmentId, name: "Software Engineering" },
      level: 300,
    }),
    departmentId: input.departmentId,
    level: 300,
    username: input.username,
    fullName: input.username,
    photoUrl: null,
    labels: { college: "College", faculty: "Faculty", department: "Department" },
    lineage: { college: null, faculty: null, department: "Software Engineering" },
    accountAgeHours: 72,
    interests: [],
    isUniversityStaff: false,
    isUniversityAdmin: false,
    isUniversityModerator: false,
    timezone: "Africa/Lagos",
    showEventAttendance: true,
  };
}

async function seedUniversity(prefix: string) {
  const university = await platformDb.university.create({
    data: {
      name: `Draft ${prefix} ${suffix}`,
      shortName: `D${prefix.toUpperCase()}`,
      slug: `draft-${prefix}-${suffix}`,
      status: "ACTIVE",
      matricPattern: "^[A-Z]{3}/\\d{4}/\\d{3,4}$",
      studentEmailDomains: [`${prefix}-${suffix}.edu.ng`],
      labels: { department: "Department" },
    },
    select: { id: true },
  });
  const db = tenantDb(university.id);
  const department = await db.academicNode.create({
    data: {
      universityId: university.id,
      type: "DEPARTMENT",
      name: "Software Engineering",
      slug: `swe-d-${prefix}-${suffix}`,
      levels: [100, 200, 300, 400],
    },
    select: { id: true },
  });
  return { universityId: university.id, departmentId: department.id };
}

async function makeUser(university: string, department: string, label: string) {
  return tenantDb(university).user.create({
    data: {
      universityId: university,
      email: `${label}-${suffix}@${university.slice(-4)}.edu.ng`,
      username: `${label}${suffix}`.slice(0, 30),
      fullName: `${label} Student`,
      passwordHash: "not-a-real-hash",
      emailVerified: true,
      status: "VERIFIED",
      consentPolicyVersion: "2026-01-01",
      consentAcceptedAt: new Date(),
      departmentNodeId: department,
      level: 300,
      onboardingCompletedAt: new Date(),
      verifiedAt: new Date(),
    },
    select: { id: true },
  });
}

function payload(body = "Draft body") {
  return { body };
}

beforeAll(async () => {
  const a = await seedUniversity("a");
  universityId = a.universityId;
  const b = await seedUniversity("b");
  otherUniversityId = b.universityId;
  const firstRow = await makeUser(universityId, a.departmentId, "first");
  const secondRow = await makeUser(universityId, a.departmentId, "second");
  const otherRow = await makeUser(otherUniversityId, b.departmentId, "other");
  first = viewer({ id: firstRow.id, universityId, departmentId: a.departmentId, username: `first${suffix}` });
  second = viewer({ id: secondRow.id, universityId, departmentId: a.departmentId, username: `second${suffix}` });
  otherTenant = viewer({
    id: otherRow.id,
    universityId: otherUniversityId,
    departmentId: b.departmentId,
    username: `other${suffix}`,
  });
});

afterAll(async () => {
  await platformDb.university.deleteMany({ where: { id: { in: [universityId, otherUniversityId] } } }).catch(() => undefined);
});

describe("draft upserts", () => {
  it("is idempotent per client draft id and increments the version", async () => {
    const clientDraftId = `client-${suffix}-once`;
    const created = await saveDraft(first, {
      clientDraftId,
      type: "POST",
      payload: payload("First save"),
      audience: { id: "level:300", label: "My level" },
    });
    const updated = await saveDraft(first, {
      clientDraftId,
      type: "POST",
      payload: payload("Second save"),
      audience: { id: "level:300", label: "My level" },
    });
    expect(updated.id).toBe(created.id);
    expect(updated.version).toBeGreaterThan(created.version);
    expect(updated.payload.body).toBe("Second save");
    const db = tenantDb(universityId);
    expect(await db.draft.count({ where: { userId: first.userId, clientDraftId } })).toBe(1);
  });

  it("rejects a stale version and accepts a newer one", async () => {
    const clientDraftId = `client-${suffix}-stale`;
    await saveDraft(first, {
      clientDraftId,
      type: "POST",
      version: 2,
      clientUpdatedAt: new Date(Date.now() - 10_000).toISOString(),
      payload: payload("Newer tab"),
      audience: { id: "level:300", label: "My level" },
    });
    await expect(
      saveDraft(first, {
        clientDraftId,
        type: "POST",
        version: 1,
        clientUpdatedAt: new Date().toISOString(),
        payload: payload("Stale tab"),
        audience: { id: "level:300", label: "My level" },
      }),
    ).rejects.toBeInstanceOf(DraftConflict);
    const newer = await saveDraft(first, {
      clientDraftId,
      type: "POST",
      version: 2,
      clientUpdatedAt: new Date().toISOString(),
      payload: payload("Tab caught up"),
      audience: { id: "level:300", label: "My level" },
    });
    expect(newer.payload.body).toBe("Tab caught up");
  });

  it("returns null for another account's draft and keeps tenants apart", async () => {
    const clientDraftId = `client-${suffix}-tenant`;
    await saveDraft(first, {
      clientDraftId,
      type: "POST",
      payload: payload("Private to first"),
      audience: { id: "level:300", label: "My level" },
    });
    await saveDraft(otherTenant, {
      clientDraftId,
      type: "POST",
      payload: payload("Private to other tenant"),
      audience: { id: "level:300", label: "My level" },
    });
    const secondList = await listDrafts(second);
    expect(secondList.some((draft) => draft.clientDraftId === clientDraftId)).toBe(false);
    const otherList = await listDrafts(otherTenant);
    expect(otherList.find((draft) => draft.clientDraftId === clientDraftId)?.payload.body).toBe(
      "Private to other tenant",
    );
    expect(await deleteDraft(second, clientDraftId)).toEqual({ deleted: false });
  });

  it("purges drafts older than 30 days", async () => {
    const clientDraftId = `client-${suffix}-old`;
    await saveDraft(first, {
      clientDraftId,
      type: "POST",
      payload: payload("Old draft"),
      audience: { id: "level:300", label: "My level" },
    });
    await platformDb.$executeRawUnsafe(
      `UPDATE "Draft" SET "updatedAt" = now() - interval '40 days' WHERE "clientDraftId" = $1 AND "userId" = $2`,
      clientDraftId,
      first.userId,
    );
    const drafts = await listDrafts(first);
    expect(drafts.some((draft) => draft.clientDraftId === clientDraftId)).toBe(false);
  });

  it("restores the newest draft for a context but not one older than seven days", async () => {
    const contextKey = `context-${suffix}`;
    await saveDraft(first, {
      clientDraftId: `client-${suffix}-ctx-old`,
      type: "POST",
      contextKey,
      payload: payload("Old context"),
      audience: { id: "level:300", label: "My level" },
    });
    await platformDb.$executeRawUnsafe(
      `UPDATE "Draft" SET "updatedAt" = now() - interval '10 days' WHERE "clientDraftId" = $1`,
      `client-${suffix}-ctx-old`,
    );
    expect(await getDraftForContext(first, contextKey)).toBeNull();
    await saveDraft(first, {
      clientDraftId: `client-${suffix}-ctx-new`,
      type: "POST",
      contextKey,
      payload: payload("Fresh context"),
      audience: { id: "level:300", label: "My level" },
    });
    expect((await getDraftForContext(first, contextKey))?.payload.body).toBe("Fresh context");
  });

  it("caps a student at 20 drafts", async () => {
    const quotaViewerRow = await makeUser(universityId, (await tenantDb(universityId).academicNode.findFirst({
      where: { universityId, type: "DEPARTMENT" },
      select: { id: true },
    }))!.id, "quota");
    const quotaViewer = viewer({
      id: quotaViewerRow.id,
      universityId,
      departmentId: (await tenantDb(universityId).academicNode.findFirst({
        where: { universityId, type: "DEPARTMENT" },
        select: { id: true },
      }))!.id,
      username: `quota${suffix}`,
    });
    for (let index = 0; index < 20; index += 1) {
      await saveDraft(quotaViewer, {
        clientDraftId: `quota-${suffix}-${index}`,
        type: "POST",
        payload: payload(`Draft ${index}`),
        audience: { id: "level:300", label: "My level" },
      });
    }
    await expect(
      saveDraft(quotaViewer, {
        clientDraftId: `quota-${suffix}-overflow`,
        type: "POST",
        payload: payload("One too many"),
        audience: { id: "level:300", label: "My level" },
      }),
    ).rejects.toThrow(/20 saved drafts/i);
  });
});
