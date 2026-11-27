"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowUp,
  Bell,
  Bookmark,
  Building2,
  Camera,
  Check,
  ChevronRight,
  ClipboardList,
  Clock,
  CloudOff,
  Copy,
  FileText,
  Flag,
  HelpCircle,
  IdCard,
  Image as ImageIcon,
  Lock,
  Mail,
  PenLine,
  Plus,
  Repeat2,
  Search,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import type { CommentView, DraftView, PostView } from "@/lib/posts/types";
import type { ReportDetail, ReportQueueItem, RestrictedStudentView, StudentModerationHistory } from "@/lib/services/moderation";
import type { ProfileView as ProfileData } from "@/lib/services/profile";
import type { UniversitySettings } from "@/lib/services/admin";
import { LogoMark, UniversityShieldMark } from "@/components/brand/logo";
import { TopBar } from "@/components/app/top-bar";
import { BottomTabBar, DesktopLeftRail, DesktopTrendingRail } from "@/components/app/bottom-tab-bar";
import { PostCard } from "@/components/pulse/post-card";
import { Composer } from "@/components/pulse/composer";
import { CommentSection } from "@/components/pulse/comments";
import { DraftsList } from "@/components/pulse/drafts-list";
import { ProfileView } from "@/components/student/profile-view";
import { RestrictedPeople } from "@/components/settings/restricted-people";
import { AppearanceSettings } from "@/components/settings/appearance-settings";
import { EmptyState, ErrorState } from "@/components/ui/feedback";
import { Avatar, Card, CountPill, Skeleton, SkeletonText } from "@/components/ui/display";
import { Button, ButtonLink } from "@/components/ui/button";
import { Chip, Checkbox, PasswordField, PasswordStrengthMeter, Switch, TextField } from "@/components/ui/form-controls";
import { CodeInput } from "@/components/ui/code-input";
import { Stepper } from "@/components/ui/navigation";
import { BottomSheet, Dialog } from "@/components/ui/overlays";
import { ClayIllustration } from "@/components/ui/clay-illustrations";
import { RubberStamp } from "@/components/ui/rubber-stamp";
import { AdminShell } from "@/components/admin/admin-shell";
import { ReportsWorkspace } from "@/components/admin/reports-workspace";
import { StudentDetailsDrawer } from "@/components/admin/student-details-drawer";
import { UniversitySettingsForm } from "@/components/admin/university-settings-form";
import { CommunityHub } from "@/components/communities/community-hub";
import { CommunityPage } from "@/components/communities/community-page";
import { CommunitySettings } from "@/components/communities/community-settings";
import { NewCommunityForm } from "@/components/communities/new-community-form";
import { CommunityConsole } from "@/components/admin/community-console";
import { CommunitySearch } from "@/components/communities/community-search";
import { PHASE3_SCREENS, Phase3Showcase } from "./phase3-showcase";
import type {
  CommunityAdminPayload,
  CommunityCardView,
  CommunityInviteView,
  CommunityMemberView,
  CommunityPageView,
  CommunityReportView,
  CommunityResourceView,
  JoinRequestView,
} from "@/lib/communities/types";
import { cn } from "@/lib/utils";

const NOW = "2026-11-18T10:00:00.000Z";
const HOUR_AGO = "2026-11-18T09:00:00.000Z";
const TWO_HOURS_AGO = "2026-11-18T08:00:00.000Z";
const FOUR_HOURS_AGO = "2026-11-18T06:00:00.000Z";

const NOVA_UNI = { name: "Your University", shortName: "Demo", logoUrl: null, accentColor: "#4f46e5", status: "ACTIVE" };
const VIEWER = { id: "u-chinedu", username: "chinedu_okafor", fullName: "Chinedu Okafor", photoUrl: null, status: "VERIFIED" as const, roles: [{ role: "STUDENT" as const, universityId: "uni-nova" }], level: 300, departmentName: "Software Engineering" };

const POSTS: PostView[] = [
  {
    id: "preview-post-1",
    type: "POST",
    body: "Our demo day went better than expected! Shoutout to everyone from Software Engineering and @aisha_bello for testing the live offline sync. #TechSummit",
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
    author: { id: "u-chinedu", username: "chinedu_okafor", fullName: "Chinedu Okafor", photoUrl: null, isOfficial: false, level: 300, departmentName: "Software Engineering" },
    media: [{ id: "m-1", url: "/seed/campus-quad.svg", width: 1200, height: 675, alt: "Your University campus quad" }],
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
    id: "preview-question-1",
    type: "QUESTION",
    body: "Does anyone have the CSC 204 past questions? Especially 2023 and 2024 mid-semester papers with Dr. Salami's recurrence examples.",
    audienceKind: "LEVEL",
    audienceLabel: "My Level · Software Engineering 300L",
    community: null,
    status: "ACTIVE",
    createdAt: TWO_HOURS_AGO,
    editedAt: null,
    questionTitle: "Does anyone have the CSC 204 past questions?",
    topicTag: "CSC 204",
    acceptedCommentId: null,
    moderationReason: null,
    author: { id: "u-aisha", username: "aisha_bello", fullName: "Aisha Bello", photoUrl: null, isOfficial: false, level: 300, departmentName: "Software Engineering" },
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
    id: "preview-poll-1",
    type: "POLL",
    body: "Best place to study at night before exams start next week?",
    audienceKind: "PUBLIC",
    audienceLabel: "Public · Your University",
    community: null,
    status: "ACTIVE",
    createdAt: FOUR_HOURS_AGO,
    editedAt: null,
    questionTitle: null,
    topicTag: null,
    acceptedCommentId: null,
    moderationReason: null,
    author: { id: "u-tunde", username: "tunde_adeyemi", fullName: "Tunde Adeyemi", photoUrl: null, isOfficial: false, level: 400, departmentName: "Mechanical Engineering" },
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
    id: "preview-repost-1",
    type: "REPOST",
    body: "Engineering students don't miss this one tomorrow morning!",
    audienceKind: "COLLEGE",
    audienceLabel: "My College · Engineering",
    community: null,
    status: "ACTIVE",
    createdAt: FOUR_HOURS_AGO,
    editedAt: null,
    questionTitle: null,
    topicTag: null,
    acceptedCommentId: null,
    moderationReason: null,
    author: { id: "u-ngozi", username: "ngozi_eze", fullName: "Ngozi Eze", photoUrl: null, isOfficial: false, level: 300, departmentName: "Mass Communication" },
    media: [],
    poll: null,
    repostOf: {
      id: "orig-1",
      body: "Reminder: The Engineering Design Workshop holds tomorrow at 10:00 AM in the Central Lab. Bring your laptops.",
      createdAt: "2026-11-18T02:00:00.000Z",
      status: "ACTIVE",
      author: { id: "u-ibrahim", username: "ibrahim_musa", fullName: "Ibrahim Musa", photoUrl: null, isOfficial: true, level: 400, departmentName: "Mechanical Engineering" },
    },
    commentCount: 9,
    reactionCount: 73,
    repostCount: 17,
    bookmarkCount: 5,
    viewer: { reacted: true, bookmarked: false, canInteract: true, isMember: false, role: null, muted: false },
    isOwner: false,
  },
  {
    id: "preview-post-grid",
    type: "POST",
    body: "Snapshots from the Tech Summit hackathon floor and campus library sprints. #Campus #TechSummit",
    audienceKind: "PUBLIC",
    audienceLabel: "Public · Your University",
    community: null,
    status: "ACTIVE",
    createdAt: FOUR_HOURS_AGO,
    editedAt: HOUR_AGO,
    questionTitle: null,
    topicTag: null,
    acceptedCommentId: null,
    moderationReason: null,
    author: { id: "u-funke", username: "funke_adebayo", fullName: "Funke Adebayo", photoUrl: null, isOfficial: true, level: 400, departmentName: "Software Engineering" },
    media: [
      { id: "mg-1", url: "/seed/tech-summit.svg", width: 800, height: 600, alt: "Tech Summit stage" },
      { id: "mg-2", url: "/seed/lecture-hall.svg", width: 800, height: 600, alt: "Lecture hall" },
      { id: "mg-3", url: "/seed/university-library.svg", width: 800, height: 600, alt: "Library reading room" },
      { id: "mg-4", url: "/seed/football-pitch.svg", width: 800, height: 600, alt: "Campus stadium" },
    ],
    poll: null,
    repostOf: null,
    commentCount: 41,
    reactionCount: 1240,
    repostCount: 84,
    bookmarkCount: 52,
    viewer: { reacted: false, bookmarked: true, canInteract: true, isMember: false, role: null, muted: false },
    isOwner: false,
  },
];

