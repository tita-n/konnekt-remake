/**
 * Pure community rules shared by server services, tests and presentational
 * helpers. No Prisma or request objects cross this boundary.
 */

export type CommunityCategory =
  | "ACADEMIC"
  | "TECH"
  | "SPORTS"
  | "ARTS"
  | "FAITH"
  | "BUSINESS"
  | "HOSTEL"
  | "ASSOCIATION"
  | "HOBBY"
  | "OTHER";

export type CommunityPrivacy = "PUBLIC" | "REQUEST" | "INVITE_ONLY";
export type CommunityStatus = "ACTIVE" | "SUSPENDED" | "ARCHIVED" | "DELETED";
export type CommunityRole = "OWNER" | "MODERATOR" | "MEMBER";
export type CommunityMemberStatus = "ACTIVE" | "BANNED" | "LEFT";
export type JoinRequestStatus = "PENDING" | "APPROVED" | "DECLINED" | "CANCELLED";
export type CommunityInviteStatus = "ACTIVE" | "REVOKED" | "EXPIRED" | "USED";

export interface CommunityAccess {
  communityId: string;
  privacy: CommunityPrivacy;
  status: CommunityStatus;
  memberStatus: CommunityMemberStatus | null;
  role: CommunityRole | null;
  mutedUntil?: Date | string | null;
  allowMemberUploads?: boolean;
}

export interface CommunitySettings {
  privacy: CommunityPrivacy;
  status: CommunityStatus;
  memberStatus: CommunityMemberStatus | null;
  role: CommunityRole | null;
  allowMemberUploads: boolean;
}

export const COMMUNITY_CATEGORIES: ReadonlyArray<{ value: CommunityCategory; label: string }> = [
  { value: "ACADEMIC", label: "Academic" },
  { value: "TECH", label: "Tech" },
  { value: "SPORTS", label: "Sports" },
  { value: "ARTS", label: "Arts" },
  { value: "FAITH", label: "Faith" },
  { value: "BUSINESS", label: "Business" },
  { value: "HOSTEL", label: "Hostel" },
  { value: "ASSOCIATION", label: "Association" },
  { value: "HOBBY", label: "Hobby" },
  { value: "OTHER", label: "Other" },
];

export const COMMUNITY_CATEGORY_LABELS: Record<CommunityCategory, string> = Object.fromEntries(
  COMMUNITY_CATEGORIES.map((entry) => [entry.value, entry.label]),
) as Record<CommunityCategory, string>;

export const COMMUNITY_PRIVACY_LABELS: Record<CommunityPrivacy, string> = {
  PUBLIC: "Public",
  REQUEST: "Request to join",
  INVITE_ONLY: "Invite only",
};

export const COMMUNITY_PRIVACY_DESCRIPTIONS: Record<CommunityPrivacy, string> = {
  PUBLIC: "Anyone at your university can read and join in one tap.",
  REQUEST: "People can find you, but posts stay locked until you approve them.",
  INVITE_ONLY: "Hidden from search and suggestions. Only invited students can join.",
};

export const MAX_COMMUNITY_RULES = 10;
export const MAX_COMMUNITY_RESOURCES = 200;
export const MAX_RESOURCE_BYTES = 10 * 1024 * 1024;
export const MAX_PINS = 3;
export const DEFAULT_INVITE_DAYS = 7;
export const MAX_INVITE_DAYS = 30;
export const COMMUNITY_PAGE_SIZE = 12;

export const COMMUNITY_RULE_TEMPLATES: ReadonlyArray<{ title: string; body: string }> = [
  { title: "Be kind", body: "Disagree with ideas, never attack people. Harassment gets removed." },
  { title: "Keep it relevant", body: "Post about this community's subject so the feed stays useful." },
  { title: "No spam", body: "No repeated adverts, scams or unsolicited promotions." },
  { title: "Credit sources", body: "Share the source when you post news, files or claims." },
  { title: "Protect privacy", body: "Do not post someone's private details, ID or contact information." },
];

