/**
 * Non-production volume seed for query plans and load tests.
 *
 * This is deliberately separate from the demo seed: it creates no realistic
 * content that a person should browse, only enough structured volume to make
 * EXPLAIN plans, cursor pagination and concurrent writes honest.
 *
 * Defaults: 5,000 users across 3 universities, 200,000 posts, 1,000,000
 * reactions, 100,000 comments, 500 communities and 2,000 events. Use `--scale`
 * to make a smaller local run while developing.
 *
 * It refuses production by every environment signal, refuses a remote database
 * unless ALLOW_LOAD_SEED_REMOTE=1, and removes only rows it created (identities
 * prefixed `load_`, universities with slug prefix `load-`).
 */
import { hash } from "@node-rs/argon2";
import { PrismaClient } from "@prisma/client";
import { assertSeedAllowed } from "../prisma/seed-guard";

const args = new Map<string, string>();
for (const raw of process.argv.slice(2)) {
  if (!raw.startsWith("--")) continue;
  const [key, value] = raw.slice(2).split("=");
  args.set(key!, value ?? "1");
}

function numberArg(name: string, fallback: number): number {
  const parsed = Number(args.get(name));
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
}

const scale = Number(args.get("scale") ?? "1");
const USERS = numberArg("users", Math.round(5_000 * scale));
const POSTS = numberArg("posts", Math.round(200_000 * scale));
const REACTIONS = numberArg("reactions", Math.round(1_000_000 * scale));
const COMMENTS = numberArg("comments", Math.round(100_000 * scale));
const COMMUNITIES = numberArg("communities", Math.round(500 * scale));
const EVENTS = numberArg("events", Math.round(2_000 * scale));
const UNIVERSITIES = 3;
const TENANT = "load-university";
const EMAIL_DOMAIN = "load.konnekt.test";

function checkTarget(): void {
  assertSeedAllowed();
  const url = process.env.DATABASE_URL ?? "";
  if (/^(postgres(ql)?:\/\/)/i.test(url)) {
    let host = "";
    try {
      host = new URL(url).hostname;
    } catch {
      throw new Error("Refusing to load-seed: DATABASE_URL is not a valid URL.");
    }
    const local = host === "127.0.0.1" || host === "localhost" || host === "::1" || host === "postgres";
    if (!local && process.env.ALLOW_LOAD_SEED_REMOTE !== "1") {
      throw new Error("Refusing to load-seed a remote database without ALLOW_LOAD_SEED_REMOTE=1.");
    }
  }
}

