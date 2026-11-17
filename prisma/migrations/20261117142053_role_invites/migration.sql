-- CreateTable
CREATE TABLE "RoleInvite" (
    "id" TEXT NOT NULL,
    "universityId" TEXT,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "invitedBy" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoleInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RoleInvite_tokenHash_key" ON "RoleInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "RoleInvite_email_idx" ON "RoleInvite"("email");

-- CreateIndex
CREATE INDEX "RoleInvite_universityId_idx" ON "RoleInvite"("universityId");

-- AddForeignKey
ALTER TABLE "RoleInvite" ADD CONSTRAINT "RoleInvite_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE CASCADE ON UPDATE CASCADE;
