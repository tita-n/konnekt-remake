-- CreateEnum
CREATE TYPE "PostType" AS ENUM ('POST', 'QUESTION', 'POLL', 'REPOST');

-- CreateEnum
CREATE TYPE "AudienceKind" AS ENUM ('PUBLIC', 'COLLEGE', 'FACULTY', 'DEPARTMENT', 'LEVEL');

-- CreateEnum
CREATE TYPE "PostStatus" AS ENUM ('ACTIVE', 'REMOVED', 'DELETED');

-- CreateEnum
CREATE TYPE "CommentStatus" AS ENUM ('ACTIVE', 'REMOVED', 'DELETED');

-- CreateEnum
CREATE TYPE "ReactionTargetType" AS ENUM ('POST', 'COMMENT');

-- CreateEnum
CREATE TYPE "MentionSourceType" AS ENUM ('POST', 'COMMENT');

-- CreateEnum
CREATE TYPE "ReportTargetType" AS ENUM ('POST', 'COMMENT');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('SPAM', 'HARASSMENT', 'HATE_OR_ABUSE', 'NUDITY_OR_SEXUAL_CONTENT', 'VIOLENCE_OR_THREATS', 'IMPERSONATION', 'FALSE_INFORMATION', 'SOMETHING_ELSE');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ModerationTargetType" AS ENUM ('POST', 'COMMENT', 'USER');

-- CreateEnum
CREATE TYPE "ModerationActionType" AS ENUM ('REMOVE', 'KEEP', 'WARN', 'SUSPEND');

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "type" "PostType" NOT NULL DEFAULT 'POST',
    "body" TEXT NOT NULL,
    "audiencePath" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "audienceKind" "AudienceKind" NOT NULL DEFAULT 'PUBLIC',
    "repostOfId" TEXT,
    "questionTitle" TEXT,
    "topicTag" TEXT,
    "acceptedCommentId" TEXT,
    "status" "PostStatus" NOT NULL DEFAULT 'ACTIVE',
    "rankAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt" TIMESTAMP(3),
    "removedAt" TIMESTAMP(3),
    "moderationReason" TEXT,
    "idempotencyKey" TEXT,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "reactionCount" INTEGER NOT NULL DEFAULT 0,
    "repostCount" INTEGER NOT NULL DEFAULT 0,
    "bookmarkCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostRevision" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "editorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostMedia" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "url" TEXT,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "alt" TEXT,

    CONSTRAINT "PostMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Poll" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Poll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PollOption" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "voteCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PollOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PollVote" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PollVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "parentId" TEXT,
    "body" TEXT NOT NULL,
    "status" "CommentStatus" NOT NULL DEFAULT 'ACTIVE',
    "helpfulCount" INTEGER NOT NULL DEFAULT 0,
    "removedAt" TIMESTAMP(3),
    "moderationReason" TEXT,
    "editedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reaction" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetType" "ReactionTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bookmark" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bookmark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hashtag" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Hashtag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostHashtag" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "hashtagId" TEXT NOT NULL,

    CONSTRAINT "PostHashtag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mention" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "sourceType" "MentionSourceType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "mentionedUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Mention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Draft" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "PostType" NOT NULL DEFAULT 'POST',
    "payload" JSONB NOT NULL DEFAULT '{}',
    "audience" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Draft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mute" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mutedUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Mute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Block" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "blockedUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Block_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "targetType" "ReportTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" "ReportReason" NOT NULL,
    "details" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationAction" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "reportId" TEXT,
    "moderatorId" TEXT NOT NULL,
    "targetType" "ModerationTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "action" "ModerationActionType" NOT NULL,
    "reason" TEXT NOT NULL,
    "durationDays" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Strike" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "moderationActionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Strike_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Post_acceptedCommentId_key" ON "Post"("acceptedCommentId");

-- CreateIndex
CREATE UNIQUE INDEX "Post_idempotencyKey_key" ON "Post"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Post_universityId_status_rankAt_id_idx" ON "Post"("universityId", "status", "rankAt", "id");

-- CreateIndex
CREATE INDEX "Post_universityId_audienceKind_rankAt_idx" ON "Post"("universityId", "audienceKind", "rankAt");

-- CreateIndex
CREATE INDEX "Post_universityId_authorId_createdAt_idx" ON "Post"("universityId", "authorId", "createdAt");

-- CreateIndex
CREATE INDEX "Post_repostOfId_idx" ON "Post"("repostOfId");

-- CreateIndex
CREATE INDEX "Post_createdAt_idx" ON "Post"("createdAt");

-- CreateIndex
CREATE INDEX "PostRevision_universityId_postId_createdAt_idx" ON "PostRevision"("universityId", "postId", "createdAt");