async function main(): Promise<void> {
  checkTarget();
  const db = new PrismaClient();
  const started = Date.now();
  try {
    const passwordHash = await hash("LoadSeedOnly123!", { memoryCost: 19456, timeCost: 2, parallelism: 1 });

    console.log("[load-seed] clearing previous load data…");
    const clear = [
      `DELETE FROM "Post" WHERE "authorId" IN (SELECT id FROM "User" WHERE username LIKE 'load\\_%')`,
      `DELETE FROM "Community" WHERE slug LIKE 'load-%'`,
      `DELETE FROM "User" WHERE username LIKE 'load\\_%'`,
      `DELETE FROM "AcademicNode" WHERE "universityId" LIKE 'load-%'`,
      `DELETE FROM "University" WHERE slug LIKE 'load-%'`,
    ];
    for (const statement of clear) await db.$executeRawUnsafe(statement);

    console.log("[load-seed] universities and academic trees…");
    for (let u = 1; u <= UNIVERSITIES; u += 1) {
      const universityId = `${TENANT}-${u}`;
      await db.$executeRawUnsafe(
        `INSERT INTO "University"(id,name,"shortName",slug,"accentColor",status,"studentEmailDomains","vouchingEnabled","createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,$5,'ACTIVE'::"UniversityStatus",$6,true,now(),now())`,
        universityId,
        `Load University ${u}`,
        `LU${u}`,
        `${TENANT}-${u}`,
        ["#4F46E5", "#0F766E", "#B45309"][u - 1],
        [`load${u}.edu.ng`],
      );
      // 1 college → 2 faculties → 6 departments per university.
      for (let c = 1; c <= 1; c += 1) {
        const collegeId = `${universityId}-col-${c}`;
        await db.$executeRawUnsafe(
          `INSERT INTO "AcademicNode"(id,"universityId","parentId",type,name,slug,path,"sortOrder","isActive",levels,"createdAt","updatedAt")
           VALUES ($1,$2,NULL,'COLLEGE'::"AcademicNodeType",$3,$4,'',0,true,ARRAY[]::int[],now(),now())`,
          collegeId,
          universityId,
          `College ${c}`,
          `college-${c}`,
        );
        for (let f = 1; f <= 2; f += 1) {
          const facultyId = `${universityId}-fac-${c}-${f}`;
          await db.$executeRawUnsafe(
            `INSERT INTO "AcademicNode"(id,"universityId","parentId",type,name,slug,path,"sortOrder","isActive",levels,"createdAt","updatedAt")
             VALUES ($1,$2,$3,'FACULTY'::"AcademicNodeType",$4,$5,$6,0,true,ARRAY[]::int[],now(),now())`,
            facultyId,
            universityId,
            collegeId,
            `Faculty ${f}`,
            `faculty-${f}`,
            collegeId,
          );
          for (let d = 1; d <= 3; d += 1) {
            const departmentId = `${universityId}-dep-${c}-${f}-${d}`;
            await db.$executeRawUnsafe(
              `INSERT INTO "AcademicNode"(id,"universityId","parentId",type,name,slug,path,"sortOrder","isActive",levels,"createdAt","updatedAt")
               VALUES ($1,$2,$3,'DEPARTMENT'::"AcademicNodeType",$4,$5,$6,0,true,ARRAY[100,200,300,400,500]::int[],now(),now())`,
              departmentId,
              universityId,
              facultyId,
              `Department ${d}`,
              `department-${c}-${f}-${d}`,
              `${collegeId}/${facultyId}`,
            );
          }
        }
      }
    }

    const departments = await db.$queryRawUnsafe<Array<{ id: string; universityId: string }>>(
      `SELECT id, "universityId" FROM "AcademicNode" WHERE type='DEPARTMENT' AND "universityId" LIKE '${TENANT}-%' ORDER BY id`,
    );

    console.log(`[load-seed] ${USERS} users…`);
    await db.$executeRawUnsafe(
      `INSERT INTO "User"(id,"universityId",email,"emailVerified",username,"passwordHash","fullName",status,"matricNumber","matricNormalized","departmentNodeId",level,"consentAcceptedAt","onboardingCompletedAt","createdAt","updatedAt","verifiedAt")
       SELECT
         'load-user-' || u,
         d."universityId",
         'load' || u || '@${EMAIL_DOMAIN}',
         true,
         'load_' || u,
         $1,
         'Load Student ' || u,
         'VERIFIED'::"UserStatus",
         'LU/' || lpad(u::text, 5, '0'),
         'lu/' || u,
         d.id,
         (ARRAY[100,200,300,400,500])[1 + (u % 5)],
         now() - interval '90 days',
         now() - interval '90 days',
         now() - (random() * interval '120 days'),
         now(),
         now() - interval '90 days'
       FROM generate_series(1, $2) AS g(u)
       JOIN LATERAL (
         SELECT id, "universityId" FROM "AcademicNode"
         WHERE type='DEPARTMENT' AND "universityId" LIKE '${TENANT}-%'
         ORDER BY id OFFSET (g.u % $3) LIMIT 1
       ) AS d ON true
       ON CONFLICT (email) DO NOTHING`,
      passwordHash,
      USERS,
      departments.length,
    );

    console.log(`[load-seed] ${POSTS} posts…`);
    await db.$executeRawUnsafe(
      `WITH numbered AS (
         SELECT us.id, us."universityId", us.level, us."departmentNodeId" AS did, d.path AS dpath,
                row_number() OVER (ORDER BY us.id) AS rn, count(*) OVER () AS total
         FROM "User" us JOIN "AcademicNode" d ON d.id = us."departmentNodeId"
         WHERE us.username LIKE 'load\\_%'
       ), gen AS (SELECT g FROM generate_series(1, $1) AS g)
       INSERT INTO "Post"(id,"universityId","authorId",type,body,"audiencePath","audienceKind",status,"rankAt","createdAt","updatedAt","commentCount","reactionCount","repostCount","bookmarkCount")
       SELECT
         gen_random_uuid()::text,
         n."universityId",
         n.id,
         CASE WHEN g % 20 = 0 THEN 'QUESTION'::"PostType" ELSE 'POST'::"PostType" END,
         'Load test post ' || g || ' for query plans and pagination boundaries. #load' || (g % 50),
         CASE
           WHEN g % 20 < 8 THEN ARRAY['PUBLIC']
           WHEN g % 20 < 10 THEN ARRAY[n."universityId"] || (string_to_array(n.dpath,'/'))[1:1]
           WHEN g % 20 < 13 THEN ARRAY[n."universityId"] || string_to_array(n.dpath,'/')
           WHEN g % 20 < 17 THEN ARRAY[n."universityId"] || string_to_array(n.dpath,'/') || ARRAY[n.did]
           ELSE ARRAY[n."universityId"] || string_to_array(n.dpath,'/') || ARRAY[n.did, n.level::text]
         END,
         CASE
           WHEN g % 20 < 8 THEN 'PUBLIC'::"AudienceKind"
           WHEN g % 20 < 10 THEN 'COLLEGE'::"AudienceKind"
           WHEN g % 20 < 13 THEN 'FACULTY'::"AudienceKind"
           WHEN g % 20 < 17 THEN 'DEPARTMENT'::"AudienceKind"
           ELSE 'LEVEL'::"AudienceKind"
         END,
         'ACTIVE'::"PostStatus",
         ts,
         ts,
         ts,
         0, 0, 0, 0
       FROM gen
       JOIN numbered n ON n.rn = 1 + ((gen.g * 7919) % (SELECT max(total) FROM numbered))
       CROSS JOIN LATERAL (SELECT now() - (random() * interval '90 days') AS ts) t`,
      POSTS,
    );

    console.log(`[load-seed] ${REACTIONS} reactions…`);
    await db.$executeRawUnsafe(
      `WITH p AS (
         SELECT id, "universityId", row_number() OVER (ORDER BY id) rn, count(*) OVER () total
         FROM "Post" WHERE "authorId" IN (SELECT id FROM "User" WHERE username LIKE 'load\\_%')
       ), u AS (
         SELECT id, row_number() OVER (ORDER BY id) rn, count(*) OVER () total
         FROM "User" WHERE username LIKE 'load\\_%'
       ), gen AS (SELECT g FROM generate_series(1, $1) g)
       INSERT INTO "Reaction"(id,"universityId","userId","targetType","targetId","createdAt")
       SELECT gen_random_uuid()::text, p."universityId", u.id, 'POST'::"ReactionTargetType", p.id, now() - (random() * interval '90 days')
       FROM gen
       JOIN p ON p.rn = 1 + ((gen.g * 104729) % (SELECT max(total) FROM p))
       JOIN u ON u.rn = 1 + ((gen.g * 15485863) % (SELECT max(total) FROM u))
       ON CONFLICT ("targetType","targetId","userId") DO NOTHING`,
      REACTIONS,
    );

    console.log(`[load-seed] ${COMMENTS} comments…`);
    await db.$executeRawUnsafe(
      `WITH p AS (
         SELECT id, "universityId", row_number() OVER (ORDER BY id) rn, count(*) OVER () total
         FROM "Post" WHERE "authorId" IN (SELECT id FROM "User" WHERE username LIKE 'load\\_%')
       ), u AS (
         SELECT id, row_number() OVER (ORDER BY id) rn, count(*) OVER () total
         FROM "User" WHERE username LIKE 'load\\_%'
       ), gen AS (SELECT g FROM generate_series(1, $1) g)
       INSERT INTO "Comment"(id,"universityId","postId","authorId","parentId",body,status,"helpfulCount","createdAt")
       SELECT gen_random_uuid()::text, p."universityId", p.id, u.id, NULL, 'Load comment ' || gen.g, 'ACTIVE'::"CommentStatus", 0, now() - (random() * interval '90 days')
       FROM gen
       JOIN p ON p.rn = 1 + ((gen.g * 1299709) % (SELECT max(total) FROM p))
       JOIN u ON u.rn = 1 + ((gen.g * 15485863) % (SELECT max(total) FROM u))`,
      COMMENTS,
    );

    console.log("[load-seed] denormalized counters…");
    await db.$executeRawUnsafe(`
      UPDATE "Post" p SET "reactionCount" = c.n
      FROM (SELECT "targetId", count(*)::int n FROM "Reaction" GROUP BY "targetId") c
      WHERE p.id = c."targetId" AND p."authorId" IN (SELECT id FROM "User" WHERE username LIKE 'load\\_%')
    `);
    await db.$executeRawUnsafe(`
      UPDATE "Post" p SET "commentCount" = c.n
      FROM (SELECT "postId", count(*)::int n FROM "Comment" GROUP BY "postId") c
      WHERE p.id = c."postId" AND p."authorId" IN (SELECT id FROM "User" WHERE username LIKE 'load\\_%')
    `);

    console.log(`[load-seed] ${COMMUNITIES} communities…`);
    await db.$executeRawUnsafe(
      `WITH u AS (
         SELECT id, "universityId", row_number() OVER (ORDER BY id) rn, count(*) OVER () total
         FROM "User" WHERE username LIKE 'load\\_%'
       ), gen AS (SELECT g FROM generate_series(1, $1) g)
       INSERT INTO "Community"(id,"universityId",name,"nameNormalized",slug,description,category,privacy,status,"createdById","memberCount","postCount","lastActivityAt","createdAt","updatedAt")
       SELECT gen_random_uuid()::text, u."universityId", 'Load Community ' || gen.g, 'load community ' || gen.g, 'load-community-' || gen.g,
              'Volume community for query plans.', 'TECH'::"CommunityCategory",
              CASE WHEN gen.g % 10 = 0 THEN 'INVITE_ONLY'::"CommunityPrivacy" WHEN gen.g % 5 = 0 THEN 'REQUEST'::"CommunityPrivacy" ELSE 'PUBLIC'::"CommunityPrivacy" END,
              'ACTIVE'::"CommunityStatus", u.id, 1, 0, now(), now() - (random() * interval '90 days'), now()
       FROM gen JOIN u ON u.rn = 1 + ((gen.g * 7919) % (SELECT max(total) FROM u))`,
      COMMUNITIES,
    );

    console.log(`[load-seed] ${EVENTS} events…`);
    await db.$executeRawUnsafe(
      `WITH u AS (
         SELECT id, "universityId", level, "departmentNodeId" AS did, row_number() OVER (ORDER BY id) rn, count(*) OVER () total
         FROM "User" WHERE username LIKE 'load\\_%'
       ), d AS (SELECT id, "universityId", path, row_number() OVER (ORDER BY id) rn, count(*) OVER () total FROM "AcademicNode" WHERE type='DEPARTMENT'),
       gen AS (SELECT g FROM generate_series(1, $1) g)
       INSERT INTO "Event"(id,"universityId","createdById","organiserKind","audienceKind","audiencePath",title,description,category,"startsAt","endsAt",timezone,"venueName","capacity","waitlistEnabled","checkInEnabled","allowOutsideSharing",status,"goingCount","interestedCount","waitlistCount","checkedInCount","createdAt","updatedAt")
       SELECT gen_random_uuid()::text, u."universityId", u.id, 'USER'::"EventOrganiserKind", 'PUBLIC'::"EventAudienceKind", ARRAY['PUBLIC'],
              'Load Event ' || gen.g, 'Volume event for query plans.', 'TECH'::"EventCategory",
              now() + ((gen.g % 60) - 20) * interval '1 day', now() + ((gen.g % 60) - 20) * interval '1 day' + interval '2 hours',
              'Africa/Lagos', 'Load Hall ' || (gen.g % 20), 100, true, true, false, 'SCHEDULED'::"EventStatus", 0,0,0,0,
              now() - (random() * interval '90 days'), now()
       FROM gen JOIN u ON u.rn = 1 + ((gen.g * 7919) % (SELECT max(total) FROM u))`,
      EVENTS,
    );

    await db.$executeRawUnsafe(`ANALYZE`);
    console.log(`[load-seed] done in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error("[load-seed]", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
