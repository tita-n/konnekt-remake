import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { platformDb } from "@/lib/db/platform";
import { tenantDb } from "@/lib/db/tenant";
import { buildStudentPath } from "@/lib/domain/academic";
import type { SessionUser } from "@/lib/auth/session";
import { moderateReport } from "@/lib/services/moderation";
import { getAuthorPosts, getFeed, repostPost, undoRepost } from "@/lib/services/posts";
import type { SocialViewer } from "@/lib/services/social";

const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
let universityId: string;
let otherTenantUniversityId: string;
let departmentId: string;
let otherDepartmentId: string;
let author: SocialViewer;
let reposter: SocialViewer;
let other: SocialViewer;
let outsider: SocialViewer;
let otherTenant: SocialViewer;
let publicPostId: string;
let levelPostId: string;

function viewer(input: { id: string; username: string; universityId?: string; departmentId?: string }): SocialViewer {
  const uni = input.universityId ?? universityId;
  const dept = input.departmentId ?? departmentId;
  return {
    userId: input.id,
    universityId: uni,
    studentPath: buildStudentPath({
      universityId: uni,
      department: { id: dept, name: "Software Engineering" },
      level: 300,
    }),
    departmentId: dept,
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
  return platformDb.university.create({
    data: {
      name: `Repost ${prefix} ${suffix}`,
      shortName: `R${prefix.toUpperCase()}`,
      slug: `repost-${prefix}-${suffix}`,
      status: "ACTIVE",
      matricPattern: "^[A-Z]{3}/\\d{4}/\\d{3,4}$",
      studentEmailDomains: [`${prefix}-${suffix}.edu.ng`],
      labels: { department: "Department" },
    },
    select: { id: true },
  });
}

async function makeUser(university: string, department: string, label: string) {
  const db = tenantDb(university);
  return db.user.create({
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

async function makePost(authorId: string, audiencePath: string[], body = "Original post") {
  const db = tenantDb(universityId);
  return db.post.create({
    data: {
      universityId,
      authorId,
      type: "POST",
      body,
      audiencePath,
      audienceKind: audiencePath[0] === "PUBLIC" ? "PUBLIC" : "LEVEL",
    },
    select: { id: true },
  });
}

beforeAll(async () => {
  universityId = (await seedUniversity("a")).id;
  const db = tenantDb(universityId);
  const department = await db.academicNode.create({
    data: {
      universityId,
      type: "DEPARTMENT",
      name: "Software Engineering",
      slug: `swe-r-${suffix}`,
      levels: [100, 200, 300, 400],
    },
    select: { id: true },
  });
  departmentId = department.id;
  const otherDepartment = await db.academicNode.create({
    data: {
      universityId,
      type: "DEPARTMENT",
      name: "Civil Engineering",
      slug: `cve-r-${suffix}`,
      levels: [100, 200, 300, 400],
    },
    select: { id: true },
  });
  otherDepartmentId = otherDepartment.id;

  const authorRow = await makeUser(universityId, departmentId, "author");
  const reposterRow = await makeUser(universityId, departmentId, "reposter");
  const otherRow = await makeUser(universityId, departmentId, "other");
  const outsiderRow = await makeUser(universityId, otherDepartmentId, "outsider");
  const otherTenantUniversity = await seedUniversity("b");
  otherTenantUniversityId = otherTenantUniversity.id;
  const otherTenantDb = tenantDb(otherTenantUniversityId);
  const otherTenantDepartment = await otherTenantDb.academicNode.create({
    data: {
      universityId: otherTenantUniversity.id,
      type: "DEPARTMENT",
      name: "Software Engineering",
      slug: `swe-rb-${suffix}`,
      levels: [100, 200, 300, 400],
    },
    select: { id: true },
  });
  const otherTenantRow = await makeUser(otherTenantUniversity.id, otherTenantDepartment.id, "tenantb");
  author = viewer({ id: authorRow.id, username: `author${suffix}` });
  reposter = viewer({ id: reposterRow.id, username: `reposter${suffix}` });
  other = viewer({ id: otherRow.id, username: `other${suffix}` });
  outsider = viewer({ id: outsiderRow.id, username: `outsider${suffix}`, departmentId: otherDepartmentId });
  otherTenant = viewer({
    id: otherTenantRow.id,
    username: `tenantb${suffix}`,
    universityId: otherTenantUniversity.id,
    departmentId: otherTenantDepartment.id,
  });

  publicPostId = (await makePost(author.userId, ["PUBLIC"], "Public post")).id;
  levelPostId = (
    await makePost(author.userId, [universityId, departmentId, "300"], "Level post")
  ).id;
});

afterAll(async () => {
  await platformDb.university
    .deleteMany({ where: { id: { in: [universityId, otherTenantUniversityId] } } })
    .catch(() => undefined);
});

describe("plain reposts", () => {
  it("creates exactly one repost per user under concurrent requests and counts distinct users", async () => {
    const [first, second] = await Promise.all([
      repostPost(reposter, publicPostId),
      repostPost(reposter, publicPostId),
    ]);
    expect(first.id).toBe(second.id);
    const db = tenantDb(universityId);
    const rows = await db.post.findMany({
      where: { authorId: reposter.userId, repostOfId: publicPostId, repostKind: "PLAIN", status: "ACTIVE" },
      select: { id: true },
    });
    expect(rows).toHaveLength(1);
    const original = await db.post.findFirst({ where: { id: publicPostId }, select: { repostCount: true } });
    expect(original?.repostCount).toBe(1);
  });

  it("undoes exactly once and is idempotent", async () => {
    expect(await undoRepost(reposter, publicPostId)).toEqual({ undone: true });
    expect(await undoRepost(reposter, publicPostId)).toEqual({ undone: false });
    const db = tenantDb(universityId);
    const original = await db.post.findFirst({ where: { id: publicPostId }, select: { repostCount: true } });
    expect(original?.repostCount).toBe(0);
  });

  it("refuses to repost your own post", async () => {
    await expect(repostPost(author, publicPostId)).rejects.toThrow(/your own post/i);
  });

  it("cannot repost what the viewer cannot see", async () => {
    await expect(repostPost(outsider, levelPostId)).rejects.toThrow(/isn't available/i);
  });

  it("cannot reach another tenant's post through the repost endpoint", async () => {
    await expect(repostPost(otherTenant, publicPostId)).rejects.toThrow(/isn't available/i);
    await expect(repostPost(otherTenant, levelPostId)).rejects.toThrow(/isn't available/i);
  });

  it("cannot repost a blocked author's post", async () => {
    const db = tenantDb(universityId);
    await db.block.create({ data: { universityId, userId: other.userId, blockedUserId: author.userId } });
    await expect(repostPost(other, publicPostId)).rejects.toThrow(/isn't available/i);
    await db.block.deleteMany({ where: { userId: other.userId, blockedUserId: author.userId } });
  });

  it("reposting a repost targets the original", async () => {
    const quote = await repostPost(other, publicPostId, "My take on this");
    await repostPost(reposter, quote.id);
    const db = tenantDb(universityId);
    const row = await db.post.findFirst({
      where: { authorId: reposter.userId, repostKind: "PLAIN", status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      select: { repostOfId: true },
    });
    expect(row?.repostOfId).toBe(publicPostId);
  });
});

describe("quotes and feeds", () => {
  it("allows one quote per user/original and puts it in the feed", async () => {
    const quote = await repostPost(reposter, levelPostId, "Quoting this level post");
    await expect(repostPost(reposter, levelPostId, "Second quote")).rejects.toThrow(/already quoted/i);
    const feed = await getFeed(reposter, "all", null, 20);
    const row = feed.posts.find((post) => post.id === quote.id);
    expect(row?.body).toBe("Quoting this level post");
    expect(row?.repostOf?.id).toBe(levelPostId);
  });

  it("keeps plain reposts out of the feed and shows each original once", async () => {
    await repostPost(other, levelPostId);
    const feed = await getFeed(other, "all", null, 50);
    const originals = feed.posts.filter((post) => post.id === levelPostId);
    expect(originals).toHaveLength(1);
    const plain = await tenantDb(universityId).post.findFirst({
      where: { authorId: other.userId, repostOfId: levelPostId, repostKind: "PLAIN", status: "ACTIVE" },
      select: { id: true },
    });
    expect(feed.posts.some((post) => post.id === plain?.id)).toBe(false);
  });

  it("shows the plain repost on the reposter's profile", async () => {
    const profile = await getAuthorPosts(reposter, reposter.userId, 30);
    expect(profile.some((post) => post.type === "REPOST" && post.repostOf?.id === levelPostId)).toBe(true);
  });
});

describe("moderator removal", () => {
  it("decrements a plain repost counter without changing the community post count", async () => {
    const db = tenantDb(universityId);
    const community = await db.community.create({
      data: {
        universityId,
        name: `Repost moderation ${suffix}`,
        nameNormalized: `repost moderation ${suffix}`,
        slug: `repost-moderation-${suffix}`,
        description: "A community used to check repost removal counters.",
        category: "ACADEMIC",
        createdById: author.userId,
        memberCount: 1,
        postCount: 1,
      },
      select: { id: true },
    });
    const original = await db.post.create({
      data: {
        universityId,
        authorId: author.userId,
        type: "POST",
        body: "Community post with a plain repost",
        audiencePath: ["PUBLIC"],
        audienceKind: "PUBLIC",
        communityId: community.id,
      },
      select: { id: true },
    });
    // Seed the repost directly: this test isolates the moderation counter path,
    // not repost visibility (covered above).
    const repost = await db.post.create({
      data: {
        universityId,
        authorId: reposter.userId,
        type: "REPOST",
        repostKind: "PLAIN",
        repostOfId: original.id,
        body: "",
        audiencePath: ["PUBLIC"],
        audienceKind: "PUBLIC",
        communityId: community.id,
      },
      select: { id: true },
    });
    await db.post.update({ where: { id: original.id }, data: { repostCount: 1 } });
    const report = await db.report.create({
      data: {
        universityId,
        reporterId: outsider.userId,
        targetType: "POST",
        targetId: repost.id,
        reason: "SPAM",
      },
      select: { id: true },
    });
    const moderator = {
      id: outsider.userId,
      universityId,
      roles: [{ role: "MODERATOR", universityId }],
    } as unknown as SessionUser;

    await moderateReport(moderator, {
      reportId: report.id,
      decision: "REMOVE",
      reason: "Remove the duplicate repost",
    });

    const [repostRow, originalRow, communityRow] = await Promise.all([
      db.post.findFirst({ where: { id: repost.id }, select: { status: true } }),
      db.post.findFirst({ where: { id: original.id }, select: { repostCount: true } }),
      db.community.findFirst({ where: { id: community.id }, select: { postCount: true } }),
    ]);
    expect(repostRow?.status).toBe("REMOVED");
    expect(originalRow?.repostCount).toBe(0);
    expect(communityRow?.postCount).toBe(1);
  });
});

describe("duplicate migration", () => {
  it("keeps the earliest duplicate, soft-deletes the rest and recomputes counters", async () => {
    const db = platformDb;
    const target = await makePost(author.userId, ["PUBLIC"], "Duplicate target");
    const early = new Date(Date.now() - 60_000);
    const late = new Date();
    await db.$executeRawUnsafe(`DROP INDEX IF EXISTS "Post_plain_repost_unique"`);
    try {
      await db.$executeRawUnsafe(
        `INSERT INTO "Post" ("id","universityId","authorId","type","repostKind","body","audiencePath","audienceKind","repostOfId","status","rankAt","createdAt","updatedAt")
         VALUES
         ($1,$2,$3,'REPOST','PLAIN','','{"PUBLIC"}','PUBLIC',$4,'ACTIVE',$5,$5,$5),
         ($6,$2,$3,'REPOST','PLAIN','','{"PUBLIC"}','PUBLIC',$4,'ACTIVE',$7,$7,$7)`,
        `${target.id}-early`,
        universityId,
        other.userId,
        target.id,
        early,
        `${target.id}-late`,
        late,
      );
      expect(await db.post.count({ where: { repostOfId: target.id } })).toBe(2);

      await db.$executeRawUnsafe(`
        WITH ranked AS (
          SELECT "id", ROW_NUMBER() OVER (
            PARTITION BY "authorId", "repostOfId", "repostKind"
            ORDER BY "createdAt" ASC, "id" ASC
          ) AS rn
          FROM "Post"
          WHERE "type" = 'REPOST' AND "repostOfId" IS NOT NULL AND "repostKind" IS NOT NULL
        )
        UPDATE "Post" AS p SET "status" = 'DELETED', "body" = ''
        FROM ranked r WHERE p."id" = r."id" AND r.rn > 1
      `);
      await db.$executeRawUnsafe(`
        UPDATE "Post" AS p SET "repostCount" = COALESCE((
          SELECT COUNT(DISTINCT r."authorId") FROM "Post" r
          WHERE r."repostOfId" = p."id" AND r."type" = 'REPOST'
            AND r."repostKind" = 'PLAIN' AND r."status" = 'ACTIVE'
        ), 0)
        WHERE p."id" = $1
      `, target.id);

      const rows = await db.post.findMany({
        where: { repostOfId: target.id },
        orderBy: { createdAt: "asc" },
        select: { id: true, status: true, body: true },
      });
      expect(rows[0]?.status).toBe("ACTIVE");
      expect(rows[1]?.status).toBe("DELETED");
      expect(rows[1]?.body).toBe("");
      const original = await db.post.findFirst({ where: { id: target.id }, select: { repostCount: true } });
      expect(original?.repostCount).toBe(1);
    } finally {
      await db.$executeRawUnsafe(
        `CREATE UNIQUE INDEX IF NOT EXISTS "Post_plain_repost_unique"
         ON "Post" ("authorId","repostOfId")
         WHERE "type" = 'REPOST' AND "repostKind" = 'PLAIN' AND "repostOfId" IS NOT NULL AND "status" <> 'DELETED'`,
      );
    }
  });
});
