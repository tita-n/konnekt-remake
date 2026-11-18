-- AlterTable
ALTER TABLE "User" ADD COLUMN     "flaggedForReviewAt" TIMESTAMP(3),
ADD COLUMN     "suspendedUntil" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "HelpfulMark" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HelpfulMark_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HelpfulMark_universityId_commentId_idx" ON "HelpfulMark"("universityId", "commentId");

-- CreateIndex
CREATE UNIQUE INDEX "helpful_one_per_user" ON "HelpfulMark"("commentId", "userId");
