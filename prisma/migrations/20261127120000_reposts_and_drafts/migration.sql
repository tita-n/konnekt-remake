-- Plain reposts become a unique, profile-only record; quotes remain feed posts.

CREATE TYPE "RepostKind" AS ENUM ('PLAIN', 'QUOTE');

ALTER TABLE "Post" ADD COLUMN "repostKind" "RepostKind";

-- Existing REPOST rows are classified by whether they carry the author's comment.
UPDATE "Post"
SET "repostKind" = CASE WHEN btrim("body") = '' THEN 'PLAIN'::"RepostKind" ELSE 'QUOTE'::"RepostKind" END
WHERE "type" = 'REPOST' AND "repostOfId" IS NOT NULL;

-- Keep the earliest plain repost and the earliest quote per user/original.
-- Everything else is soft-deleted (and loses its body) instead of hard-deleted,
-- so a moderator or the author can still see the record.
WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "authorId", "repostOfId", "repostKind"
      ORDER BY "createdAt" ASC, "id" ASC
    ) AS rn
  FROM "Post"
  WHERE "type" = 'REPOST' AND "repostOfId" IS NOT NULL AND "repostKind" IS NOT NULL
)
UPDATE "Post" AS p
SET "status" = 'DELETED', "body" = ''
FROM ranked r
WHERE p."id" = r."id" AND r.rn > 1;

-- Repost count is the number of distinct users who still have an active plain
-- repost of this post.
UPDATE "Post" AS p
SET "repostCount" = COALESCE(
  (
    SELECT COUNT(DISTINCT r."authorId")
    FROM "Post" r
    WHERE r."repostOfId" = p."id"
      AND r."type" = 'REPOST'
      AND r."repostKind" = 'PLAIN'
      AND r."status" = 'ACTIVE'
  ),
  0
);

-- One active plain repost and one active quote per user per original.
CREATE UNIQUE INDEX "Post_plain_repost_unique"
  ON "Post" ("authorId", "repostOfId")
  WHERE "type" = 'REPOST' AND "repostKind" = 'PLAIN' AND "repostOfId" IS NOT NULL AND "status" <> 'DELETED';

CREATE UNIQUE INDEX "Post_quote_repost_unique"
  ON "Post" ("authorId", "repostOfId")
  WHERE "type" = 'REPOST' AND "repostKind" = 'QUOTE' AND "repostOfId" IS NOT NULL AND "status" <> 'DELETED';

CREATE INDEX "Post_universityId_authorId_repostKind_createdAt_idx"
  ON "Post" ("universityId", "authorId", "repostKind", "createdAt");

-- Drafts get a device-generated id, a version and a composer context.
ALTER TABLE "Draft" ADD COLUMN "clientDraftId" TEXT;
UPDATE "Draft" SET "clientDraftId" = "id" WHERE "clientDraftId" IS NULL;
ALTER TABLE "Draft" ALTER COLUMN "clientDraftId" SET NOT NULL;

ALTER TABLE "Draft" ADD COLUMN "contextKey" TEXT NOT NULL DEFAULT 'post';
ALTER TABLE "Draft" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Draft" ADD COLUMN "clientUpdatedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Draft_universityId_userId_clientDraftId_key"
  ON "Draft" ("universityId", "userId", "clientDraftId");

CREATE INDEX "Draft_universityId_userId_contextKey_updatedAt_idx"
  ON "Draft" ("universityId", "userId", "contextKey", "updatedAt");
