-- CreateEnum
CREATE TYPE "CommunityCategory" AS ENUM ('ACADEMIC', 'TECH', 'SPORTS', 'ARTS', 'FAITH', 'BUSINESS', 'HOSTEL', 'ASSOCIATION', 'HOBBY', 'OTHER');

-- CreateEnum
CREATE TYPE "CommunityPrivacy" AS ENUM ('PUBLIC', 'REQUEST', 'INVITE_ONLY');

-- CreateEnum
CREATE TYPE "CommunityStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ARCHIVED', 'DELETED');

-- CreateEnum
CREATE TYPE "CommunityRole" AS ENUM ('OWNER', 'MODERATOR', 'MEMBER');

-- CreateEnum
CREATE TYPE "CommunityMemberStatus" AS ENUM ('ACTIVE', 'BANNED', 'LEFT');

-- CreateEnum
CREATE TYPE "JoinRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CommunityInviteKind" AS ENUM ('USER', 'LINK');

-- CreateEnum
CREATE TYPE "CommunityInviteStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED', 'USED');

-- CreateEnum
CREATE TYPE "CommunityResourceKind" AS ENUM ('FILE', 'LINK');

-- CreateEnum
CREATE TYPE "CommunityResourceStatus" AS ENUM ('ACTIVE', 'REMOVED', 'DELETED');

-- CreateEnum
CREATE TYPE "CommunityOfficialRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
ALTER TYPE "AudienceKind" ADD VALUE 'COMMUNITY';

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "communityId" TEXT;

-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "communityId" TEXT;

-- CreateTable
CREATE TABLE "Community" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameNormalized" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "CommunityCategory" NOT NULL,
    "privacy" "CommunityPrivacy" NOT NULL DEFAULT 'PUBLIC',
    "isOfficial" BOOLEAN NOT NULL DEFAULT false,
    "status" "CommunityStatus" NOT NULL DEFAULT 'ACTIVE',
    "iconPublicId" TEXT,
    "bannerPublicId" TEXT,
    "allowMemberUploads" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "memberCount" INTEGER NOT NULL DEFAULT 0,
    "postCount" INTEGER NOT NULL DEFAULT 0,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "suspendedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "purgeAfter" TIMESTAMP(3),

    CONSTRAINT "Community_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityMember" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "CommunityRole" NOT NULL DEFAULT 'MEMBER',
    "status" "CommunityMemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "bannedById" TEXT,
    "bannedReason" TEXT,
    "mutedUntil" TIMESTAMP(3),

    CONSTRAINT "CommunityMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JoinRequest" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "JoinRequestStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JoinRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityInvite" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "kind" "CommunityInviteKind" NOT NULL,
    "invitedUserId" TEXT,
    "tokenHash" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "maxUses" INTEGER,
    "uses" INTEGER NOT NULL DEFAULT 0,
    "status" "CommunityInviteStatus" NOT NULL DEFAULT 'ACTIVE',
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityRule" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,

    CONSTRAINT "CommunityRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityResource" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "uploaderId" TEXT NOT NULL,
    "kind" "CommunityResourceKind" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "CommunityCategory" NOT NULL,
    "fileKey" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "url" TEXT,
    "status" "CommunityResourceStatus" NOT NULL DEFAULT 'ACTIVE',
    "removedById" TEXT,
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityPin" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "pinnedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityPin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityOfficialRequest" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "status" "CommunityOfficialRequestStatus" NOT NULL DEFAULT 'PENDING',
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunityOfficialRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Community_universityId_status_privacy_category_idx" ON "Community"("universityId", "status", "privacy", "category");

-- CreateIndex
CREATE INDEX "Community_universityId_status_lastActivityAt_idx" ON "Community"("universityId", "status", "lastActivityAt");

