"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  CloudOff,
  Flag,
  Home,
  Layers,
  Settings,
  TrendingUp,
  Users,
  ClipboardCheck,
} from "lucide-react";
import { LogoMark, UniversityShieldMark } from "@/components/brand/logo";
import { ClayIllustration } from "@/components/ui/clay-illustrations";
import type { CommentView, DraftView, PostView } from "@/lib/posts/types";
import type { ReportDetail, ReportQueueItem, RestrictedStudentView, StudentModerationHistory } from "@/lib/services/moderation";
import type { ProfileView as ProfileData } from "@/lib/services/profile";
import { TopBar } from "@/components/app/top-bar";
import { BottomTabBar } from "@/components/app/bottom-tab-bar";
import { PostCard } from "@/components/pulse/post-card";
import { Composer } from "@/components/pulse/composer";
import { CommentSection } from "@/components/pulse/comments";
import { DraftsList } from "@/components/pulse/drafts-list";
import { ProfileView } from "@/components/student/profile-view";
import { RestrictedPeople } from "@/components/settings/restricted-people";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { Card, Skeleton, SkeletonText } from "@/components/ui/display";
import { ReportDetailPane } from "@/components/admin/reports-workspace";
import { StudentDetailsDrawer } from "@/components/admin/student-details-drawer";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "feed", label: "Pulse & Cards" },
  { id: "composer", label: "Composer" },
  { id: "detail", label: "Detail & Thread" },
  { id: "states", label: "States, Drafts & Blocked" },
  { id: "profiles", label: "Profiles & Hashtag" },
  { id: "admin", label: "Admin & Moderation" },
] as const;

type ShowcaseTab = (typeof TABS)[number]["id"];

const NOW = "2026-11-18T10:00:00.000Z";
const HOUR_AGO = "2026-11-18T09:00:00.000Z";
const TWO_HOURS_AGO = "2026-11-18T08:00:00.000Z";
const FOUR_HOURS_AGO = "2026-11-18T06:00:00.000Z";