/**
 * Convert a display name into its uniqueness key: case-folded, accent-free,
 * punctuation-free and lookalike-folded. "N0va  Tech!!" and "nova tech" share
 * the same key, so a near-lookalike cannot squat beside the real name.
 */
export function normalizeCommunityName(input: string): string {
  const folded = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[а-яё]/g, (character) => CYRILLIC_LOOKALIKES[character] ?? character)
    .replace(/[α-ω]/g, (character) => GREEK_LOOKALIKES[character] ?? character)
    .replace(/[@4]/g, "a")
    .replace(/[0135$7]/g, (character) => DIGIT_LOOKALIKES[character] ?? character)
    .replace(/[^a-z0-9]/g, "");
  return folded;
}

const CYRILLIC_LOOKALIKES: Record<string, string> = {
  а: "a",
  в: "b",
  е: "e",
  к: "k",
  м: "m",
  н: "h",
  о: "o",
  р: "p",
  с: "c",
  т: "t",
  у: "y",
  х: "x",
  і: "i",
  ѕ: "s",
  ј: "j",
};

const GREEK_LOOKALIKES: Record<string, string> = {
  α: "a",
  β: "b",
  ε: "e",
  ι: "i",
  κ: "k",
  ο: "o",
  ρ: "p",
  τ: "t",
  υ: "u",
  χ: "x",
};

const DIGIT_LOOKALIKES: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "5": "s",
  "$": "s",
  "7": "t",
};

const RESERVED_TOKENS = [
  "official",
  "sug",
  "studentunion",
  "studentsunion",
  "admin",
  "administrator",
  "moderator",
  "university",
  "vicechancellor",
  "registrar",
  "bursary",
  "admissions",
  "faculty",
  "department",
  "senate",
] as const;

export interface ReservedNameContext {
  universityName: string;
  universityShortName: string;
  academicNames?: readonly string[];
}

/** Null means allowed; a string is the message shown at creation. */
export function reservedCommunityName(name: string, context: ReservedNameContext): string | null {
  const normalized = normalizeCommunityName(name);
  if (!normalized) return "Give your community a name.";
  const university = normalizeCommunityName(context.universityName);
  const shortName = normalizeCommunityName(context.universityShortName);
  if (university && normalized.includes(university)) {
    return "Names that use the university name are reserved for official communities. Create a student-run name instead, or ask a university admin about official status.";
  }
  if (shortName.length >= 5 && normalized.includes(shortName)) {
    return "This name is too close to an official university name. Choose a distinct student-run name, or request official status.";
  }
  const academic = new Set((context.academicNames ?? []).map(normalizeCommunityName).filter((value) => value.length >= 4));
  if (academic.has(normalized)) {
    return "Department, faculty and college names are reserved for official communities. Ask a university admin to create or mark one official.";
  }
  for (const token of RESERVED_TOKENS) {
    if (normalized.includes(token)) {
      return "Names that include official, SUG, admin or university wording are reserved. Use a distinct name and request official status from a university admin.";
    }
  }
  return null;
}

export function communityNameError(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length < 3) return "Use at least 3 characters.";
  if (trimmed.length > 40) return "Keep the name under 40 characters.";
  if (!/[\p{L}\p{N}]/u.test(trimmed)) return "Use letters or numbers in the name.";
  return null;
}

export function slugifyCommunityName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "community";
}

export type CommunityAction =
  | "VIEW_COMMUNITY"
  | "VIEW_CONTENT"
  | "VIEW_MEMBERS"
  | "VIEW_RESOURCES"
  | "DOWNLOAD_RESOURCE"
  | "CREATE_POST"
  | "COMMENT"
  | "REACT"
  | "REPOST"
  | "UPLOAD_RESOURCE"
  | "MANAGE_RESOURCES"
  | "APPROVE_REQUEST"
  | "INVITE"
  | "REMOVE_MEMBER"
  | "MUTE_MEMBER"
  | "BAN_MEMBER"
  | "REMOVE_CONTENT"
  | "PIN_POST"
  | "EDIT_COMMUNITY"
  | "EDIT_PRIVACY"
  | "EDIT_RULES"
  | "MANAGE_ROLES"
  | "TRANSFER_OWNERSHIP"
  | "DELETE_COMMUNITY"
  | "REQUEST_OFFICIAL"
  | "VIEW_REPORTS";