-- CreateIndex
CREATE INDEX "Community_universityId_isOfficial_status_idx" ON "Community"("universityId", "isOfficial", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Community_universityId_nameNormalized_key" ON "Community"("universityId", "nameNormalized");

-- CreateIndex
CREATE UNIQUE INDEX "Community_universityId_slug_key" ON "Community"("universityId", "slug");

-- CreateIndex
CREATE INDEX "CommunityMember_universityId_userId_status_idx" ON "CommunityMember"("universityId", "userId", "status");

-- CreateIndex
CREATE INDEX "CommunityMember_communityId_status_role_joinedAt_idx" ON "CommunityMember"("communityId", "status", "role", "joinedAt");

-- CreateIndex
CREATE INDEX "CommunityMember_universityId_communityId_mutedUntil_idx" ON "CommunityMember"("universityId", "communityId", "mutedUntil");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityMember_communityId_userId_key" ON "CommunityMember"("communityId", "userId");

-- CreateIndex
CREATE INDEX "JoinRequest_universityId_communityId_status_createdAt_idx" ON "JoinRequest"("universityId", "communityId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "JoinRequest_universityId_userId_status_idx" ON "JoinRequest"("universityId", "userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityInvite_tokenHash_key" ON "CommunityInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "CommunityInvite_universityId_communityId_status_createdAt_idx" ON "CommunityInvite"("universityId", "communityId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "CommunityInvite_universityId_invitedUserId_status_idx" ON "CommunityInvite"("universityId", "invitedUserId", "status");

-- CreateIndex
CREATE INDEX "CommunityRule_universityId_communityId_idx" ON "CommunityRule"("universityId", "communityId");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityRule_communityId_position_key" ON "CommunityRule"("communityId", "position");

-- CreateIndex
CREATE INDEX "CommunityResource_universityId_communityId_status_category__idx" ON "CommunityResource"("universityId", "communityId", "status", "category", "createdAt");

-- CreateIndex
CREATE INDEX "CommunityResource_universityId_uploaderId_createdAt_idx" ON "CommunityResource"("universityId", "uploaderId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityPin_postId_key" ON "CommunityPin"("postId");

-- CreateIndex
CREATE INDEX "CommunityPin_universityId_communityId_position_idx" ON "CommunityPin"("universityId", "communityId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityPin_communityId_position_key" ON "CommunityPin"("communityId", "position");

-- CreateIndex
CREATE INDEX "CommunityOfficialRequest_universityId_status_createdAt_idx" ON "CommunityOfficialRequest"("universityId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "CommunityOfficialRequest_universityId_communityId_status_idx" ON "CommunityOfficialRequest"("universityId", "communityId", "status");

-- CreateIndex
CREATE INDEX "Post_universityId_communityId_status_rankAt_id_idx" ON "Post"("universityId", "communityId", "status", "rankAt", "id");

-- CreateIndex
CREATE INDEX "Report_universityId_communityId_status_createdAt_idx" ON "Report"("universityId", "communityId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Community" ADD CONSTRAINT "Community_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityMember" ADD CONSTRAINT "CommunityMember_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityMember" ADD CONSTRAINT "CommunityMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityMember" ADD CONSTRAINT "CommunityMember_bannedById_fkey" FOREIGN KEY ("bannedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JoinRequest" ADD CONSTRAINT "JoinRequest_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JoinRequest" ADD CONSTRAINT "JoinRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JoinRequest" ADD CONSTRAINT "JoinRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityInvite" ADD CONSTRAINT "CommunityInvite_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityInvite" ADD CONSTRAINT "CommunityInvite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityInvite" ADD CONSTRAINT "CommunityInvite_invitedUserId_fkey" FOREIGN KEY ("invitedUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityRule" ADD CONSTRAINT "CommunityRule_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityResource" ADD CONSTRAINT "CommunityResource_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityResource" ADD CONSTRAINT "CommunityResource_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityPin" ADD CONSTRAINT "CommunityPin_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityPin" ADD CONSTRAINT "CommunityPin_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityPin" ADD CONSTRAINT "CommunityPin_pinnedById_fkey" FOREIGN KEY ("pinnedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityOfficialRequest" ADD CONSTRAINT "CommunityOfficialRequest_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityOfficialRequest" ADD CONSTRAINT "CommunityOfficialRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityOfficialRequest" ADD CONSTRAINT "CommunityOfficialRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- One pending request per student per community, and one pending official
-- request per community. The API checks first; these are the hard guarantee.
CREATE UNIQUE INDEX "join_request_one_pending"
  ON "JoinRequest"("communityId", "userId") WHERE status = 'PENDING';
CREATE UNIQUE INDEX "official_request_one_pending"
  ON "CommunityOfficialRequest"("communityId") WHERE status = 'PENDING';

-- A community can never lose its last active owner. The trigger runs before
-- demotion, ban, leave or deletion of an owner row. Cascading deletes from a
-- deleted community are allowed because the parent row is already gone.
CREATE OR REPLACE FUNCTION "community_keep_owner"() RETURNS trigger AS $$
DECLARE
  remaining integer;
  parent_exists boolean;
BEGIN
  IF OLD.role <> 'OWNER' OR OLD.status <> 'ACTIVE' THEN
    RETURN OLD;
  END IF;
  SELECT EXISTS(SELECT 1 FROM "Community" WHERE id = OLD."communityId") INTO parent_exists;
  IF NOT parent_exists THEN
    RETURN OLD;
  END IF;
  SELECT count(*) INTO remaining
  FROM "CommunityMember"
  WHERE "communityId" = OLD."communityId"
    AND id <> OLD.id
    AND role = 'OWNER'
    AND status = 'ACTIVE';
  IF remaining = 0 THEN
    RAISE EXCEPTION 'community must keep at least one owner';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "community_keep_owner_trigger"
  BEFORE UPDATE OF role, status OR DELETE ON "CommunityMember"
  FOR EACH ROW EXECUTE FUNCTION "community_keep_owner"();

-- Trigram search for names and descriptions. Discover uses an ILIKE prefix or
-- substring predicate and this index keeps the scan bounded as communities grow.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "Community_name_trgm_idx" ON "Community" USING gin (name gin_trgm_ops);
CREATE INDEX "Community_description_trgm_idx" ON "Community" USING gin (description gin_trgm_ops);