const DEMO_POSTS: PostView[] = [
  {
    id: "demo-post-1",
    type: "POST",
    body: "Our demo day went better than expected. Thanks to everyone who showed up. #TechSummit",
    audienceKind: "DEPARTMENT",
    audienceLabel: "My Department · Software Engineering",
    community: null,
    status: "ACTIVE",
    createdAt: HOUR_AGO,
    editedAt: null,
    questionTitle: null,
    topicTag: null,
    acceptedCommentId: null,
    moderationReason: null,
    author: {
      id: "u-chinedu",
      username: "chinedu_okafor",
      fullName: "Chinedu Okafor",
      photoUrl: null,
      isOfficial: false,
      level: 300,
      departmentName: "Software Engineering",
    },
    media: [
      {
        id: "m-1",
        url: "/seed/campus-quad.svg",
        width: 1200,
        height: 675,
        alt: "Students celebrating outside Nova University building",
      },
    ],
    poll: null,
    repostOf: null,
    commentCount: 24,
    reactionCount: 128,
    repostCount: 32,
    bookmarkCount: 19,
    viewer: { reacted: true, bookmarked: false, canInteract: true, isMember: false, role: null, muted: false },
    isOwner: true,
  },
  {
    id: "demo-question-1",
    type: "QUESTION",
    body: "Does anyone have the CSC 204 past questions? Especially 2023 and 2024 mid-semester papers.",
    audienceKind: "LEVEL",
    audienceLabel: "My Level · Software Engineering 300L",
    community: null,
    status: "ACTIVE",
    createdAt: TWO_HOURS_AGO,
    editedAt: null,
    questionTitle: "Does anyone have the CSC 204 past questions?",
    topicTag: "CSC 204",
    acceptedCommentId: "c-accepted",
    moderationReason: null,
    author: {
      id: "u-aisha",
      username: "aisha_bello",
      fullName: "Aisha Bello",
      photoUrl: null,
      isOfficial: false,
      level: 300,
      departmentName: "Software Engineering",
    },
    media: [],
    poll: null,
    repostOf: null,
    commentCount: 18,
    reactionCount: 42,
    repostCount: 6,
    bookmarkCount: 11,
    viewer: { reacted: false, bookmarked: true, canInteract: true, isMember: false, role: null, muted: false },
    isOwner: false,
  },
  {
    id: "demo-poll-1",
    type: "POLL",
    body: "Best place to study at night?",
    audienceKind: "PUBLIC",
    audienceLabel: "Public · Nova University",
    community: null,
    status: "ACTIVE",
    createdAt: FOUR_HOURS_AGO,
    editedAt: null,
    questionTitle: null,
    topicTag: null,
    acceptedCommentId: null,
    moderationReason: null,
    author: {
      id: "u-tunde",
      username: "tunde_adeyemi",
      fullName: "Tunde Adeyemi",
      photoUrl: null,
      isOfficial: false,
      level: 400,
      departmentName: "Mechanical Engineering",
    },
    media: [],
    poll: {
      id: "poll-1",
      endsAt: "2026-11-20T10:00:00.000Z",
      totalVotes: 312,
      options: [
        { id: "opt-1", text: "University Library", count: 144, percent: 46 },
        { id: "opt-2", text: "Faculty Reading Room", count: 119, percent: 38 },
        { id: "opt-3", text: "My Hostel", count: 49, percent: 16 },
      ],
      hasVoted: true,
      votedOptionId: "opt-1",
      resultsVisible: true,
      isOpen: true,
    },
    repostOf: null,
    commentCount: 26,
    reactionCount: 65,
    repostCount: 14,
    bookmarkCount: 8,
    viewer: { reacted: false, bookmarked: false, canInteract: true, isMember: false, role: null, muted: false },
    isOwner: false,
  },
  {
    id: "demo-repost-1",
    type: "REPOST",
    body: "Engineering students don't miss this one tomorrow!",
    audienceKind: "COLLEGE",
    audienceLabel: "My College · College of Engineering",
    community: null,
    status: "ACTIVE",
    createdAt: FOUR_HOURS_AGO,
    editedAt: null,
    questionTitle: null,
    topicTag: null,
    acceptedCommentId: null,
    moderationReason: null,
    author: {
      id: "u-ngozi",
      username: "ngozi_eze",
      fullName: "Ngozi Eze",
      photoUrl: null,
      isOfficial: false,
      level: 300,
      departmentName: "Mass Communication",
    },
    media: [],
    poll: null,
    repostOf: {
      id: "orig-1",
      body: "Reminder: The Engineering Design Workshop holds tomorrow at 10:00 AM in the Central Lab. Don't forget to come with your laptops.",
      createdAt: "2026-11-18T02:00:00.000Z",
      status: "ACTIVE",
      author: {
        id: "u-ibrahim",
        username: "ibrahim_musa",
        fullName: "Ibrahim Musa",
        photoUrl: null,
        isOfficial: true,
        level: 400,
        departmentName: "Mechanical Engineering",
      },
    },
    commentCount: 9,
    reactionCount: 73,
    repostCount: 17,
    bookmarkCount: 5,
    viewer: { reacted: true, bookmarked: false, canInteract: true, isMember: false, role: null, muted: false },
    isOwner: false,
  },
  {
    id: "demo-removed-1",
    type: "POST",
    body: "",
    audienceKind: "DEPARTMENT",
    audienceLabel: "My Department · Software Engineering",
    community: null,
    status: "REMOVED",
    createdAt: FOUR_HOURS_AGO,
    editedAt: null,
    questionTitle: null,
    topicTag: null,
    acceptedCommentId: null,
    moderationReason: "Breaking the community rules",
    author: {
      id: "u-chinedu",
      username: "chinedu_okafor",
      fullName: "Chinedu Okafor",
      photoUrl: null,
      isOfficial: false,
      level: 300,
      departmentName: "Software Engineering",
    },
    media: [],
    poll: null,
    repostOf: null,
    commentCount: 24,
    reactionCount: 0,
    repostCount: 6,
    bookmarkCount: 0,
    viewer: { reacted: false, bookmarked: false, canInteract: true, isMember: false, role: null, muted: false },
    isOwner: false,
  },
];