const MEMBER_ACTIONS: ReadonlySet<CommunityAction> = new Set([
  "VIEW_COMMUNITY",
  "VIEW_CONTENT",
  "VIEW_MEMBERS",
  "VIEW_RESOURCES",
  "DOWNLOAD_RESOURCE",
  "CREATE_POST",
  "COMMENT",
  "REACT",
  "REPOST",
]);

const MODERATOR_ACTIONS: ReadonlySet<CommunityAction> = new Set([
  ...MEMBER_ACTIONS,
  "MANAGE_RESOURCES",
  "APPROVE_REQUEST",
  "INVITE",
  "REMOVE_MEMBER",
  "MUTE_MEMBER",
  "BAN_MEMBER",
  "REMOVE_CONTENT",
  "PIN_POST",
  "VIEW_REPORTS",
]);

const OWNER_ACTIONS: ReadonlySet<CommunityAction> = new Set([
  ...MODERATOR_ACTIONS,
  "EDIT_COMMUNITY",
  "EDIT_PRIVACY",
  "EDIT_RULES",
  "MANAGE_ROLES",
  "TRANSFER_OWNERSHIP",
  "DELETE_COMMUNITY",
  "REQUEST_OFFICIAL",
]);

export function isActiveMember(access: Pick<CommunityAccess, "memberStatus">): boolean {
  return access.memberStatus === "ACTIVE";
}

export function isBanned(access: Pick<CommunityAccess, "memberStatus">): boolean {
  return access.memberStatus === "BANNED";
}

export function isMuted(access: Pick<CommunityAccess, "mutedUntil">, now = new Date()): boolean {
  if (!access.mutedUntil) return false;
  return new Date(access.mutedUntil).getTime() > now.getTime();
}

export function canViewCommunity(access: CommunityAccess): boolean {
  if (access.status === "DELETED" || access.status === "SUSPENDED") return false;
  if (isBanned(access)) return false;
  if (access.status === "ARCHIVED") return isActiveMember(access);
  if (isActiveMember(access)) return true;
  return access.privacy === "PUBLIC" || access.privacy === "REQUEST";
}

/**
 * Reads of posts, members and resources. A PUBLIC community is read-only for
 * the rest of the university. REQUEST metadata is visible, but its content is
 * member-only. INVITE_ONLY is member-only in every respect.
 */
export function canViewCommunityContent(access: CommunityAccess): boolean {
  if (!canViewCommunity(access)) return false;
  if (access.status === "ARCHIVED") return isActiveMember(access);
  if (isActiveMember(access)) return true;
  return access.privacy === "PUBLIC";
}

export function canAccessCommunityAction(
  access: CommunityAccess,
  action: CommunityAction,
  now = new Date(),
): boolean {
  if (!canViewCommunity(access)) return false;
  if (access.status === "ARCHIVED") {
    return (
      isActiveMember(access) &&
      (action === "VIEW_COMMUNITY" ||
        action === "VIEW_CONTENT" ||
        action === "VIEW_MEMBERS" ||
        action === "VIEW_RESOURCES" ||
        action === "DOWNLOAD_RESOURCE")
    );
  }
  if (!isActiveMember(access)) {
    return action === "VIEW_COMMUNITY" || (access.privacy === "PUBLIC" && action === "VIEW_CONTENT");
  }
  if ((action === "CREATE_POST" || action === "COMMENT") && isMuted(access, now)) return false;
  if (action === "UPLOAD_RESOURCE") {
    return access.role === "OWNER" || access.role === "MODERATOR" || access.allowMemberUploads === true;
  }
  const role = access.role ?? "MEMBER";
  if (role === "OWNER") return OWNER_ACTIONS.has(action);
  if (role === "MODERATOR") return MODERATOR_ACTIONS.has(action);
  return MEMBER_ACTIONS.has(action);
}