const DETAIL_QUESTION: PostView = {
  ...POSTS[1]!,
  acceptedCommentId: "c-accepted",
};

const REMOVED_POST: PostView = {
  ...POSTS[0]!,
  id: "preview-removed",
  status: "REMOVED",
  moderationReason: "Breaking the community rules",
  body: "",
  media: [],
  reactionCount: 0,
  bookmarkCount: 0,
};

const COMMENTS: CommentView[] = [
  {
    id: "c-accepted",
    postId: "preview-question-1",
    parentId: null,
    depth: 0,
    body: "I uploaded the 2021–2024 CSC 204 past questions pack in our department Drive folder. Start with Section B on recurrence relations.",
    status: "ACTIVE",
    helpfulCount: 14,
    createdAt: HOUR_AGO,
    editedAt: null,
    moderationReason: null,
    author: { id: "u-tunde", username: "tunde_adeyemi", fullName: "Tunde Adeyemi", photoUrl: null, isOfficial: false },
    viewer: { reacted: true, helpful: true },
    isOwner: false,
    replies: [
      {
        id: "c-reply-1",
        postId: "preview-question-1",
        parentId: "c-accepted",
        depth: 1,
        body: "Saved my night! Question 4(b) from 2023 literally matches today's tutorial sheet.",
        status: "ACTIVE",
        helpfulCount: 3,
        createdAt: NOW,
        editedAt: null,
        moderationReason: null,
        author: { id: "u-aisha", username: "aisha_bello", fullName: "Aisha Bello", photoUrl: null, isOfficial: false },
        viewer: { reacted: true, helpful: false },
        isOwner: false,
      },
    ],
    replyCount: 1,
  },
  {
    id: "c-second",
    postId: "preview-question-1",
    parentId: null,
    depth: 0,
    body: "Also check the Engineering Library reserve desk — they keep the printed booklet until 8 PM.",
    status: "ACTIVE",
    helpfulCount: 5,
    createdAt: HOUR_AGO,
    editedAt: null,
    moderationReason: null,
    author: { id: "u-chinedu", username: "chinedu_okafor", fullName: "Chinedu Okafor", photoUrl: null, isOfficial: false },
    viewer: { reacted: false, helpful: false },
    isOwner: true,
    replies: [],
    replyCount: 0,
  },
];

const AUDIENCES = [
  { id: "level", label: "My Level · 300L", description: "Students in Software Engineering 300L", scope: "level" as const },
  { id: "department", label: "My Department · Software Engineering", description: "All levels in Software Engineering", scope: "department" as const },
  { id: "college", label: "My College · Engineering", description: "Everyone in College of Engineering", scope: "college" as const },
  { id: "public", label: "Public · Your University", description: "Verified students across campus", scope: "public" as const },
];

const PROFILE_SELF: ProfileData = {
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
  facultyName: "College of Engineering",
  collegeName: "Engineering",
  departmentVisibility: "UNIVERSITY",
  levelVisibility: "UNIVERSITY",
  isOfficial: false,
};

const REPORT_QUEUE: ReportQueueItem[] = [
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

const REPORT_DETAIL: ReportDetail = {
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
    media: [{ url: "/seed/campus-quad.svg", width: 1200, height: 675 }],
  },
  activity: [
    { id: "act-1", action: "WARN", reason: "3 students reported this post (Harassment ×2, Spam ×1).", createdAt: TWO_HOURS_AGO, moderatorName: "Funke Adebayo" },
  ],
};

const STUDENT_HISTORY: StudentModerationHistory = {
  user: { id: "u-tunde", username: "tunde_adeyemi", fullName: "Tunde Adeyemi", photoUrl: null, status: "VERIFIED", level: 400, departmentName: "Mechanical Engineering" },
  activeStrikes: 1,
  reportsAgainst: 3,
  history: [
    { id: "h-1", action: "WARN", reason: "Used abusive language toward another student in a department discussion.", label: "Post removed + Warning", reasonLabel: "Harassment", createdAt: "2026-11-12T10:00:00.000Z", moderatorName: "Funke A.", durationDays: null },
    { id: "h-2", action: "REMOVE", reason: "Repeated promotional links in a group.", label: "Post removed", reasonLabel: "Spam", createdAt: "2026-10-03T10:00:00.000Z", moderatorName: "Funke A.", durationDays: null },
  ],
};

const UNI_SETTINGS: UniversitySettings = {
  name: "Your University",
  shortName: "Demo",
  slug: "nova",
  accentColor: "#4f46e5",
  logoUrl: null,
  studentEmailDomains: ["student.nova.edu.ng", "nova.edu.ng"],
  idCardEnabled: true,
  vouchingEnabled: true,
  matricPattern: "^NU\\/\\d{2}\\/\\d{4}$",
  labels: { college: "College", faculty: "Faculty", department: "Department" },
  policyVersion: "2026-11-18",
};

const COMMUNITY_VIEWER = {
  joinState: "JOINED" as const,
  isMember: true,
  role: "MEMBER" as const,
  pendingRequest: false,
  hasInvite: false,
  muted: false,
  canModerate: false,
  canManage: false,
};

const COMMUNITY_CARDS: CommunityCardView[] = [
  {
    id: "community-swe",
    name: "Software Engineering Hub",
    slug: "software-engineering-hub",
    description: "Projects, past questions and lab tips for Software Engineering students across every level.",
    category: "ACADEMIC",
    privacy: "PUBLIC",
    status: "ACTIVE",
    isOfficial: true,
    iconUrl: null,
    bannerUrl: null,
    memberCount: 842,
    postCount: 196,
    recentActivity: "Aisha shared CSC 204 past questions",
    viewer: COMMUNITY_VIEWER,
  },
  {
    id: "community-robotics",
    name: "Robotics Club",
    slug: "nova-robotics-club",
    description: "Build nights, competition teams and hardware help for new and experienced makers.",
    category: "TECH",
    privacy: "REQUEST",
    status: "ACTIVE",
    isOfficial: false,
    iconUrl: null,
    bannerUrl: null,
    memberCount: 156,
    postCount: 48,
    recentActivity: "Tunde posted a build night reminder",
    viewer: { ...COMMUNITY_VIEWER, joinState: "REQUESTED", isMember: false, role: null, pendingRequest: true },
  },
  {
    id: "community-hall",
    name: "Mariam Hall",
    slug: "mariam-hall",
    description: "News, lost property and hall week planning for Mariam Hall residents.",
    category: "HOSTEL",
    privacy: "INVITE_ONLY",
    status: "ACTIVE",
    isOfficial: false,
    iconUrl: null,
    bannerUrl: null,
    memberCount: 220,
    postCount: 87,
    recentActivity: "Ngozi pinned the hall week schedule",
    viewer: { ...COMMUNITY_VIEWER, joinState: "INVITE_REQUIRED", isMember: false, role: null },
  },
  {
    id: "community-design",
    name: "Campus Design Collective",
    slug: "campus-design-collective",
    description: "A friendly space for UI, brand and illustration work made by Students.",
    category: "ARTS",
    privacy: "PUBLIC",
    status: "ACTIVE",
    isOfficial: false,
    iconUrl: null,
    bannerUrl: null,
    memberCount: 94,
    postCount: 31,
    recentActivity: "New critique thread is open",
    viewer: { ...COMMUNITY_VIEWER, joinState: "CAN_JOIN", isMember: false, role: null },
  },
];