const DEMO_COMMENTS: CommentView[] = [
  {
    id: "c-accepted",
    postId: "demo-question-1",
    parentId: null,
    body: "I uploaded the 2021–2024 CSC 204 past questions pack in our department Drive folder. Start with Section B on recurrence relations — Dr. Salami repeats those structures.",
    status: "ACTIVE",
    helpfulCount: 14,
    createdAt: HOUR_AGO,
    editedAt: null,
    moderationReason: null,
    author: {
      id: "u-tunde",
      username: "tunde_adeyemi",
      fullName: "Tunde Adeyemi",
      photoUrl: null,
      isOfficial: false,
    },
    viewer: { reacted: true, helpful: true },
    isOwner: false,
    replies: [
      {
        id: "c-reply-1",
        postId: "demo-question-1",
        parentId: "c-accepted",
        body: "Saved my night! Question 4(b) from 2023 literally matches today's tutorial sheet.",
        status: "ACTIVE",
        helpfulCount: 3,
        createdAt: NOW,
        editedAt: null,
        moderationReason: null,
        author: {
          id: "u-aisha",
          username: "aisha_bello",
          fullName: "Aisha Bello",
          photoUrl: null,
          isOfficial: false,
        },
        viewer: { reacted: true, helpful: false },
        isOwner: false,
      },
    ],
    replyCount: 1,
  },
  {
    id: "c-second",
    postId: "demo-question-1",
    parentId: null,
    body: "Also check the Engineering Library reserve desk — they keep the printed booklet until 8 PM.",
    status: "ACTIVE",
    helpfulCount: 5,
    createdAt: HOUR_AGO,
    editedAt: null,
    moderationReason: null,
    author: {
      id: "u-chinedu",
      username: "chinedu_okafor",
      fullName: "Chinedu Okafor",
      photoUrl: null,
      isOfficial: false,
    },
    viewer: { reacted: false, helpful: false },
    isOwner: true,
    replies: [],
    replyCount: 0,
  },
];

const DEMO_DRAFTS: DraftView[] = [
  {
    id: "draft-1",
    type: "POST",
    payload: {
      body: "Here is the breakdown of our final year project sprint milestones and demo schedule for Software Engineering 400L.",
      media: [
        {
          publicId: "demo",
          url: "/seed/campus-quad.svg",
          width: 800,
          height: 500,
          alt: "Campus banner",
        },
      ],
    },
    audience: { id: "dept", label: "My Department · Software Engineering", kind: "DEPARTMENT" },
    updatedAt: HOUR_AGO,
  },
  {
    id: "draft-2",
    type: "QUESTION",
    payload: {
      questionTitle: "Who is supervising SWE 412 hardware lab presentations?",
      body: "Need to confirm whether team reports are due before Friday 4 PM.",
      topicTag: "SWE 412",
    },
    audience: { id: "level", label: "My Level · 400 Level", kind: "LEVEL" },
    updatedAt: FOUR_HOURS_AGO,
  },
];

const DEMO_RESTRICTED: RestrictedStudentView[] = [
  {
    id: "r-1",
    username: "ibrahim_musa",
    fullName: "Ibrahim Musa",
    photoUrl: null,
    departmentName: "Mechanical Engineering",
    level: 400,
  },
  {
    id: "r-2",
    username: "ngozi_eze",
    fullName: "Ngozi Eze",
    photoUrl: null,
    departmentName: "Mass Communication",
    level: 300,
  },
];

const DEMO_PROFILE_SELF: ProfileData = {
  id: "u-chinedu",
  username: "chinedu_okafor",
  fullName: "Chinedu Okafor",
  photoUrl: null,
  bio: "Software Engineering student building campus tools, loving design systems and midnight hackathons.",
  status: "VERIFIED",
  isPostgraduate: false,
  interests: ["Coding", "Photography", "Music"],
  createdAt: new Date("2026-09-01T00:00:00.000Z"),
  level: 300,
  departmentName: "Software Engineering",
  facultyName: "College of Computing",
  collegeName: "College of Computing",
  departmentVisibility: "UNIVERSITY",
  levelVisibility: "UNIVERSITY",
  isOfficial: false,
};

const DEMO_PROFILE_OTHER: ProfileData = {
  ...DEMO_PROFILE_SELF,
  id: "u-aisha",
  username: "aisha_bello",
  fullName: "Aisha Bello",
  bio: "Distributed systems enthusiast and IEEE student chapter organizer.",
  interests: ["Coding", "Design"],
  levelVisibility: "NOBODY",
};