export function canViewLockedMetadata(access: CommunityAccess): boolean {
  return canViewCommunity(access) && access.privacy === "REQUEST" && !isActiveMember(access);
}

export type CommunityJoinState =
  | "JOINED"
  | "REQUESTED"
  | "INVITED"
  | "BANNED"
  | "CAN_JOIN"
  | "CAN_REQUEST"
  | "INVITE_REQUIRED"
  | "UNAVAILABLE";

export function communityJoinState(input: {
  access: CommunityAccess;
  pendingRequest?: boolean;
  hasInvite?: boolean;
}): CommunityJoinState {
  const { access } = input;
  if (access.status === "DELETED" || access.status === "SUSPENDED") return "UNAVAILABLE";
  if (isBanned(access)) return "BANNED";
  if (isActiveMember(access)) return "JOINED";
  // Archived communities are read-only for existing members and closed to
  // everyone else, so no join affordance should be offered.
  if (access.status === "ARCHIVED") return "UNAVAILABLE";
  if (input.pendingRequest) return "REQUESTED";
  if (input.hasInvite) return "INVITED";
  if (access.privacy === "PUBLIC") return "CAN_JOIN";
  if (access.privacy === "REQUEST") return "CAN_REQUEST";
  return "INVITE_REQUIRED";
}

export function nextOwnerCandidate(
  members: ReadonlyArray<{ userId: string; role: CommunityRole; status: CommunityMemberStatus; joinedAt: Date | string }>,
  excludeUserId?: string,
): { userId: string; role: "MODERATOR" | "MEMBER" } | null {
  const active = members
    .filter((member) => member.status === "ACTIVE" && member.userId !== excludeUserId)
    .sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime());
  const moderator = active.find((member) => member.role === "MODERATOR");
  if (moderator) return { userId: moderator.userId, role: "MODERATOR" };
  const member = active.find((member) => member.role === "MEMBER");
  return member ? { userId: member.userId, role: "MEMBER" } : null;
}

export function canTransferOwnership(input: {
  actorId: string;
  actorRole: CommunityRole;
  targetId: string;
  targetRole: CommunityRole;
  targetStatus: CommunityMemberStatus;
}): boolean {
  return (
    input.actorRole === "OWNER" &&
    input.actorId !== input.targetId &&
    input.targetStatus === "ACTIVE" &&
    (input.targetRole === "MEMBER" || input.targetRole === "MODERATOR")
  );
}

export type ResourceKind = "FILE" | "LINK";

export const ALLOWED_RESOURCE_EXTENSIONS = [
  "pdf",
  "docx",
  "pptx",
  "xlsx",
  "txt",
  "png",
  "jpg",
  "jpeg",
  "webp",
] as const;

export const ALLOWED_RESOURCE_MIME: Record<string, readonly string[]> = {
  pdf: ["application/pdf"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  pptx: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  txt: ["text/plain"],
  png: ["image/png"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  webp: ["image/webp"],
};

export function resourceExtension(filename: string): string | null {
  const extension = filename.toLowerCase().split(".").pop() ?? "";
  return (ALLOWED_RESOURCE_EXTENSIONS as readonly string[]).includes(extension) ? extension : null;
}

export function resourceMimeForExtension(extension: string): string | null {
  return ALLOWED_RESOURCE_MIME[extension]?.[0] ?? null;
}

/** Validate an https link resource. */
export function validateResourceLink(input: string): string | null {
  try {
    const url = new URL(input);
    if (url.protocol !== "https:") return "Use an https:// link.";
    if (!url.hostname.includes(".")) return "Enter a complete web address.";
    if (url.username || url.password) return "Remove sign-in details from the link.";
    return null;
  } catch {
    return "Enter a valid https:// link.";
  }
}
