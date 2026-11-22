-- AlterTable
ALTER TABLE "User" ADD COLUMN     "onboardingCompletedAt" TIMESTAMP(3);

-- Existing students already finished the old two-step onboarding.
UPDATE "User"
SET "onboardingCompletedAt" = COALESCE("verifiedAt", NOW())
WHERE "departmentNodeId" IS NOT NULL AND "level" IS NOT NULL;