const COMMUNITY_PAGE: CommunityPageView = {
  ...COMMUNITY_CARDS[0]!,
  allowMemberUploads: true,
  createdAt: "2026-08-14T10:00:00.000Z",
  rules: [
    { id: "rule-1", position: 1, title: "Help before you ask", body: "Search existing threads and share what you have already tried." },
    { id: "rule-2", position: 2, title: "Keep coursework honest", body: "Never post full solutions during an active assessment." },
    { id: "rule-3", position: 3, title: "Respect every level", body: "100L questions deserve the same care as final-year ones." },
  ],
  staff: [
    { userId: "u-chinedu", username: "chinedu_okafor", fullName: "Chinedu Okafor", photoUrl: null, role: "OWNER", joinedAt: "2026-08-14T10:00:00.000Z" },
    { userId: "u-aisha", username: "aisha_bello", fullName: "Aisha Bello", photoUrl: null, role: "MODERATOR", joinedAt: "2026-08-16T10:00:00.000Z" },
  ],
  pendingRequestCount: 3,
  pendingInviteCount: 1,
  reportedCount: 0,
  viewer: { ...COMMUNITY_VIEWER, role: "OWNER", canModerate: true, canManage: true },
};

const COMMUNITY_MEMBERS: CommunityMemberView[] = [
  { userId: "u-chinedu", username: "chinedu_okafor", fullName: "Chinedu Okafor", photoUrl: null, role: "OWNER", joinedAt: "2026-08-14T10:00:00.000Z", status: "ACTIVE", departmentName: "Software Engineering", level: 300, mutedUntil: null, isOwner: true, isViewer: true },
  { userId: "u-aisha", username: "aisha_bello", fullName: "Aisha Bello", photoUrl: null, role: "MODERATOR", joinedAt: "2026-08-16T10:00:00.000Z", status: "ACTIVE", departmentName: "Software Engineering", level: 300, mutedUntil: null, isOwner: false, isViewer: false },
  { userId: "u-tunde", username: "tunde_adeyemi", fullName: "Tunde Adeyemi", photoUrl: null, role: "MEMBER", joinedAt: "2026-09-02T10:00:00.000Z", status: "ACTIVE", departmentName: "Software Engineering", level: 400, mutedUntil: null, isOwner: false, isViewer: false },
  { userId: "u-ngozi", username: "ngozi_eze", fullName: "Ngozi Eze", photoUrl: null, role: "MEMBER", joinedAt: "2026-09-08T10:00:00.000Z", status: "ACTIVE", departmentName: "Mass Communication", level: 300, mutedUntil: null, isOwner: false, isViewer: false },
];

const COMMUNITY_RESOURCES: CommunityResourceView[] = [
  { id: "res-1", kind: "FILE", title: "CSC 204 past questions (2022–2025)", description: "Combined mid-semester and exam papers with marking guides.", category: "ACADEMIC", mimeType: "application/pdf", sizeBytes: 2_400_000, url: null, createdAt: HOUR_AGO, uploader: { username: "aisha_bello", fullName: "Aisha Bello", photoUrl: null }, canRemove: true },
  { id: "res-2", kind: "LINK", title: "Lab setup guide", description: "Node, Docker and PostgreSQL setup for the 300L project.", category: "TECH", mimeType: null, sizeBytes: null, url: "https://example.edu.ng/lab-guide", createdAt: TWO_HOURS_AGO, uploader: { username: "chinedu_okafor", fullName: "Chinedu Okafor", photoUrl: null }, canRemove: true },
];

const COMMUNITY_REQUESTS: JoinRequestView[] = [
  { id: "req-1", message: "I'm in 200L Software Engineering and would like to help with the peer tutoring roster.", createdAt: HOUR_AGO, user: { id: "u-ibrahim", username: "ibrahim_musa", fullName: "Ibrahim Musa", photoUrl: null, departmentName: "Software Engineering", level: 200 } },
];

const COMMUNITY_INVITES: CommunityInviteView[] = [
  { id: "inv-1", kind: "LINK", url: "https://konnekt.ng/c/software-engineering-hub?invite=demo", expiresAt: "2026-11-29T10:00:00.000Z", maxUses: 10, uses: 2, status: "ACTIVE", invitedUser: null, createdBy: { username: "chinedu_okafor", fullName: "Chinedu Okafor" }, createdAt: HOUR_AGO },
];

const COMMUNITY_REPORTS: CommunityReportView[] = [
  { id: "rep-1", reason: "Harassment", details: "Targeted a 100L student in a reply.", status: "PENDING", createdAt: HOUR_AGO, targetType: "COMMENT", targetId: "c-1", targetExcerpt: "That question is too basic, figure it out yourself.", reporter: { username: "ngozi_eze", fullName: "Ngozi Eze" }, author: { id: "u-tunde", username: "tunde_adeyemi", fullName: "Tunde Adeyemi" } },
];

const COMMUNITY_ADMIN: CommunityAdminPayload = {
  total: 30,
  officialRequests: [
    { id: "official-1", community: { id: "community-robotics", name: "Robotics Club", slug: "nova-robotics-club" }, requestedBy: { username: "tunde_adeyemi", fullName: "Tunde Adeyemi" }, note: "We host the university's robotics competition team and need official status for announcements.", createdAt: HOUR_AGO },
  ],
  rows: COMMUNITY_CARDS.map((card, index) => ({
    id: card.id,
    name: card.name,
    slug: card.slug,
    isOfficial: card.isOfficial,
    status: index === 2 ? "SUSPENDED" : "ACTIVE",
    privacy: card.privacy,
    category: card.category,
    memberCount: card.memberCount,
    postCount: card.postCount,
    reportCount: index === 2 ? 4 : index === 0 ? 0 : 1,
    owner: { username: "chinedu_okafor", fullName: "Chinedu Okafor" },
    createdAt: "2026-08-14T10:00:00.000Z",
    pendingOfficialRequest: index === 1,
  })),
};

const DRAFTS: DraftView[] = [
  { id: "d-1", type: "POST", payload: { body: "Here is our final year project sprint checklist for Software Engineering 400L.", media: [{ publicId: "demo", url: "/seed/campus-quad.svg", width: 800, height: 500, alt: "Campus quad" }] }, audience: { id: "dept", label: "My Department · Software Engineering", kind: "DEPARTMENT" }, updatedAt: HOUR_AGO },
  { id: "d-2", type: "QUESTION", payload: { questionTitle: "Who supervises SWE 412 hardware presentations?", body: "Confirming whether team reports are due before Friday 4 PM.", topicTag: "SWE 412" }, audience: { id: "level", label: "My Level · 400L", kind: "LEVEL" }, updatedAt: FOUR_HOURS_AGO },
];

const RESTRICTED: RestrictedStudentView[] = [
  { id: "r-1", username: "ibrahim_musa", fullName: "Ibrahim Musa", photoUrl: null, departmentName: "Mechanical Engineering", level: 400 },
  { id: "r-2", username: "ngozi_eze", fullName: "Ngozi Eze", photoUrl: null, departmentName: "Mass Communication", level: 300 },
];

