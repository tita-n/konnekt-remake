-- Replies may nest arbitrarily deep up to a safety maximum of 20. Display
-- indentation is capped separately in the client.
ALTER TABLE "Comment" ADD COLUMN "depth" INTEGER NOT NULL DEFAULT 0;

-- Backfill one known existing level from the parent relationship.
UPDATE "Comment" AS child
SET "depth" = 1
FROM "Comment" AS parent
WHERE child."parentId" = parent."id" AND parent."parentId" IS NULL;
