-- DropIndex
DROP INDEX "Community_description_trgm_idx";

-- DropIndex
DROP INDEX "Community_name_trgm_idx";

-- AlterTable
ALTER TABLE "CommunityMember" ADD COLUMN     "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
