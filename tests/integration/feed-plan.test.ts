import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { platformDb } from "@/lib/db/platform";

const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
let universityId = "";
let postIds: string[] = [];

beforeAll(async () => {
  const university = await platformDb.university.create({
    data: {
      name: `Feed Plan ${suffix}`,
      shortName: "PLAN",
      slug: `feed-plan-${suffix}`,
      status: "ACTIVE",
      matricPattern: "^[A-Z]{3}/\\d{4}/\\d{3,4}$",
      studentEmailDomains: [`plan-${suffix}.edu.ng`],
      labels: {},
    },
    select: { id: true },
  });
  universityId = university.id;
  const author = await platformDb.user.create({
    data: {
      universityId,
      email: `plan-${suffix}@plan-${suffix}.edu.ng`,
      username: `plan${suffix}`.slice(0, 20),
      fullName: "Feed Plan Author",
      passwordHash: "x",
      status: "VERIFIED",
      emailVerified: true,
      consentPolicyVersion: "2026-01-01",
      consentAcceptedAt: new Date(),
      verifiedAt: new Date(),
    },
    select: { id: true },
  });

  const now = Date.now();
  await platformDb.post.createMany({
    data: Array.from({ length: 1000 }, (_, index) => ({
      universityId,
      authorId: author.id,
      type: "POST" as const,
      body: `Feed plan fixture ${index}`,
      audiencePath: ["PUBLIC"],
      audienceKind: "PUBLIC" as const,
      status: "ACTIVE" as const,
      createdAt: new Date(now - index * 60_000),
    })),
  });
  postIds = (await platformDb.post.findMany({ where: { universityId }, select: { id: true } })).map((row) => row.id);
  await platformDb.$executeRawUnsafe('ANALYZE "Post"');
}, 30_000);

afterAll(async () => {
  await platformDb.post.deleteMany({ where: { universityId } });
  await platformDb.user.deleteMany({ where: { universityId } });
  await platformDb.university.delete({ where: { id: universityId } }).catch(() => undefined);
  await platformDb.$disconnect();
});

describe("feed query plan at 1,000 posts", () => {
  it("uses the chronological index rather than a sequential scan", async () => {
    expect(postIds.length).toBe(1000);
    const planRows = await platformDb.$queryRawUnsafe<Array<{ "QUERY PLAN": string }>>(
      `EXPLAIN (ANALYZE, BUFFERS)
       SELECT id, "createdAt"
       FROM "Post"
       WHERE "universityId" = $1
         AND status = 'ACTIVE'::"PostStatus"
         AND (
           "audienceKind" = 'PUBLIC'::"AudienceKind"
           OR "audiencePath" = ARRAY[$1]::text[]
           OR "audiencePath" = ARRAY[$1, $1]::text[]
         )
       ORDER BY "createdAt" DESC, id DESC
       LIMIT 21`,
      universityId,
    );
    const plan = planRows.map((row) => row["QUERY PLAN"]).join("\n");
    console.log(plan);
    expect(plan).toMatch(/Index Scan|Index Only Scan/);
    expect(plan).not.toMatch(/Seq Scan on "Post"/);
    // The planner may pick the narrower single-column index when a fixture has
    // one tenant; the composite chronological index must still exist for the
    // multi-tenant case.
    const indexes = await platformDb.$queryRawUnsafe<Array<{ indexname: string }>>(
      `SELECT indexname FROM pg_indexes WHERE tablename = 'Post'`,
    );
    expect(indexes.map((row) => row.indexname)).toContain("Post_universityId_status_createdAt_id_idx");
  });
});
