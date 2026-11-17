-- AlterTable
ALTER TABLE "EmailCode" ADD COLUMN     "universityId" TEXT;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "universityId" TEXT;

-- CreateIndex
CREATE INDEX "EmailCode_universityId_idx" ON "EmailCode"("universityId");

-- CreateIndex
CREATE INDEX "Session_universityId_idx" ON "Session"("universityId");
