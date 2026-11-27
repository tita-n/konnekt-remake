-- Feeds are strictly reverse-chronological by (createdAt, id). The old index
-- led with rankAt, which included the narrower-audience boost.
DROP INDEX IF EXISTS "Post_universityId_status_rankAt_id_idx";
DROP INDEX IF EXISTS "Post_universityId_communityId_status_rankAt_id_idx";

CREATE INDEX "Post_universityId_status_createdAt_id_idx"
  ON "Post" ("universityId", "status", "createdAt", "id");

CREATE INDEX "Post_universityId_communityId_status_createdAt_id_idx"
  ON "Post" ("universityId", "communityId", "status", "createdAt", "id");
