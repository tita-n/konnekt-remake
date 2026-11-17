-- CreateTable
CREATE TABLE "SignupDraft" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "method" "VerificationMethod" NOT NULL,
    "matricNumber" TEXT,
    "matricNormalized" TEXT,
    "idImageRef" TEXT,
    "vouchId" TEXT,
    "studentEmail" TEXT,
    "studentEmailVerifiedAt" TIMESTAMP(3),
    "pendingFullName" TEXT,
    "pendingUsername" TEXT,
    "pendingEmail" TEXT,
    "pendingPasswordHash" TEXT,
    "emailCodeSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SignupDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SignupDraft_tokenHash_key" ON "SignupDraft"("tokenHash");

-- CreateIndex
CREATE INDEX "SignupDraft_universityId_idx" ON "SignupDraft"("universityId");

-- CreateIndex
CREATE INDEX "SignupDraft_expiresAt_idx" ON "SignupDraft"("expiresAt");

-- AddForeignKey
ALTER TABLE "SignupDraft" ADD CONSTRAINT "SignupDraft_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE CASCADE ON UPDATE CASCADE;
