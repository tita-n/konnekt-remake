-- CreateEnum
CREATE TYPE "UniversityStatus" AS ENUM ('WAITLIST', 'ACTIVE', 'OFF');

-- CreateEnum
CREATE TYPE "AcademicNodeType" AS ENUM ('COLLEGE', 'FACULTY', 'DEPARTMENT');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED', 'ALUMNI', 'DELETED_PENDING');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PLATFORM_ADMIN', 'UNIVERSITY_ADMIN', 'REVIEWER', 'MODERATOR', 'OFFICIAL');

-- CreateEnum
CREATE TYPE "VerificationMethod" AS ENUM ('STUDENT_EMAIL', 'ID_CARD', 'VOUCH');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DecisionReason" AS ENUM ('MATRIC_MISMATCH', 'ID_UNREADABLE', 'DUPLICATE_ACCOUNT', 'NOT_A_STUDENT', 'EXPIRED_DOCUMENT', 'FAKE_DOCUMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "EmailCodePurpose" AS ENUM ('SIGNUP_EMAIL', 'STUDENT_EMAIL', 'PASSWORD_RESET');

-- CreateEnum
CREATE TYPE "WaitlistKind" AS ENUM ('UNIVERSITY', 'STUDENT');

-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('EVERYONE', 'UNIVERSITY', 'NOBODY');

-- CreateTable
CREATE TABLE "University" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logoUrl" TEXT,
    "accentColor" TEXT NOT NULL DEFAULT '#1B7F5A',
    "status" "UniversityStatus" NOT NULL DEFAULT 'WAITLIST',
    "labels" JSONB NOT NULL DEFAULT '{}',
    "featureFlags" JSONB NOT NULL DEFAULT '{}',
    "studentEmailDomains" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "idCardEnabled" BOOLEAN NOT NULL DEFAULT true,
    "vouchingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "matricPattern" TEXT NOT NULL DEFAULT '^\d{2}/\d{4,5}/\d{3}$',
    "policyVersion" TEXT NOT NULL DEFAULT '2026-01-01',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "University_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicNode" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "parentId" TEXT,
    "type" "AcademicNodeType" NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "path" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "levels" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "parent_path" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "AcademicNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "photoUrl" TEXT,
    "bio" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "matricNumber" TEXT,
    "matricNormalized" TEXT,
    "departmentNodeId" TEXT,
    "level" INTEGER,
    "isPostgraduate" BOOLEAN NOT NULL DEFAULT false,
    "interests" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "consentPolicyVersion" TEXT,
    "consentAcceptedAt" TIMESTAMP(3),
    "departmentVisibility" "Visibility" NOT NULL DEFAULT 'UNIVERSITY',
    "levelVisibility" "Visibility" NOT NULL DEFAULT 'UNIVERSITY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastActiveAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "deletedRequestedAt" TIMESTAMP(3),
    "purgeAfter" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "universityId" TEXT,
    "role" "Role" NOT NULL,
    "grantedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "method" "VerificationMethod" NOT NULL,
    "matricNumber" TEXT,
    "matricNormalized" TEXT,
    "idImageRef" TEXT,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "voucherId" TEXT,
    "reviewerId" TEXT,
    "decisionReason" "DecisionReason",
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "VerificationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "purpose" "EmailCodePurpose" NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaitlistEntry" (
    "id" TEXT NOT NULL,
    "kind" "WaitlistKind" NOT NULL,
    "universityName" TEXT,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "universityId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "University_slug_key" ON "University"("slug");

-- CreateIndex
CREATE INDEX "University_status_idx" ON "University"("status");

-- CreateIndex
CREATE INDEX "AcademicNode_universityId_idx" ON "AcademicNode"("universityId");

-- CreateIndex
CREATE INDEX "AcademicNode_universityId_path_idx" ON "AcademicNode"("universityId", "path");

-- CreateIndex
CREATE INDEX "AcademicNode_universityId_parentId_sortOrder_idx" ON "AcademicNode"("universityId", "parentId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "academic_node_unique_slug" ON "AcademicNode"("universityId", "parent_path", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_universityId_idx" ON "User"("universityId");

-- CreateIndex
CREATE INDEX "User_universityId_status_idx" ON "User"("universityId", "status");

-- CreateIndex
CREATE INDEX "User_universityId_matricNormalized_idx" ON "User"("universityId", "matricNormalized");

-- CreateIndex
CREATE INDEX "User_universityId_departmentNodeId_idx" ON "User"("universityId", "departmentNodeId");

-- CreateIndex
CREATE INDEX "RoleAssignment_userId_idx" ON "RoleAssignment"("userId");

-- CreateIndex
CREATE INDEX "RoleAssignment_universityId_role_idx" ON "RoleAssignment"("universityId", "role");

-- CreateIndex
CREATE INDEX "VerificationRequest_universityId_status_createdAt_idx" ON "VerificationRequest"("universityId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "VerificationRequest_userId_status_idx" ON "VerificationRequest"("userId", "status");

-- CreateIndex
CREATE INDEX "VerificationRequest_voucherId_status_idx" ON "VerificationRequest"("voucherId", "status");

-- CreateIndex
CREATE INDEX "VerificationRequest_universityId_matricNormalized_idx" ON "VerificationRequest"("universityId", "matricNormalized");

-- CreateIndex
CREATE INDEX "EmailCode_email_purpose_createdAt_idx" ON "EmailCode"("email", "purpose", "createdAt");

-- CreateIndex
CREATE INDEX "EmailCode_userId_purpose_idx" ON "EmailCode"("userId", "purpose");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "WaitlistEntry_kind_createdAt_idx" ON "WaitlistEntry"("kind", "createdAt");

-- CreateIndex
CREATE INDEX "WaitlistEntry_email_idx" ON "WaitlistEntry"("email");

-- CreateIndex
CREATE INDEX "AuditLog_universityId_createdAt_idx" ON "AuditLog"("universityId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- AddForeignKey
ALTER TABLE "AcademicNode" ADD CONSTRAINT "AcademicNode_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicNode" ADD CONSTRAINT "AcademicNode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "AcademicNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_departmentNodeId_fkey" FOREIGN KEY ("departmentNodeId") REFERENCES "AcademicNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationRequest" ADD CONSTRAINT "VerificationRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationRequest" ADD CONSTRAINT "VerificationRequest_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationRequest" ADD CONSTRAINT "VerificationRequest_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationRequest" ADD CONSTRAINT "VerificationRequest_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailCode" ADD CONSTRAINT "EmailCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE SET NULL ON UPDATE CASCADE;
