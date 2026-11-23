/**
 * Shared, serialisable shapes for the Pulse UI. These are plain data types with
 * no server imports, so client components can accept them directly.
 */
export type PostTypeView = "POST" | "QUESTION" | "POLL" | "REPOST";
export type AudienceKindView = "PUBLIC" | "COLLEGE" | "FACULTY" | "DEPARTMENT" | "LEVEL" | "COMMUNITY";
export type PostStatusView = "ACTIVE" | "REMOVED" | "DELETED";

export interface PostAuthorView {
  id: string;
  username: string;
  fullName: string;
  photoUrl: string | null;
  isOfficial: boolean;
  level: number | null;
  departmentName: string | null;
}

export interface PostMediaView {
  id: string;
  url: string;
  width: number;
  height: number;
  alt: string | null;
}

export interface PollOptionView {
  id: string;
  text: string;
  count: number;
  percent: number;
}

export interface PollView {
  id: string;
  endsAt: string;
  totalVotes: number;
  options: PollOptionView[];
  hasVoted: boolean;
  votedOptionId: string | null;
  resultsVisible: boolean;
  isOpen: boolean;
}

export interface RepostSourceView {
  id: string;
  body: string;
  createdAt: string;
  author: PostAuthorView;
  status: PostStatusView;
}

export interface PostCommunityView {
  id: string;
  name: string;
  slug: string;
  iconUrl: string | null;
  isOfficial: boolean;
  privacy: "PUBLIC" | "REQUEST" | "INVITE_ONLY";
}

export interface PostView {
  id: string;
  type: PostTypeView;
  body: string;
  audienceKind: AudienceKindView;
  audienceLabel: string;
  community: PostCommunityView | null;
  pinned?: boolean;
  status: PostStatusView;
  createdAt: string;
  editedAt: string | null;
  questionTitle: string | null;
  topicTag: string | null;
  acceptedCommentId: string | null;
  moderationReason: string | null;
  author: PostAuthorView;
  media: PostMediaView[];
  poll: PollView | null;
  repostOf: RepostSourceView | null;
  commentCount: number;
  reactionCount: number;
  repostCount: number;
  bookmarkCount: number;
  viewer: {
    reacted: boolean;
    bookmarked: boolean;
    canInteract: boolean;
    isMember: boolean;
    role: "OWNER" | "MODERATOR" | "MEMBER" | null;
    muted: boolean;
  };
  isOwner: boolean;
}

export interface CommentAuthorView {
  id: string;
  username: string;
  fullName: string;
  photoUrl: string | null;
  isOfficial: boolean;
}

export interface CommentView {
  id: string;
  postId: string;
  parentId: string | null;
  body: string;
  status: "ACTIVE" | "REMOVED";
  helpfulCount: number;
  createdAt: string;
  editedAt: string | null;
  moderationReason: string | null;
  author: CommentAuthorView | null;
  viewer: { reacted: boolean; helpful: boolean };
  isOwner: boolean;
  replies?: CommentView[];
  replyCount?: number;
}

export interface FeedPage {
  posts: PostView[];
  nextCursor: string | null;
  hasMore: boolean;
}

export type FeedFilter = "all" | "level" | "department" | "college" | "faculty" | "public" | "communities";

export interface FeedFilterOption {
  value: FeedFilter;
  label: string;
}

export interface TrendingTag {
  tag: string;
  postCount: number;
}

export interface PostDetailPayload {
  post: PostView;
  comments: CommentView[];
  commentSort: "top" | "newest";
}

export interface DraftView {
  id: string;
  type: PostTypeView;
  payload: {
    body?: string;
    questionTitle?: string;
    topicTag?: string;
    pollOptions?: string[];
    pollDurationDays?: number;
    media?: Array<{ publicId: string; url: string; width: number; height: number; alt?: string | null }>;
    communityId?: string;
  };
  audience: { id?: string; label?: string; path?: string[]; kind?: AudienceKindView; communityId?: string };
  updatedAt: string;
}

export interface HashtagPage {
  tag: string;
  postCount: number;
  posts: PostView[];
  nextCursor: string | null;
  hasMore: boolean;
  sort: "top" | "latest";
}

export interface BookmarkPage {
  posts: PostView[];
  nextCursor: string | null;
  hasMore: boolean;
}