const DEMO_REPORT_QUEUE: ReportQueueItem[] = [
  {
    id: "rep_0143_alpha",
    reason: "HARASSMENT",
    reasonLabel: "Harassment",
    severity: "high",
    reporterCount: 3,
    status: "PENDING",
    createdAt: TWO_HOURS_AGO,
    targetType: "POST",
    targetId: "p-rep-1",
    excerpt: "You people are just lazy and useless in this department. No wonder we always struggle in group projects.",
    authorName: "Chinedu Okafor",
    authorUsername: "chinedu_okafor",
  },
  {
    id: "rep_0142_beta",
    reason: "SPAM",
    reasonLabel: "Spam",
    severity: "medium",
    reporterCount: 3,
    status: "PENDING",
    createdAt: FOUR_HOURS_AGO,
    targetType: "POST",
    targetId: "p-rep-2",
    excerpt: "Check out this site for easy money. It works 100% for students...",
    authorName: "Aisha Bello",
    authorUsername: "aisha_bello",
  },
];

const DEMO_REPORT_DETAIL: ReportDetail = {
  id: "rep_0143_alpha",
  status: "PENDING",
  createdAt: TWO_HOURS_AGO,
  reason: "HARASSMENT",
  reasonLabel: "Harassment",
  details: "Repeated remarks directed at classmates.",
  severity: "high",
  reporterCount: 3,
  targetType: "POST",
  targetId: "p-rep-1",
  target: {
    body: "You people are just lazy and useless in this department. No wonder we always struggle in group projects.",
    status: "ACTIVE",
    createdAt: TWO_HOURS_AGO,
    authorId: "u-chinedu",
    authorName: "Chinedu Okafor",
    authorUsername: "chinedu_okafor",
    authorStatus: "VERIFIED",
    previousReports: 2,
    activeStrikes: 1,
    media: [
      {
        url: "/seed/campus-quad.svg",
        width: 1200,
        height: 675,
      },
    ],
  },
  activity: [
    {
      id: "act-1",
      action: "WARN",
      reason: "3 students reported this post (Harassment ×2, Spam ×1).",
      createdAt: TWO_HOURS_AGO,
      moderatorName: "Funke A.",
    },
  ],
};

const DEMO_STUDENT_HISTORY: StudentModerationHistory = {
  user: {
    id: "u-chinedu",
    username: "chinedu_okafor",
    fullName: "Chinedu Okafor",
    photoUrl: null,
    status: "VERIFIED",
    level: 300,
    departmentName: "Software Engineering",
  },
  activeStrikes: 1,
  reportsAgainst: 3,
  history: [
    {
      id: "h-1",
      action: "WARN",
      reason: "Inappropriate and disrespectful remarks toward another student. First strike issued.",
      label: "Post removed + Warning",
      reasonLabel: "Harassment",
      createdAt: "2026-11-12T10:00:00.000Z",
      moderatorName: "Funke A.",
      durationDays: null,
    },
    {
      id: "h-2",
      action: "REMOVE",
      reason: "Repeated promotional link in multiple groups.",
      label: "Post removed",
      reasonLabel: "Spam",
      createdAt: "2026-09-28T10:00:00.000Z",
      moderatorName: "Funke A.",
      durationDays: null,
    },
  ],
};