-- CreateIndex
CREATE INDEX "PostMedia_universityId_postId_order_idx" ON "PostMedia"("universityId", "postId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "Poll_postId_key" ON "Poll"("postId");

-- CreateIndex
CREATE INDEX "Poll_universityId_endsAt_idx" ON "Poll"("universityId", "endsAt");

-- CreateIndex
CREATE INDEX "PollOption_universityId_pollId_order_idx" ON "PollOption"("universityId", "pollId", "order");

-- CreateIndex
CREATE INDEX "PollVote_universityId_userId_idx" ON "PollVote"("universityId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "poll_vote_one_per_user" ON "PollVote"("pollId", "userId");

-- CreateIndex
CREATE INDEX "Comment_universityId_postId_parentId_status_createdAt_idx" ON "Comment"("universityId", "postId", "parentId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Comment_universityId_authorId_createdAt_idx" ON "Comment"("universityId", "authorId", "createdAt");

-- CreateIndex
CREATE INDEX "Reaction_universityId_targetId_idx" ON "Reaction"("universityId", "targetId");

-- CreateIndex
CREATE INDEX "Reaction_universityId_userId_idx" ON "Reaction"("universityId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "reaction_one_per_user" ON "Reaction"("targetType", "targetId", "userId");

-- CreateIndex
CREATE INDEX "Bookmark_universityId_userId_createdAt_idx" ON "Bookmark"("universityId", "userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "bookmark_one_per_user" ON "Bookmark"("userId", "postId");

-- CreateIndex
CREATE INDEX "Hashtag_universityId_createdAt_idx" ON "Hashtag"("universityId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Hashtag_universityId_tag_key" ON "Hashtag"("universityId", "tag");

-- CreateIndex
CREATE INDEX "PostHashtag_universityId_hashtagId_postId_idx" ON "PostHashtag"("universityId", "hashtagId", "postId");

-- CreateIndex
CREATE UNIQUE INDEX "PostHashtag_postId_hashtagId_key" ON "PostHashtag"("postId", "hashtagId");

-- CreateIndex
CREATE INDEX "Mention_universityId_mentionedUserId_createdAt_idx" ON "Mention"("universityId", "mentionedUserId", "createdAt");

-- CreateIndex
CREATE INDEX "Mention_sourceType_sourceId_idx" ON "Mention"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "Draft_universityId_userId_updatedAt_idx" ON "Draft"("universityId", "userId", "updatedAt");

-- CreateIndex
CREATE INDEX "Mute_universityId_mutedUserId_idx" ON "Mute"("universityId", "mutedUserId");

-- CreateIndex
CREATE UNIQUE INDEX "mute_one_per_user" ON "Mute"("userId", "mutedUserId");

-- CreateIndex
CREATE INDEX "Block_universityId_blockedUserId_idx" ON "Block"("universityId", "blockedUserId");

-- CreateIndex
CREATE UNIQUE INDEX "block_one_per_user" ON "Block"("userId", "blockedUserId");

-- CreateIndex
CREATE INDEX "Report_universityId_status_createdAt_idx" ON "Report"("universityId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Report_universityId_targetType_targetId_idx" ON "Report"("universityId", "targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "report_one_per_user" ON "Report"("reporterId", "targetType", "targetId");

-- CreateIndex
CREATE INDEX "ModerationAction_universityId_createdAt_idx" ON "ModerationAction"("universityId", "createdAt");

-- CreateIndex
CREATE INDEX "ModerationAction_universityId_targetType_targetId_idx" ON "ModerationAction"("universityId", "targetType", "targetId");

-- CreateIndex
CREATE INDEX "ModerationAction_universityId_moderatorId_createdAt_idx" ON "ModerationAction"("universityId", "moderatorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Strike_moderationActionId_key" ON "Strike"("moderationActionId");

-- CreateIndex
CREATE INDEX "Strike_universityId_userId_createdAt_idx" ON "Strike"("universityId", "userId", "createdAt");

-- CreateIndex
CREATE INDEX "Strike_universityId_expiresAt_idx" ON "Strike"("universityId", "expiresAt");

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_repostOfId_fkey" FOREIGN KEY ("repostOfId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_acceptedCommentId_fkey" FOREIGN KEY ("acceptedCommentId") REFERENCES "Comment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostRevision" ADD CONSTRAINT "PostRevision_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostMedia" ADD CONSTRAINT "PostMedia_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Poll" ADD CONSTRAINT "Poll_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollOption" ADD CONSTRAINT "PollOption_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "Poll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "Poll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "PollOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bookmark" ADD CONSTRAINT "Bookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostHashtag" ADD CONSTRAINT "PostHashtag_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostHashtag" ADD CONSTRAINT "PostHashtag_hashtagId_fkey" FOREIGN KEY ("hashtagId") REFERENCES "Hashtag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mention" ADD CONSTRAINT "Mention_mentionedUserId_fkey" FOREIGN KEY ("mentionedUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Draft" ADD CONSTRAINT "Draft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mute" ADD CONSTRAINT "Mute_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mute" ADD CONSTRAINT "Mute_mutedUserId_fkey" FOREIGN KEY ("mutedUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_blockedUserId_fkey" FOREIGN KEY ("blockedUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationAction" ADD CONSTRAINT "ModerationAction_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationAction" ADD CONSTRAINT "ModerationAction_moderatorId_fkey" FOREIGN KEY ("moderatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Strike" ADD CONSTRAINT "Strike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Strike" ADD CONSTRAINT "Strike_moderationActionId_fkey" FOREIGN KEY ("moderationActionId") REFERENCES "ModerationAction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