export function ScreenPreviewClient({ screen, theme }: { screen: string; theme: "light" | "dark" }) {
  const [code, setCode] = useState("4829");
  const [pw, setPw] = useState("Campus@2026");

  if (PHASE3_SCREENS.includes(screen)) {
    return (
      <div data-theme={theme} className="min-h-dvh bg-bg text-fg">
        <Phase3Showcase screen={screen} />
      </div>
    );
  }

  return (
    <div data-theme={theme} className="min-h-dvh bg-bg text-fg">
      {screen === "pulse-populated" ? (
        <div className="min-h-dvh bg-bg">
          <TopBar user={VIEWER} university={NOVA_UNI} unreadNotifications={7} />
          <div className="mx-auto max-w-[1160px] lg:grid lg:grid-cols-[224px_minmax(0,640px)_260px] lg:justify-between lg:gap-6 lg:px-4">
            <DesktopLeftRail unreadInbox={3} />
            <main className="mx-auto w-full max-w-feed px-4 pb-24 pt-2 lg:max-w-none lg:px-0 lg:pb-10">
              <div className="sticky top-14 z-30 -mx-4 border-b border-border/70 bg-bg/95 px-4 py-2.5 backdrop-blur-sm lg:mx-0 lg:px-0">
                <div className="flex gap-2 overflow-x-auto">
                  {["All", "My Level", "My Department", "My College", "Public"].map((label, idx) => (
                    <span key={label} className={cn("inline-flex h-9 shrink-0 items-center gap-1.5 rounded-chip px-3 text-small font-medium", idx === 0 ? "bg-accent text-accent-fg" : "border border-border bg-surface text-fg-muted")}>
                      {idx === 0 ? <Check aria-hidden="true" className="size-3.5" /> : null}
                      {label}
                    </span>
                  ))}
                </div>
                <div className="mt-2 flex justify-center">
                  <span className="inline-flex h-9 items-center gap-1.5 rounded-chip bg-accent px-4 text-small font-semibold text-accent-fg shadow-pill">
                    <ArrowUp aria-hidden="true" className="size-4" /> 5 new posts
                  </span>
                </div>
              </div>

              <div className="mt-3 space-y-3">
                <PostCard post={POSTS[0]!} />
                <PostCard post={POSTS[1]!} />
                <section className="rounded-card bg-accent-soft px-4 py-3 lg:hidden">
                  <p className="flex items-center gap-2 text-body font-semibold text-fg">
                    <TrendingUp aria-hidden="true" className="size-4 text-accent-ink" />
                    Trending on campus
                  </p>
                  <div className="mt-2.5 flex gap-2 overflow-x-auto pb-0.5">
                    {[{ tag: "ExamTimetable", count: 48 }, { tag: "TechSummit", count: 42 }, { tag: "HostelWater", count: 29 }].map((item) => (
                      <span key={item.tag} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-chip border border-border bg-surface px-3 text-small">
                        <span className="font-semibold text-accent-ink">#{item.tag}</span>
                        <span className="text-tiny text-fg-muted">{item.count}</span>
                      </span>
                    ))}
                  </div>
                </section>
                <PostCard post={POSTS[2]!} />
                <PostCard post={POSTS[3]!} />
                <PostCard post={POSTS[4]!} />
              </div>
            </main>
            <DesktopTrendingRail tags={[{ tag: "ExamTimetable", count: 48 }, { tag: "TechSummit", count: 42 }, { tag: "HostelWater", count: 29 }, { tag: "FootballFinals", count: 19 }]} />
          </div>
          <BottomTabBar unreadInbox={3} />
        </div>
      ) : null}

      {screen === "pulse-states" ? (
        <main className="mx-auto max-w-feed space-y-4 px-4 py-5">
          <div className="flex min-h-9 items-center gap-2.5 rounded-[12px] border border-warning/30 bg-highlight-soft px-3.5 py-2 text-small font-medium text-highlight-fg">
            <CloudOff aria-hidden="true" className="size-4 shrink-0" />
            You&apos;re offline. Showing saved content.
          </div>
          <div className="rounded-card border border-border bg-surface p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="size-12 shrink-0" rounded="rounded-full" />
              <div className="flex-1 space-y-2"><Skeleton className="h-4 w-40" /><Skeleton className="h-3 w-28" /></div>
            </div>
            <SkeletonText lines={3} className="mt-3" />
          </div>
          <div className="rounded-card border border-border bg-surface">
            <EmptyState illustration="pulse" title="Nothing here yet" description="Be the first to post to your level." action={<Button>+ Create a post</Button>} compact />
          </div>
          <div className="rounded-card border border-border bg-surface">
            <ErrorState description="Check your connection and try again." onRetry={() => undefined} />
          </div>
        </main>
      ) : null}

      {screen === "composer-post" || screen === "composer-question" || screen === "composer-poll" || screen === "composer-audience" ? (
        <div className="relative min-h-dvh bg-bg">
          <Composer
            viewer={VIEWER}
            audiences={AUDIENCES}
            initialType={screen === "composer-question" ? "QUESTION" : screen === "composer-poll" ? "POLL" : "POST"}
          />
          {screen === "composer-audience" ? (
            <BottomSheet open onClose={() => undefined} title="Who can see this?" description="Only people in this audience will see your post.">
              <ul className="space-y-2 pb-4">
                {AUDIENCES.map((aud, i) => (
                  <li key={aud.id}>
                    <div className={cn("flex min-h-[52px] items-center justify-between gap-3 rounded-card border px-4 py-2.5", i === 0 ? "border-accent bg-accent-soft" : "border-border bg-surface")}>
                      <div>
                        <p className={cn("text-body font-semibold", i === 0 ? "text-accent-ink" : "text-fg")}>{aud.label}</p>
                        <p className="text-tiny text-fg-muted">{aud.description}</p>
                      </div>
                      <span className={cn("flex size-5 items-center justify-center rounded-full border", i === 0 ? "border-accent bg-accent text-accent-fg" : "border-border-strong")}>
                        {i === 0 ? <Check aria-hidden="true" className="size-3" /> : null}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </BottomSheet>
          ) : null}
        </div>
      ) : null}

      {screen === "post-detail" ? (
        <main className="mx-auto max-w-feed pb-20">
          <header className="glass sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border px-4">
            <ArrowLeft aria-hidden="true" className="size-5 text-fg" />
            <p className="font-display text-h3 font-bold text-fg">Question</p>
            <span className="size-5" aria-hidden="true" />
          </header>
          <div className="space-y-3 p-4">
            <PostCard post={DETAIL_QUESTION} expanded />
            <CommentSection post={DETAIL_QUESTION} initialComments={COMMENTS} initialSort="top" viewer={{ id: VIEWER.id, username: VIEWER.username, fullName: VIEWER.fullName, photoUrl: null }} />
          </div>
        </main>
      ) : null}

      {screen === "post-removed-and-unavailable" ? (
        <main className="mx-auto max-w-feed space-y-4 p-4">
          <PostCard post={REMOVED_POST} expanded />
          <div className="rounded-card border border-border bg-surface">
            <EmptyState illustration="unavailable" title="This post isn't available" description="It may have been deleted, or it isn't shared with you." action={<Button>Back to Pulse</Button>} />
          </div>
        </main>
      ) : null}

      {screen === "post-menus" ? (
        <div className="relative min-h-dvh bg-bg p-4">
          <PostCard post={POSTS[1]!} />
          <BottomSheet open onClose={() => undefined} title="Post options">
            <div className="divide-y divide-border pb-4">
              <div className="flex h-[52px] items-center gap-3 text-body font-medium text-fg"><Bookmark aria-hidden="true" className="size-6 text-fg-muted" /> Save bookmark</div>
              <div className="flex h-[52px] items-center gap-3 text-body font-medium text-fg"><Copy aria-hidden="true" className="size-6 text-fg-muted" /> Copy link</div>
              <div className="flex h-[52px] items-center gap-3 text-body font-medium text-fg"><Share2 aria-hidden="true" className="size-6 text-fg-muted" /> Share outside app</div>
              <div className="flex h-[52px] items-center gap-3 rounded-button bg-danger-soft px-2 text-body font-medium text-danger"><Flag aria-hidden="true" className="size-6" /> Report post</div>
            </div>
          </BottomSheet>
        </div>
      ) : null}

      {screen === "image-viewer" ? (
        <div className="fixed inset-0 flex flex-col bg-black text-white">
          <header className="glass flex h-14 items-center justify-between px-4">
            <span className="flex size-11 items-center justify-center rounded-full"><X aria-hidden="true" className="size-6" /></span>
            <span className="text-small font-semibold tabular-nums">1 / 4</span>
            <span className="flex size-11 items-center justify-center rounded-full"><Share2 aria-hidden="true" className="size-5" /></span>
          </header>
          <div className="flex flex-1 items-center justify-center p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/seed/campus-quad.svg" alt="Campus" className="max-h-[75vh] w-full rounded-card object-contain" />
          </div>
        </div>
      ) : null}

      {screen === "drafts" ? (
        <main className="mx-auto max-w-feed space-y-4 px-4 py-5">
          <h1 className="font-display text-h1 text-fg">Drafts</h1>
          <DraftsList initialDrafts={DRAFTS} />
        </main>
      ) : null}

      {screen === "bookmarks" ? (
        <main className="mx-auto max-w-feed pb-16">
          <header className="glass sticky top-0 z-20 flex h-14 items-center border-b border-border px-2">
            <span className="flex size-11 items-center justify-center rounded-full text-fg">
              <ArrowLeft aria-hidden="true" className="size-5" />
            </span>
            <h1 className="flex-1 text-center font-display text-h2 text-fg">Bookmarks</h1>
            <span className="size-11" aria-hidden="true" />
          </header>
          <div className="space-y-3.5 px-4 pt-3">
            <p className="flex items-center gap-2.5 rounded-button bg-accent-soft px-3.5 py-3 text-small font-medium text-accent-soft-fg">
              <Lock aria-hidden="true" className="size-4 shrink-0 text-accent-ink" />
              Only you can see your bookmarks.
            </p>
            <div className="relative">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
              <input
                readOnly
                aria-label="Search your bookmarks"
                placeholder="Search your bookmarks"
                className="h-11 w-full rounded-[14px] border border-border bg-surface-2/65 pl-10 pr-3.5 text-small text-fg placeholder:text-fg-subtle"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto">
              {["All", "Posts", "Questions", "Polls"].map((chip, i) => (
                <span key={chip} className={cn("inline-flex h-8 shrink-0 items-center rounded-chip px-3.5 text-small font-semibold", i === 0 ? "bg-accent text-accent-fg" : "border border-border bg-surface text-fg-muted")}>{chip}</span>
              ))}
            </div>
            <PostCard post={DETAIL_QUESTION} />
            <PostCard post={POSTS[4]!} />
          </div>
        </main>
      ) : null}

      {screen === "hashtag" ? (
        <main className="mx-auto max-w-feed pb-16">
          <header className="glass sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border px-4">
            <ArrowLeft aria-hidden="true" className="size-5 text-fg" />
            <div className="min-w-0 flex-1"><p className="truncate font-display text-h3 font-bold text-fg">#TechSummit</p><p className="text-tiny text-fg-muted">42 posts at Your University</p></div>
          </header>
          <div className="space-y-3 p-4">
            <div className="overflow-hidden rounded-card border border-border bg-surface">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/seed/tech-summit.svg" alt="" className="h-36 w-full object-cover" />
              <div className="bg-accent-soft px-4 py-3 text-small text-fg">Showing verified campus posts tagged <span className="font-semibold text-accent-ink">#TechSummit</span>.</div>
            </div>
            <PostCard post={POSTS[0]!} />
          </div>
        </main>
      ) : null}

      {screen === "profile-self" || screen === "profile-other" ? (
        <div className="mx-auto max-w-feed bg-bg pb-20">
          <ProfileView
            profile={screen === "profile-self" ? PROFILE_SELF : { ...PROFILE_SELF, id: "u-aisha", username: "aisha_bello", fullName: "Aisha Bello", levelVisibility: "NOBODY" }}
            university={{ name: "Your University", shortName: "Demo", accentColor: "#4f46e5" }}
            labels={{}}
            isSelf={screen === "profile-self"}
            canViewDepartment
            canViewLevel={screen === "profile-self"}
            posts={[POSTS[0]!, POSTS[1]!]}
          />
          <BottomTabBar />
        </div>
      ) : null}

      {screen === "settings-appearance" ? (
        <main className="mx-auto max-w-feed space-y-4 px-4 py-5">
          <h1 className="font-display text-h1 text-fg">Appearance</h1>
          <AppearanceSettings />
        </main>
      ) : null}

      {screen === "blocked-muted" ? (
        <main className="mx-auto flex min-h-dvh max-w-feed flex-col pb-6">
          <header className="glass sticky top-0 z-20 flex h-14 items-center border-b border-border px-2">
            <span className="flex size-11 items-center justify-center rounded-full text-fg">
              <ArrowLeft aria-hidden="true" className="size-5" />
            </span>
            <h1 className="flex-1 text-center font-display text-h2 text-fg">Blocked and muted</h1>
            <span className="size-11" aria-hidden="true" />
          </header>
          <div className="flex-1 space-y-5 px-4 pt-4">
            <RestrictedPeople initialBlocked={RESTRICTED} initialMuted={[]} />
            <div className="rounded-card border border-border bg-surface">
              <EmptyState illustration="padlock" title="No one muted." description="You haven't muted anyone yet." compact />
            </div>
          </div>
          <div className="px-4 pt-4">
            <p className="flex items-center gap-2.5 rounded-button bg-accent-soft px-3.5 py-3 text-small font-medium text-accent-soft-fg">
              <Lock aria-hidden="true" className="size-4 shrink-0 text-accent-ink" />
              Blocked people can&apos;t see your posts or interact with you.
            </p>
          </div>
        </main>
      ) : null}

      {screen === "verify-method" ? (
        <main className="mx-auto max-w-md space-y-5 px-4 py-6">
          <p className="text-tiny font-semibold uppercase tracking-[0.12em] text-accent-ink">Step 2 of 4</p>
          <h1 className="font-display text-h1 text-fg">Verify you&apos;re a student</h1>
          <p className="text-body text-fg-muted">Pick how you want to prove you attend Your University.</p>
          <div className="space-y-3">
            {[
              { title: "Student email", badge: "Fastest", desc: "Instant code to your @student.nova.edu.ng inbox", icon: Mail },
              { title: "Student ID card", badge: "1 day", desc: "Upload a clear photo for a campus reviewer", icon: IdCard },
              { title: "Course rep vouch", badge: "Trusted", desc: "Ask a verified rep in your department", icon: ShieldCheck },
            ].map((item) => (
              <div key={item.title} className="flex min-h-[72px] items-center gap-3.5 rounded-card border border-border bg-surface p-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-button bg-accent-soft text-accent-ink">
                  <item.icon aria-hidden="true" className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><p className="text-body font-semibold text-fg">{item.title}</p><span className="rounded-chip bg-accent-soft px-2 py-0.5 text-[0.6875rem] font-semibold text-accent-ink">{item.badge}</span></div>
                  <p className="text-small text-fg-muted">{item.desc}</p>
                </div>
                <ChevronRight aria-hidden="true" className="size-5 text-fg-subtle" />
              </div>
            ))}
          </div>
        </main>
      ) : null}

      {screen === "verify-code" ? (
        <main className="mx-auto max-w-md space-y-5 px-4 py-8">
          <p className="text-tiny font-semibold uppercase tracking-[0.12em] text-accent-ink">Step 2 of 4</p>
          <h1 className="font-display text-h1 text-fg">Check your inbox</h1>
          <p className="text-body text-fg-muted">Enter the 6-digit code sent to <strong className="text-fg">chinedu@student.nova.edu.ng</strong>.</p>
          <CodeInput value={code} onChange={setCode} hint="6-digit code, paste supported." />
          <Button fullWidth size="lg">Verify email</Button>
          <p className="text-center text-small text-fg-muted">Resend code in 0:42</p>
        </main>
      ) : null}

      {screen === "verify-id-upload" ? (
        <main className="mx-auto max-w-md space-y-4 px-4 py-6">
          <p className="text-tiny font-semibold uppercase tracking-[0.12em] text-accent-ink">Step 2 of 4</p>
          <h1 className="font-display text-h1 text-fg">Upload your student ID</h1>
          <Card className="p-4">
            <p className="text-small font-semibold text-fg">Before you snap a photo</p>
            <ul className="mt-2 space-y-1.5 text-small text-fg-muted">
              <li className="flex items-center gap-2"><Check aria-hidden="true" className="size-4 text-success" /> All four corners visible</li>
              <li className="flex items-center gap-2"><Check aria-hidden="true" className="size-4 text-success" /> Full name & matric readable</li>
              <li className="flex items-center gap-2"><Check aria-hidden="true" className="size-4 text-success" /> No harsh flash glare</li>
            </ul>
          </Card>
          <div className="grid grid-cols-2 gap-2.5">
            <Button variant="secondary" leftIcon={<Camera aria-hidden="true" className="size-4" />}>Camera</Button>
            <Button variant="secondary" leftIcon={<ImageIcon aria-hidden="true" className="size-4" />}>Gallery</Button>
          </div>
          <TextField label="Matric number" defaultValue="NU/23/0564" hint="Format matches Your University (NU/YY/NNNN)." />
          <Button fullWidth size="lg">Submit for review</Button>
        </main>
      ) : null}

      {screen === "verify-waiting" ? (
        <main className="mx-auto max-w-md px-4 py-10 text-center">
          <div className="flex justify-center"><ClayIllustration kind="hourglass" /></div>
          <h1 className="mt-4 font-display text-h1 text-fg">We&apos;re checking your details</h1>
          <p className="mt-2 text-body text-fg-muted">A reviewer at Your University is looking at your student ID. Most requests are decided within a day.</p>
          <div className="mt-3 flex justify-center gap-1.5" aria-hidden="true">
            <span className="size-2 rounded-full bg-accent/50" />
            <span className="size-2 rounded-full bg-accent/75" />
            <span className="size-2 rounded-full bg-accent" />
          </div>
          <ButtonLink href="/onboarding" size="lg" fullWidth className="mt-6">Finish my profile</ButtonLink>
        </main>
      ) : null}

      {screen === "verify-rejected" ? (
        <main className="mx-auto max-w-md px-4 py-10 text-center">
          <div className="flex justify-center py-4"><RubberStamp status="REJECTED" /></div>
          <h1 className="mt-3 font-display text-h1 text-fg">We couldn&apos;t verify you yet</h1>
          <Card className="mt-5 p-4 text-left">
            <p className="text-small font-semibold text-fg">What to fix</p>
            <p className="mt-1 text-small font-medium text-danger">Blurry or cropped photo</p>
            <p className="mt-2 text-small text-fg-muted">The corner covering your matric number was cut off — try another photo in brighter light.</p>
          </Card>
          <Button fullWidth size="lg" className="mt-5">Resubmit verification</Button>
        </main>
      ) : null}

      {screen === "create-account" ? (
        <main className="mx-auto max-w-md space-y-4 px-4 py-6">
          <p className="text-tiny font-semibold uppercase tracking-[0.12em] text-accent-ink">Step 3 of 4</p>
          <h1 className="font-display text-h1 text-fg">Create your account</h1>
          <TextField label="Full name" defaultValue="Chinedu Okafor" required />
          <TextField label="Username" defaultValue="chinedu_okafor" hint="chinedu_okafor is available." />
          <PasswordField label="Password" value={pw} onChange={(e) => setPw(e.target.value)} />
          <PasswordStrengthMeter password={pw} />
          <Checkbox label="I agree to the Terms, Privacy Policy & Community Rules" checked readOnly />
          <Button fullWidth size="lg">Create account</Button>
        </main>
      ) : null}

      {screen === "onboarding" ? (
        <main className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pt-6">
          <div className="flex-1 space-y-5 pb-6">
            <Stepper steps={["Profile", "Interests"]} current={1} />
            <h1 className="font-display text-h1 text-fg">What are you into?</h1>
            <p className="text-body text-fg-muted">Pick at least 3 so Students with similar interests find you.</p>
            <div className="flex flex-wrap gap-2">
              {["Coding", "Photography", "Football", "Design", "Music", "Debate", "Robotics", "Medicine", "Entrepreneurship"].map((tag, i) => (
                <Chip key={tag} selected={i < 3}>{tag}</Chip>
              ))}
            </div>
            <p className="text-small font-medium text-accent-ink">3 selected · Ready to continue</p>
          </div>
          <div className="sticky bottom-0 -mx-4 border-t border-border/80 bg-bg/95 px-4 py-4 backdrop-blur-sm">
            <Button fullWidth size="lg">Enter Konnekt</Button>
          </div>
        </main>
      ) : null}

      {screen === "communities-hub" ? (
        <main className="mx-auto min-h-dvh max-w-[760px] pb-24">
          <CommunityHub
            mine={{ active: COMMUNITY_CARDS.slice(0, 1), rest: COMMUNITY_CARDS.slice(3), invitations: [] }}
            discover={{ communities: COMMUNITY_CARDS.slice(1), nextCursor: null, hasMore: false, trending: COMMUNITY_CARDS.slice(1), suggested: [COMMUNITY_CARDS[3]!] }}
          />
        </main>
      ) : null}

      {screen === "community-search" ? (
        <main className="mx-auto min-h-dvh max-w-[760px]">
          <CommunitySearch initial={{ communities: COMMUNITY_CARDS, nextCursor: null, hasMore: false, trending: [], suggested: [] }} />
        </main>
      ) : null}

      {screen === "community-posts" || screen === "community-resources" || screen === "community-members" || screen === "community-about" ? (
        <main className="mx-auto min-h-dvh max-w-[760px]">
          <CommunityPage
            community={COMMUNITY_PAGE}
            initialTab={
              screen === "community-resources"
                ? "resources"
                : screen === "community-members"
                  ? "members"
                  : screen === "community-about"
                    ? "about"
                    : "posts"
            }
            initialPosts={POSTS.map((post) => ({
              ...post,
              audienceKind: "COMMUNITY",
              audienceLabel: "Software Engineering Hub",
              community: { id: COMMUNITY_PAGE.id, name: COMMUNITY_PAGE.name, slug: COMMUNITY_PAGE.slug, iconUrl: null, isOfficial: true, privacy: "PUBLIC" },
            }))}
            initialPinned={[]}
            initialResources={COMMUNITY_RESOURCES}
            initialMembers={COMMUNITY_MEMBERS}
          />
        </main>
      ) : null}

      {screen === "community-request-locked" ? (
        <main className="mx-auto min-h-dvh max-w-[760px]">
          <CommunityPage
            community={{ ...COMMUNITY_PAGE, privacy: "REQUEST", viewer: { ...COMMUNITY_VIEWER, joinState: "CAN_REQUEST", isMember: false, role: null, canManage: false, canModerate: false } }}
            initialPosts={[]}
            initialPinned={[]}
            initialResources={null}
            initialMembers={null}
          />
        </main>
      ) : null}

      {screen === "community-settings" ? (
        <main className="mx-auto min-h-dvh max-w-[900px] px-4 py-6">
          <CommunitySettings
            community={COMMUNITY_PAGE}
            requests={COMMUNITY_REQUESTS}
            invites={COMMUNITY_INVITES}
            reports={COMMUNITY_REPORTS}
            members={COMMUNITY_MEMBERS}
          />
        </main>
      ) : null}

      {screen === "community-create" ? (
        <main className="mx-auto min-h-dvh max-w-[640px] px-4 py-6">
          <NewCommunityForm />
        </main>
      ) : null}

      {screen === "admin-communities" ? (
        <AdminShell university={NOVA_UNI} user={{ fullName: "Funke Adebayo", photoUrl: null }} pendingCount={5} reportCount={12} isAdmin canModerate>
          <CommunityConsole initial={COMMUNITY_ADMIN} isAdmin />
        </AdminShell>
      ) : null}

      {screen === "onboarding-communities" ? (
        <main className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pt-6">
          <div className="flex-1 space-y-5 pb-6">
            <Stepper steps={["Profile", "Interests", "Communities"]} current={2} />
            <div>
              <p className="text-tiny font-semibold uppercase tracking-[0.12em] text-accent-ink">Step 3 of 3</p>
              <h1 className="mt-1 font-display text-h1 text-fg">Find your people</h1>
              <p className="mt-1 text-body text-fg-muted">Join a few circles now. You can always discover more later.</p>
            </div>
            <div className="space-y-2.5">
              {COMMUNITY_CARDS.slice(0, 2).map((community) => (
                <div key={community.id} className="flex items-center gap-3 rounded-card border border-border bg-surface p-3">
                  <Avatar name={community.name} seed={community.slug} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-small font-bold text-fg">{community.name}</p>
                    <p className="truncate text-tiny text-fg-muted">{community.memberCount} members · {community.category.toLowerCase()}</p>
                  </div>
                  <Button size="sm" variant={community.id === COMMUNITY_CARDS[0]!.id ? "secondary" : "primary"}>
                    {community.id === COMMUNITY_CARDS[0]!.id ? "Joined" : "Join"}
                  </Button>
                </div>
              ))}
            </div>
            <Link href="/communities" className="inline-flex items-center gap-1 text-small font-semibold text-accent-ink">
              Browse all communities <ChevronRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
          <div className="sticky bottom-0 -mx-4 border-t border-border/80 bg-bg/95 px-4 py-4 backdrop-blur-sm">
            <Button fullWidth size="lg">Enter Konnekt</Button>
          </div>
        </main>
      ) : null}

      {screen === "public-share-preview" ? (
        <main className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-8 pt-6">
          <div className="flex items-center justify-center gap-2.5 border-b border-border pb-4">
            <LogoMark className="size-9" />
            <span className="font-display text-[1.5rem] font-extrabold text-fg">Konnekt</span>
          </div>
          <div className="my-auto py-6">
            <Card className="p-4">
              <div className="flex items-center gap-2.5">
                <Avatar name="Chinedu Okafor" seed="chinedu_okafor" size="sm" verified />
                <div className="min-w-0">
                  <p className="text-small font-semibold text-fg">Chinedu Okafor</p>
                  <p className="text-tiny text-fg-muted">@chinedu_okafor · 2d ago</p>
                  <p className="mt-0.5 flex items-center gap-1 text-tiny text-fg-subtle">
                    <Users aria-hidden="true" className="size-3" /> to My Department · Software Engineering
                  </p>
                </div>
              </div>
              <p className="mt-3 text-body text-fg">Our demo day went better than…</p>
              <div className="relative mt-2.5 h-24 overflow-hidden rounded-button">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/seed/campus-quad.svg" alt="" className="size-full object-cover blur-[6px]" />
              </div>
            </Card>
            <div className="mt-5 flex items-center gap-3 rounded-card bg-accent-soft px-4 py-3.5">
              <UniversityShieldMark shortName="Demo" className="size-9 shrink-0" />
              <div className="h-8 w-px shrink-0 bg-border-strong/40" aria-hidden="true" />
              <p className="text-small font-medium text-accent-soft-fg">This post is shared with verified students of Your University.</p>
            </div>
            <div className="mt-5 space-y-3">
              <Button fullWidth size="lg" className="rounded-full border-2 border-[#12141A] shadow-[4px_4px_0_#12141A] dark:border-fg dark:shadow-[4px_4px_0_rgba(242,243,245,0.85)]">Open in Konnekt</Button>
              <Button variant="secondary" fullWidth size="lg" className="rounded-full">Install the app</Button>
            </div>
            <div className="mt-4 text-center">
              <Link href="/login" className="text-small font-semibold text-accent-ink underline underline-offset-4">
                Log in
              </Link>
            </div>
          </div>
          <footer className="mt-auto border-t border-border pt-4 text-center text-tiny text-fg-muted">
            <Link href="/legal/terms" className="hover:text-fg hover:underline">Terms</Link>
            <span className="mx-2" aria-hidden="true">·</span>
            <Link href="/legal/privacy" className="hover:text-fg hover:underline">Privacy</Link>
          </footer>
        </main>
      ) : null}

      {screen === "admin-reports" ? (
        <AdminShell university={NOVA_UNI} user={{ fullName: "Funke Adebayo", photoUrl: null }} pendingCount={5} reportCount={12} isAdmin canModerate>
          <ReportsWorkspace reports={REPORT_QUEUE} selectedDetail={REPORT_DETAIL} status="PENDING" type="ALL" pendingCount={12} resolvedCount={48} previewOnly />
        </AdminShell>
      ) : null}

      {screen === "admin-students" ? (
        <AdminShell university={NOVA_UNI} user={{ fullName: "Funke Adebayo", photoUrl: null }} pendingCount={5} reportCount={12} isAdmin canModerate>
          <div className="relative flex gap-6">
            <div className="min-w-0 flex-1 space-y-4">
              <h1 className="font-display text-h1 text-fg">Students</h1>
              <div className="overflow-hidden rounded-card border border-border bg-surface">
                <table className="w-full text-left text-small">
                  <thead><tr className="border-b border-border bg-surface-2/60 text-tiny font-semibold text-fg-muted"><th className="p-3">Student</th><th className="p-3">Matric No.</th><th className="p-3">Department</th><th className="p-3">Status</th></tr></thead>
                  <tbody className="divide-y divide-border">
                    {[{ name: "Chinedu Okafor", u: "chinedu_okafor", m: "NU/23/0***4", dept: "Software Engineering" }, { name: "Aisha Bello", u: "aisha_bello", m: "NU/24/0***1", dept: "Software Engineering" }, { name: "Tunde Adeyemi", u: "tunde_adeyemi", m: "NU/22/1***7", dept: "Mechanical Engineering" }].map((row, idx) => (
                      <tr key={row.u} className={idx === 2 ? "bg-accent-soft/60" : ""}>
                        <td className="p-3"><div className="flex items-center gap-2.5"><Avatar name={row.name} seed={row.u} size="sm" verified /><div><p className="font-semibold text-fg">{row.name}</p><p className="text-tiny text-fg-muted">@{row.u}</p></div></div></td>
                        <td className="p-3 font-mono text-tiny text-fg-muted">{row.m}</td>
                        <td className="p-3 text-fg-muted">{row.dept}</td>
                        <td className="p-3"><span className="inline-flex items-center gap-1 rounded-chip bg-success-soft px-2.5 py-0.5 text-tiny font-semibold text-success"><span className="size-1.5 rounded-full bg-success-solid" /> Active</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="overflow-hidden rounded-card border border-border">
              <StudentDetailsDrawer history={STUDENT_HISTORY} matricNumber="NU/22/1187" previewOnly />
            </div>
          </div>
        </AdminShell>
      ) : null}

      {screen === "admin-verification" ? (
        <AdminShell university={NOVA_UNI} user={{ fullName: "Funke Adebayo", photoUrl: null }} pendingCount={5} reportCount={12} isAdmin canModerate>
          <div className="grid gap-5 lg:grid-cols-[290px_1fr]">
            <aside className="space-y-3">
              <div className="flex items-center justify-between">
                <h1 className="font-display text-h2 text-fg">Queue (5)</h1>
                <span className="rounded-chip bg-accent-soft px-2.5 py-0.5 text-tiny font-semibold text-accent-ink">Oldest first</span>
              </div>
              <ul className="space-y-2">
                {[
                  { name: "Ngozi Eze", user: "ngozi_eze", matric: "NU/23/0775", dept: "Mass Communication · 300L", age: "2h ago", active: true },
                  { name: "Chinedu Okafor", user: "chinedu_okafor", matric: "NU/23/0564", dept: "Software Engineering · 300L", age: "4h ago", active: false },
                  { name: "Ibrahim Musa", user: "ibrahim_musa", matric: "NU/24/0190", dept: "Mechanical Engineering · 200L", age: "6h ago", active: false },
                ].map((item) => (
                  <li key={item.user} className={cn("rounded-card border p-3.5 transition", item.active ? "border-accent bg-accent-soft/60" : "border-border bg-surface")}>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={item.name} seed={item.user} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-small font-semibold text-fg">{item.name}</p>
                        <p className="truncate text-tiny text-fg-muted">@{item.user} · {item.age}</p>
                      </div>
                    </div>
                    <p className="mt-2 truncate font-mono text-tiny font-semibold text-fg-muted">{item.matric}</p>
                    <p className="truncate text-tiny text-fg-subtle">{item.dept}</p>
                  </li>
                ))}
              </ul>
            </aside>

            <div className="space-y-4">
              <header className="flex flex-wrap items-start justify-between gap-4 rounded-card border border-border bg-surface p-4">
                <div className="flex items-center gap-3">
                  <Avatar name="Ngozi Eze" seed="ngozi_eze" size="md" />
                  <div>
                    <h2 className="font-display text-h1 text-fg">Ngozi Eze</h2>
                    <p className="mt-0.5 text-small text-fg-muted">@ngozi_eze · ngozi@student.nova.edu.ng</p>
                  </div>
                </div>
                <RubberStamp status="PENDING" />
              </header>
              <div className="grid gap-4 xl:grid-cols-[1.15fr_1fr]">
                <Card className="overflow-hidden">
                  <div className="border-b border-border px-4 py-3"><h3 className="text-h3 text-fg">Submitted document</h3></div>
                  <div className="bg-surface-2 p-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/seed/student-id.svg" alt="Submitted Your University Student ID card" className="mx-auto max-h-72 w-full rounded-input border border-border bg-surface object-contain" />
                  </div>
                </Card>
                <div className="space-y-4">
                  <Card className="p-4">
                    <h3 className="text-h3 text-fg">Verification checks</h3>
                    <dl className="mt-3 space-y-2.5 text-small">
                      <div className="flex items-center justify-between gap-2">
                        <dt className="text-fg-muted">Matches format</dt>
                        <dd className="inline-flex items-center gap-1 rounded-chip bg-success-soft px-2.5 py-0.5 text-tiny font-semibold text-success">
                          <Check aria-hidden="true" className="size-3.5" /> NU/23/0775 valid
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <dt className="text-fg-muted">Unique matric</dt>
                        <dd className="inline-flex items-center gap-1 rounded-chip bg-success-soft px-2.5 py-0.5 text-tiny font-semibold text-success">
                          <Check aria-hidden="true" className="size-3.5" /> No duplicates
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <dt className="text-fg-muted">Department</dt>
                        <dd className="font-semibold text-fg">Mass Communication</dd>
                      </div>
                    </dl>
                  </Card>
                  <Card className="space-y-3 p-4">
                    <h3 className="text-h3 text-fg">Decision</h3>
                    <div>
                      <label htmlFor="preview-reason" className="mb-1 block text-tiny font-semibold text-fg-muted">
                        Reason (required if declining)
                      </label>
                      <input
                        id="preview-reason"
                        readOnly
                        placeholder="Select a decline reason or confirm approval..."
                        className="h-10 w-full rounded-input border border-border bg-surface-2 px-3 text-small text-fg placeholder:text-fg-subtle"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <Button variant="primary">Approve</Button>
                      <Button variant="destructive">Decline</Button>
                    </div>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        </AdminShell>
      ) : null}

      {screen === "admin-settings" ? (
        <AdminShell university={NOVA_UNI} user={{ fullName: "Funke Adebayo", photoUrl: null }} pendingCount={5} reportCount={12} isAdmin canModerate>
          <h1 className="mb-4 font-display text-h1 text-fg">University settings</h1>
          <UniversitySettingsForm settings={UNI_SETTINGS} />
        </AdminShell>
      ) : null}

      {screen === "platform-overview" ? (
        <div className="flex min-h-dvh bg-bg text-fg">
          <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-surface px-3 py-5 md:flex">
            <div className="mx-2 mb-6 flex items-center gap-2.5"><LogoMark className="size-9" /><div><p className="font-display text-small font-bold">Konnekt</p><p className="text-[0.6875rem] text-fg-subtle">Platform console</p></div></div>
            <nav className="flex-1 space-y-1">
              {[{ label: "Overview", icon: Activity, active: true }, { label: "Universities", icon: Building2 }, { label: "Waitlist", icon: ClipboardList }].map((item) => (
                <div key={item.label} className={cn("flex items-center gap-2.5 rounded-button px-3 py-2 text-small font-semibold", item.active ? "bg-accent-soft text-accent-ink" : "text-fg-muted")}><item.icon aria-hidden="true" className="size-[18px]" />{item.label}</div>
              ))}
            </nav>
          </aside>
          <main className="flex-1 p-6 space-y-5">
            <h1 className="font-display text-h1 text-fg">Platform overview</h1>
            <div className="grid gap-4 sm:grid-cols-3">
              {[{ label: "Live universities", val: "4", status: "Operational" }, { label: "Verified students", val: "14,820", status: "Healthy" }, { label: "Waitlist entries", val: "39", status: "Active" }].map((stat) => (
                <Card key={stat.label} className="p-4">
                  <p className="text-tiny font-semibold text-fg-muted">{stat.label}</p>
                  <p className="mt-1 font-display text-display text-fg">{stat.val}</p>
                  <p className="mt-2 inline-flex items-center gap-1.5 text-tiny font-semibold text-success"><span className="size-2 rounded-full bg-success-solid" />{stat.status}</p>
                </Card>
              ))}
            </div>
          </main>
        </div>
      ) : null}
    </div>
  );
}