export function Phase1Showcase() {
  const [activeTab, setActiveTab] = useState<ShowcaseTab>("feed");
  const [composerMode, setComposerMode] = useState<"POST" | "QUESTION" | "POLL">("POST");

  return (
    <div className="space-y-6">
      <nav aria-label="Showcase screens" className="flex flex-wrap gap-2 rounded-[18px] border border-border bg-surface p-2 shadow-card">
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "h-9 rounded-full px-4 text-small font-semibold transition",
                active ? "bg-accent text-accent-fg shadow-sm" : "text-fg-muted hover:bg-surface-2 hover:text-fg",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      {activeTab === "feed" ? (
        <div className="grid gap-6 lg:grid-cols-[410px_1fr] lg:items-start">
          {/* Mobile Frame */}
          <div className="relative overflow-hidden rounded-[28px] border border-border bg-bg shadow-modal [transform:translateZ(0)]">
            <TopBar
              university={{ name: "Nova University", shortName: "NU", logoUrl: null }}
              unreadNotifications={7}
              user={{ fullName: "Chinedu Okafor", username: "chinedu_okafor", photoUrl: null, status: "VERIFIED", roles: [] }}
            />
            <div className="border-b border-border bg-bg/95 px-3 py-2.5">
              <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                {["All", "My Level", "My Department", "My College", "Public"].map((label, i) => (
                  <span
                    key={label}
                    className={cn(
                      "shrink-0 rounded-full px-3.5 py-1.5 text-small font-semibold",
                      i === 0 ? "bg-accent text-accent-fg" : "border border-border bg-surface text-fg-muted",
                    )}
                  >
                    {label}
                  </span>
                ))}
              </div>
              <div className="mt-2 flex justify-center">
                <span className="inline-flex items-center gap-1 rounded-full bg-accent px-3.5 py-1 text-tiny font-semibold text-accent-fg shadow-md">
                  ↑ 5 new posts
                </span>
              </div>
            </div>

            <div className="space-y-3 p-3">
              <PostCard post={DEMO_POSTS[0]!} />
              <PostCard post={DEMO_POSTS[1]!} />
              <section className="rounded-card bg-accent-soft px-3.5 py-3">
                <p className="flex items-center gap-1.5 text-small font-semibold text-fg">
                  <TrendingUp aria-hidden="true" className="size-4 text-accent-ink" />
                  Trending on campus
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {["#ExamTimetable", "#TechSummit", "#HostelWater", "#FootballFinals"].map((tag) => (
                    <span
                      key={tag}
                      className="rounded-chip border border-border bg-surface px-3 py-1 text-tiny font-semibold text-accent-ink"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </section>
              <PostCard post={DEMO_POSTS[2]!} />
              <PostCard post={DEMO_POSTS[3]!} />
            </div>

            <BottomTabBar />
          </div>

          {/* Interactive notes & removed variant */}
          <div className="space-y-4">
            <Card className="p-4">
              <h3 className="font-display text-h3 text-fg">Interactive PostCard Controls</h3>
              <p className="mt-1 text-small text-fg-muted">
                Tap <strong className="text-fg">⋯</strong> on any post card to test Own Post Menu (Edit, Delete confirmation dialog, Copy link), Other Student Menu (Mute, Block, 3-step Report flow), Share Sheet, and Image Viewer lightbox.
              </p>
            </Card>
            <PostCard post={DEMO_POSTS[4]!} />
          </div>
        </div>
      ) : null}

      {activeTab === "composer" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {(["POST", "QUESTION", "POLL"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setComposerMode(mode)}
                className={cn(
                  "h-9 rounded-full px-4 text-small font-semibold transition",
                  composerMode === mode ? "bg-accent text-accent-fg" : "border border-border bg-surface text-fg-muted hover:bg-surface-2",
                )}
              >
                {mode.charAt(0) + mode.slice(1).toLowerCase()} composer
              </button>
            ))}
          </div>
          <div className="overflow-hidden rounded-[24px] border border-border bg-surface shadow-modal">
            <Composer
              key={composerMode}
              viewer={{
                id: "u-chinedu",
                fullName: "Chinedu Okafor",
                username: "chinedu_okafor",
                photoUrl: null,
                level: 300,
                departmentName: "Software Engineering",
              }}
              audiences={[
                { id: "level", label: "My Level · 300L", description: "Students in Software Engineering 300L", scope: "level" },
                { id: "department", label: "My Department · Software Engineering", description: "All levels in Software Engineering", scope: "department" },
                { id: "college", label: "My College · Computing", description: "Everyone in College of Computing", scope: "college" },
                { id: "public", label: "Public · Nova University", description: "Verified students across campus", scope: "public" },
              ]}
              initialType={composerMode}
            />
          </div>
        </div>
      ) : null}

      {activeTab === "detail" ? (
        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
          <div className="relative overflow-hidden rounded-[24px] border border-border bg-bg shadow-card [transform:translateZ(0)]">
            <header className="flex h-12 items-center justify-between border-b border-border bg-surface px-3">
              <ArrowLeft aria-hidden="true" className="size-5 text-fg" />
              <p className="font-display text-[1rem] font-bold text-fg">Question</p>
              <span className="size-5" aria-hidden="true" />
            </header>
            <PostCard post={DEMO_POSTS[1]!} expanded compact />
            <CommentSection
              post={DEMO_POSTS[1]!}
              initialComments={DEMO_COMMENTS}
              initialSort="top"
              viewer={{ id: "u-aisha", username: "aisha_bello", fullName: "Aisha Bello", photoUrl: null }}
            />
          </div>

          <div className="space-y-6">
            <div className="relative overflow-hidden rounded-[24px] border border-border bg-bg shadow-card [transform:translateZ(0)]">
              <header className="flex h-12 items-center justify-between border-b border-border bg-surface px-3">
                <ArrowLeft aria-hidden="true" className="size-5 text-fg" />
                <p className="font-display text-[1rem] font-bold text-fg">Post</p>
                <span className="size-5" aria-hidden="true" />
              </header>
              <PostCard post={DEMO_POSTS[4]!} expanded compact />
              <CommentSection
                post={DEMO_POSTS[4]!}
                initialComments={DEMO_COMMENTS.slice(1)}
                initialSort="top"
                viewer={{ id: "u-chinedu", username: "chinedu_okafor", fullName: "Chinedu Okafor", photoUrl: null }}
              />
            </div>

            <div className="flex flex-col items-center rounded-card border border-border bg-surface px-6 py-10 text-center">
              <ClayIllustration kind="unavailableEnvelope" />
              <h3 className="mt-4 font-display text-h2 text-fg">This post isn&apos;t available</h3>
              <p className="mt-1.5 max-w-xs text-small text-fg-muted">
                It may have been deleted, or it isn&apos;t shared with you.
              </p>
              <span className="mt-5 inline-flex h-11 items-center rounded-button bg-accent px-6 text-small font-semibold text-accent-fg">
                Back to Pulse
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === "states" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <Card className="p-4">
              <h3 className="mb-3 font-display text-h3 text-fg">Pulse Loading Skeletons</h3>
              <div className="space-y-3">
                {[0, 1].map((idx) => (
                  <div key={idx} className="rounded-card border border-border bg-surface p-4">
                    <Skeleton className="h-4 w-1/2" />
                    <SkeletonText lines={3} className="mt-3" />
                  </div>
                ))}
              </div>
            </Card>
            <div className="rounded-card border border-border bg-surface">
              <EmptyState
                illustration="pulse"
                title="Nothing here yet"
                description="Be the first to post to your level."
                action={
                  <Link href="/compose" className="inline-flex h-11 items-center rounded-button bg-accent px-6 text-small font-semibold text-accent-fg">
                    + Create a post
                  </Link>
                }
              />
            </div>
            <div className="rounded-card border border-border bg-surface">
              <ErrorState description="Check your connection and try again." onRetry={() => undefined} />
            </div>
            <div className="flex min-h-9 items-center gap-2.5 rounded-[12px] border border-warning/30 bg-highlight-soft px-3.5 py-2 text-small font-medium text-highlight-fg">
              <CloudOff aria-hidden="true" className="size-4 shrink-0" />
              You&apos;re offline. Showing saved content.
            </div>
          </div>

          <div className="space-y-6">
            <Card className="p-4">
              <h3 className="mb-3 font-display text-h3 text-fg">Drafts (Swipe or Click Trash)</h3>
              <DraftsList initialDrafts={DEMO_DRAFTS} />
            </Card>
            <Card className="p-4">
              <h3 className="mb-3 font-display text-h3 text-fg">Blocked & Muted People</h3>
              <RestrictedPeople initialBlocked={DEMO_RESTRICTED} initialMuted={[]} />
            </Card>
          </div>
        </div>
      ) : null}

      {activeTab === "profiles" ? (
        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
          <div className="overflow-hidden rounded-[24px] border border-border bg-surface shadow-card">
            <ProfileView
              profile={DEMO_PROFILE_SELF}
              university={{ name: "Nova University", shortName: "NU", accentColor: "#4f46e5" }}
              labels={{}}
              isSelf
              canViewDepartment
              canViewLevel
              posts={[DEMO_POSTS[0]!]}
            />
          </div>
          <div className="space-y-6">
            <div className="overflow-hidden rounded-[24px] border border-border bg-surface shadow-card">
              <ProfileView
                profile={DEMO_PROFILE_OTHER}
                university={{ name: "Nova University", shortName: "NU", accentColor: "#4f46e5" }}
                labels={{}}
                isSelf={false}
                canViewDepartment
                canViewLevel={false}
                posts={[DEMO_POSTS[1]!]}
              />
            </div>

            <div className="overflow-hidden rounded-card border border-border bg-surface">
              <header className="flex h-12 items-center justify-between border-b border-border px-3">
                <ArrowLeft aria-hidden="true" className="size-5 text-fg" />
                <p className="font-display text-[1rem] font-bold text-fg">#TechSummit</p>
                <span className="size-5" aria-hidden="true" />
              </header>
              <div className="grid sm:grid-cols-[1.15fr_1fr]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/seed/tech-summit.svg" alt="" className="h-36 w-full object-cover" />
                <div className="flex flex-col justify-center bg-accent-soft p-4">
                  <p className="font-display text-h2 text-fg">#TechSummit</p>
                  <p className="mt-0.5 text-small text-fg-muted">42 posts at Nova University</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === "admin" ? (
        <div className="space-y-6">
          {/* Split Admin Reports Preview */}
          <div className="grid gap-5 rounded-card border border-border bg-bg p-5 xl:grid-cols-[220px_300px_1fr]">
            <aside className="hidden flex-col justify-between rounded-card border border-border bg-surface p-3 xl:flex">
              <div className="space-y-1">
                <div className="mb-4 flex items-center gap-2 px-2 py-1">
                  <LogoMark className="size-8" />
                  <span className="font-display text-h3 font-bold text-fg">Konnekt</span>
                </div>
                {[
                  { label: "Overview", icon: Home },
                  { label: "Students", icon: Users },
                  { label: "Verification", icon: ClipboardCheck },
                  { label: "Reports", icon: Flag, active: true, badge: "12" },
                  { label: "Academic structure", icon: Layers },
                  { label: "Settings", icon: Settings },
                ].map((item) => (
                  <div
                    key={item.label}
                    className={cn(
                      "flex items-center justify-between rounded-button px-3 py-2 text-small font-semibold",
                      item.active ? "bg-accent-soft text-accent-ink" : "text-fg-muted",
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <item.icon aria-hidden="true" className="size-4" />
                      {item.label}
                    </span>
                    {item.badge ? (
                      <span className="rounded-chip bg-danger-btn px-2 py-0.5 text-[0.6875rem] font-bold text-white">
                        {item.badge}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 border-t border-border pt-3 text-tiny font-semibold text-fg">
                <UniversityShieldMark shortName="NU" className="size-7" />
                Nova University
              </div>
            </aside>

            <div className="space-y-3">
              <h3 className="font-display text-h2 text-fg">Reports</h3>
              <div className="flex gap-2">
                <span className="rounded-chip bg-accent px-3.5 py-1.5 text-tiny font-semibold text-accent-fg">Pending (12)</span>
                <span className="rounded-chip border border-border bg-surface px-3.5 py-1.5 text-tiny font-semibold text-fg-muted">Resolved (48)</span>
              </div>
              {DEMO_REPORT_QUEUE.map((item, idx) => (
                <div
                  key={item.id}
                  className={cn(
                    "rounded-card border p-3.5",
                    idx === 0 ? "border-accent bg-surface ring-1 ring-accent" : "border-border bg-surface",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className={cn("rounded-chip px-2 py-0.5 text-[0.6875rem] font-semibold", idx === 0 ? "bg-danger-soft text-danger" : "bg-highlight-soft text-highlight-fg")}>
                        {idx === 0 ? "High" : "Medium"}
                      </span>
                      <span className="rounded-chip bg-accent-soft px-2 py-0.5 text-[0.6875rem] font-semibold text-accent-ink">
                        {item.reasonLabel}
                      </span>
                    </div>
                    <span className="text-[0.6875rem] text-fg-muted">{item.reporterCount} reports</span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-small text-fg">{item.excerpt}</p>
                </div>
              ))}
            </div>

            <ReportDetailPane report={DEMO_REPORT_DETAIL} previewOnly />
          </div>

          {/* Student Details Drawer Preview */}
          <div className="overflow-hidden rounded-[24px] border border-border bg-surface shadow-modal lg:w-[440px]">
            <StudentDetailsDrawer
              history={DEMO_STUDENT_HISTORY}
              matricNumber="NOU/22/03148"
              previewOnly
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
