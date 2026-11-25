-- AlterTable
ALTER TABLE "Community" ADD COLUMN     "allowMemberEvents" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "materialChanges" JSONB NOT NULL DEFAULT '[]';
