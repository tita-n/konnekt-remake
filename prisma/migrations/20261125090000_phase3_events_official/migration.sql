-- CreateEnum
CREATE TYPE "EventOrganiserKind" AS ENUM ('USER', 'COMMUNITY', 'OFFICIAL');

-- CreateEnum
CREATE TYPE "EventAudienceKind" AS ENUM ('PUBLIC', 'COLLEGE', 'FACULTY', 'DEPARTMENT', 'LEVEL', 'COMMUNITY');

-- CreateEnum
CREATE TYPE "EventCategory" AS ENUM ('TECH', 'ACADEMIC', 'DEPARTMENTAL', 'PARTY', 'COMPETITION', 'SPORTS', 'SEMINAR', 'RELIGIOUS', 'CULTURAL', 'MEETUP', 'OTHER');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('SCHEDULED', 'CANCELLED', 'REMOVED');

-- CreateEnum
CREATE TYPE "EventRsvpStatus" AS ENUM ('GOING', 'INTERESTED', 'WAITLISTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EventStaffRole" AS ENUM ('HOST', 'CHECKIN');

-- CreateEnum
CREATE TYPE "EventCheckInMethod" AS ENUM ('QR', 'MANUAL');

-- CreateEnum
CREATE TYPE "EventCommentStatus" AS ENUM ('ACTIVE', 'REMOVED', 'DELETED');

-- CreateEnum
CREATE TYPE "OfficialAccountCategory" AS ENUM ('ICT', 'STUDENT_AFFAIRS', 'REGISTRY', 'LIBRARY', 'STUDENTS_UNION', 'ACADEMIC', 'SPORTS', 'SECURITY', 'OTHER');

-- CreateEnum
CREATE TYPE "OfficialAccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "AnnouncementCategory" AS ENUM ('ACADEMIC', 'ICT', 'EVENTS', 'STUDENT_AFFAIRS', 'GENERAL');

-- CreateEnum
CREATE TYPE "AnnouncementStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ModerationTargetType" ADD VALUE 'EVENT';
ALTER TYPE "ModerationTargetType" ADD VALUE 'EVENT_COMMENT';
ALTER TYPE "ModerationTargetType" ADD VALUE 'ANNOUNCEMENT';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ReportTargetType" ADD VALUE 'EVENT';
ALTER TYPE "ReportTargetType" ADD VALUE 'EVENT_COMMENT';
ALTER TYPE "ReportTargetType" ADD VALUE 'ANNOUNCEMENT';

-- AlterTable
ALTER TABLE "University" ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'Africa/Lagos';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "showEventAttendance" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "CampusPlace" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampusPlace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "organiserKind" "EventOrganiserKind" NOT NULL,
    "communityId" TEXT,
    "officialAccountId" TEXT,
    "audienceKind" "EventAudienceKind" NOT NULL,
    "audiencePath" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "EventCategory" NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Lagos',
    "venueName" TEXT NOT NULL,
    "placeId" TEXT,
    "venueNote" TEXT,
    "coverPublicId" TEXT,
    "capacity" INTEGER,
    "waitlistEnabled" BOOLEAN NOT NULL DEFAULT false,
    "checkInEnabled" BOOLEAN NOT NULL DEFAULT true,
    "allowOutsideSharing" BOOLEAN NOT NULL DEFAULT false,
    "status" "EventStatus" NOT NULL DEFAULT 'SCHEDULED',
    "cancelReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "lastMaterialChangeAt" TIMESTAMP(3),
    "goingCount" INTEGER NOT NULL DEFAULT 0,
    "interestedCount" INTEGER NOT NULL DEFAULT 0,
    "waitlistCount" INTEGER NOT NULL DEFAULT 0,
    "checkedInCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventRsvp" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "EventRsvpStatus" NOT NULL DEFAULT 'GOING',
    "showPublicly" BOOLEAN NOT NULL DEFAULT true,
    "waitlistPosition" INTEGER,
    "promotedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventRsvp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventTicket" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventStaff" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "EventStaffRole" NOT NULL DEFAULT 'CHECKIN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventStaff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventCheckIn" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scannedById" TEXT NOT NULL,
    "method" "EventCheckInMethod" NOT NULL,
    "clientScanId" TEXT NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deviceLabel" TEXT,

    CONSTRAINT "EventCheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventUpdate" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventComment" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "parentId" TEXT,
    "body" TEXT NOT NULL,
    "status" "EventCommentStatus" NOT NULL DEFAULT 'ACTIVE',
    "removedAt" TIMESTAMP(3),
    "moderationReason" TEXT,
    "editedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventViewDaily" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventViewDaily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfficialAccount" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameNormalized" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" "OfficialAccountCategory" NOT NULL,
    "avatarPublicId" TEXT,
    "description" TEXT NOT NULL,
    "status" "OfficialAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfficialAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfficialAccountStaff" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "officialAccountId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "canPublishCritical" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfficialAccountStaff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "officialAccountId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "category" "AnnouncementCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "critical" BOOLEAN NOT NULL DEFAULT false,
    "audienceKind" "EventAudienceKind" NOT NULL,
    "audiencePath" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "AnnouncementStatus" NOT NULL DEFAULT 'DRAFT',
    "publishAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "editedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnouncementAttachment" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnnouncementAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnouncementAck" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ackedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnnouncementAck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CampusPlace_universityId_active_name_idx" ON "CampusPlace"("universityId", "active", "name");

-- CreateIndex
CREATE UNIQUE INDEX "CampusPlace_universityId_name_key" ON "CampusPlace"("universityId", "name");

-- CreateIndex
CREATE INDEX "Event_universityId_status_startsAt_idx" ON "Event"("universityId", "status", "startsAt");

-- CreateIndex
CREATE INDEX "Event_universityId_audienceKind_startsAt_idx" ON "Event"("universityId", "audienceKind", "startsAt");

-- CreateIndex
CREATE INDEX "Event_universityId_communityId_status_startsAt_idx" ON "Event"("universityId", "communityId", "status", "startsAt");

-- CreateIndex
CREATE INDEX "Event_universityId_officialAccountId_status_startsAt_idx" ON "Event"("universityId", "officialAccountId", "status", "startsAt");

-- CreateIndex
CREATE INDEX "Event_universityId_createdById_createdAt_idx" ON "Event"("universityId", "createdById", "createdAt");

-- CreateIndex
CREATE INDEX "EventRsvp_universityId_userId_status_idx" ON "EventRsvp"("universityId", "userId", "status");

-- CreateIndex
CREATE INDEX "EventRsvp_eventId_status_waitlistPosition_idx" ON "EventRsvp"("eventId", "status", "waitlistPosition");

-- CreateIndex
CREATE UNIQUE INDEX "EventRsvp_eventId_userId_key" ON "EventRsvp"("eventId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "EventTicket_codeHash_key" ON "EventTicket"("codeHash");

-- CreateIndex
CREATE INDEX "EventTicket_universityId_eventId_userId_idx" ON "EventTicket"("universityId", "eventId", "userId");

-- CreateIndex
CREATE INDEX "EventTicket_eventId_revokedAt_idx" ON "EventTicket"("eventId", "revokedAt");

-- CreateIndex
CREATE INDEX "EventStaff_universityId_userId_idx" ON "EventStaff"("universityId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "EventStaff_eventId_userId_key" ON "EventStaff"("eventId", "userId");

-- CreateIndex
CREATE INDEX "EventCheckIn_universityId_eventId_scannedAt_idx" ON "EventCheckIn"("universityId", "eventId", "scannedAt");

-- CreateIndex
CREATE UNIQUE INDEX "EventCheckIn_eventId_userId_key" ON "EventCheckIn"("eventId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "EventCheckIn_eventId_clientScanId_key" ON "EventCheckIn"("eventId", "clientScanId");

-- CreateIndex
CREATE INDEX "EventUpdate_universityId_eventId_createdAt_idx" ON "EventUpdate"("universityId", "eventId", "createdAt");

-- CreateIndex
CREATE INDEX "EventComment_universityId_eventId_parentId_status_createdAt_idx" ON "EventComment"("universityId", "eventId", "parentId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "EventComment_universityId_authorId_createdAt_idx" ON "EventComment"("universityId", "authorId", "createdAt");

-- CreateIndex
CREATE INDEX "EventViewDaily_universityId_eventId_date_idx" ON "EventViewDaily"("universityId", "eventId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "EventViewDaily_eventId_userId_date_key" ON "EventViewDaily"("eventId", "userId", "date");

-- CreateIndex
CREATE INDEX "OfficialAccount_universityId_status_category_idx" ON "OfficialAccount"("universityId", "status", "category");

-- CreateIndex
CREATE UNIQUE INDEX "OfficialAccount_universityId_slug_key" ON "OfficialAccount"("universityId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "OfficialAccount_universityId_nameNormalized_key" ON "OfficialAccount"("universityId", "nameNormalized");

-- CreateIndex
CREATE INDEX "OfficialAccountStaff_universityId_userId_idx" ON "OfficialAccountStaff"("universityId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "OfficialAccountStaff_officialAccountId_userId_key" ON "OfficialAccountStaff"("officialAccountId", "userId");

-- CreateIndex
CREATE INDEX "Announcement_universityId_status_publishedAt_idx" ON "Announcement"("universityId", "status", "publishedAt");

-- CreateIndex
CREATE INDEX "Announcement_universityId_officialAccountId_status_publishA_idx" ON "Announcement"("universityId", "officialAccountId", "status", "publishAt");

-- CreateIndex
CREATE INDEX "Announcement_universityId_audienceKind_publishedAt_idx" ON "Announcement"("universityId", "audienceKind", "publishedAt");

-- CreateIndex
CREATE INDEX "AnnouncementAttachment_universityId_announcementId_idx" ON "AnnouncementAttachment"("universityId", "announcementId");

-- CreateIndex
CREATE INDEX "AnnouncementAck_universityId_userId_ackedAt_idx" ON "AnnouncementAck"("universityId", "userId", "ackedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AnnouncementAck_announcementId_userId_key" ON "AnnouncementAck"("announcementId", "userId");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_officialAccountId_fkey" FOREIGN KEY ("officialAccountId") REFERENCES "OfficialAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "CampusPlace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRsvp" ADD CONSTRAINT "EventRsvp_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRsvp" ADD CONSTRAINT "EventRsvp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventTicket" ADD CONSTRAINT "EventTicket_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventTicket" ADD CONSTRAINT "EventTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventStaff" ADD CONSTRAINT "EventStaff_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventStaff" ADD CONSTRAINT "EventStaff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventCheckIn" ADD CONSTRAINT "EventCheckIn_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventCheckIn" ADD CONSTRAINT "EventCheckIn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventCheckIn" ADD CONSTRAINT "EventCheckIn_scannedById_fkey" FOREIGN KEY ("scannedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventUpdate" ADD CONSTRAINT "EventUpdate_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventUpdate" ADD CONSTRAINT "EventUpdate_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventComment" ADD CONSTRAINT "EventComment_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventComment" ADD CONSTRAINT "EventComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventComment" ADD CONSTRAINT "EventComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "EventComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventViewDaily" ADD CONSTRAINT "EventViewDaily_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventViewDaily" ADD CONSTRAINT "EventViewDaily_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficialAccountStaff" ADD CONSTRAINT "OfficialAccountStaff_officialAccountId_fkey" FOREIGN KEY ("officialAccountId") REFERENCES "OfficialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficialAccountStaff" ADD CONSTRAINT "OfficialAccountStaff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_officialAccountId_fkey" FOREIGN KEY ("officialAccountId") REFERENCES "OfficialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementAttachment" ADD CONSTRAINT "AnnouncementAttachment_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementAck" ADD CONSTRAINT "AnnouncementAck_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementAck" ADD CONSTRAINT "AnnouncementAck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- One active ticket per going RSVP. Revoked tickets stay as history.
CREATE UNIQUE INDEX "EventTicket_one_active_per_user" ON "EventTicket"("eventId", "userId") WHERE "revokedAt" IS NULL;

-- Denormalised counters may never go negative.
ALTER TABLE "Event" ADD CONSTRAINT "Event_counts_non_negative" CHECK ("goingCount" >= 0 AND "interestedCount" >= 0 AND "waitlistCount" >= 0 AND "checkedInCount" >= 0);
ALTER TABLE "Event" ADD CONSTRAINT "Event_capacity_positive" CHECK ("capacity" IS NULL OR "capacity" > 0);
ALTER TABLE "Event" ADD CONSTRAINT "Event_time_order" CHECK ("endsAt" > "startsAt");
