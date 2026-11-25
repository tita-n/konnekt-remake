import type {
  CommunityCategory,
  CommunityJoinState,
  CommunityPrivacy,
  CommunityStatus,
  CommunityRole,
  ResourceKind,
} from "@/lib/domain/community";

export interface CommunityViewerState {
  joinState: CommunityJoinState;
  isMember: boolean;
  role: CommunityRole | null;
  pendingRequest: boolean;
  hasInvite: boolean;
  muted: boolean;
  canModerate: boolean;
  canManage: boolean;
}

export interface CommunityCardView {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: CommunityCategory;
  privacy: CommunityPrivacy;
  status: CommunityStatus;
  isOfficial: boolean;
  iconUrl: string | null;
  bannerUrl: string | null;
  memberCount: number;
  postCount: number;
  recentActivity: string | null;
  viewer: CommunityViewerState;
}

export interface CommunityPageView extends CommunityCardView {
  allowMemberUploads: boolean;
  createdAt: string;
  rules: Array<{ id: string; position: number; title: string; body: string }>;
  staff: CommunityStaffView[];
  pendingRequestCount: number;
  pendingInviteCount: number;
  reportedCount: number;
}

export interface CommunityStaffView {
  userId: string;
  username: string;
  fullName: string;
  photoUrl: string | null;
  role: CommunityRole;
  joinedAt: string;
}

export interface CommunityMemberView extends CommunityStaffView {
  status: "ACTIVE" | "BANNED" | "LEFT";
  departmentName: string | null;
  level: number | null;
  mutedUntil: string | null;
  isOwner: boolean;
  isViewer: boolean;
}

export interface JoinRequestView {
  id: string;
  message: string | null;
  createdAt: string;
  user: {
    id: string;
    username: string;
    fullName: string;
    photoUrl: string | null;
    departmentName: string | null;
    level: number | null;
  };
}

export interface CommunityInviteView {
  id: string;
  kind: "USER" | "LINK";
  token?: string;
  url?: string;
  expiresAt: string;
  maxUses: number | null;
  uses: number;
  status: "ACTIVE" | "REVOKED" | "EXPIRED" | "USED";
  invitedUser: { username: string; fullName: string; photoUrl: string | null } | null;
  createdBy: { username: string; fullName: string } | null;
  createdAt: string;
}

export interface PendingInvitationView {
  id: string;
  community: Pick<CommunityCardView, "id" | "name" | "slug" | "iconUrl" | "isOfficial" | "memberCount">;
  invitedBy: { username: string; fullName: string } | null;
  createdAt: string;
  expiresAt: string;
}

export interface CommunityResourceView {
  id: string;
  kind: ResourceKind;
  title: string;
  description: string | null;
  category: CommunityCategory;
  mimeType: string | null;
  sizeBytes: number | null;
  url?: string | null;
  createdAt: string;
  uploader: { username: string; fullName: string; photoUrl: string | null };
  canRemove: boolean;
}

export interface CommunityReportView {
  id: string;
  reason: string;
  details: string | null;
  status: "PENDING" | "RESOLVED";
  createdAt: string;
  targetType: "POST" | "COMMENT" | "EVENT" | "EVENT_COMMENT" | "ANNOUNCEMENT";
  targetId: string;
  targetExcerpt: string;
  reporter: { username: string; fullName: string };
  author: { id: string; username: string; fullName: string } | null;
}

export interface CommunityDiscoverPayload {
  communities: CommunityCardView[];
  nextCursor: string | null;
  hasMore: boolean;
  trending: CommunityCardView[];
  suggested: CommunityCardView[];
}

export interface CommunityMinePayload {
  active: CommunityCardView[];
  rest: CommunityCardView[];
  invitations: PendingInvitationView[];
}

export interface CommunitySearchPayload {
  communities: CommunityCardView[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface CommunityAdminRow {
  id: string;
  name: string;
  slug: string;
  isOfficial: boolean;
  status: CommunityStatus;
  privacy: CommunityPrivacy;
  category: CommunityCategory;
  memberCount: number;
  postCount: number;
  reportCount: number;
  owner: { username: string; fullName: string } | null;
  createdAt: string;
  pendingOfficialRequest: boolean;
}

export interface CommunityAdminPayload {
  rows: CommunityAdminRow[];
  total: number;
  officialRequests: Array<{
    id: string;
    community: { id: string; name: string; slug: string };
    requestedBy: { username: string; fullName: string };
    note: string;
    createdAt: string;
  }>;
}

export interface CommunityOption {
  id: string;
  name: string;
  slug: string;
  iconUrl: string | null;
  isOfficial: boolean;
  role: CommunityRole;
  rules: Array<{ title: string; body: string }>;
}
