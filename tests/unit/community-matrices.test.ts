import { describe, expect, it } from "vitest";
import {
  COMMUNITY_PRIVACY_DESCRIPTIONS,
  canAccessCommunityAction,
  canTransferOwnership,
  canViewCommunity,
  canViewCommunityContent,
  communityJoinState,
  communityNameError,
  nextOwnerCandidate,
  normalizeCommunityName,
  reservedCommunityName,
  slugifyCommunityName,
  validateResourceLink,
  type CommunityAccess,
  type CommunityAction,
  type CommunityMemberStatus,
  type CommunityPrivacy,
  type CommunityRole,
  type CommunityStatus,
} from "@/lib/domain/community";
import {
  generateInviteToken,
  hashInviteToken,
  inviteError,
  inviteExpiry,
  inviteIsUsable,
} from "@/lib/domain/community-invite";
import { canSeePostInCommunity } from "@/lib/domain/posts";
import { buildStudentPath } from "@/lib/domain/academic";

const NOW = new Date("2026-11-24T12:00:00.000Z");

function access(overrides: Partial<CommunityAccess> = {}): CommunityAccess {
  return {
    communityId: "community_1",
    privacy: "PUBLIC",
    status: "ACTIVE",
    memberStatus: null,
    role: null,
    mutedUntil: null,
    allowMemberUploads: false,
    ...overrides,
  };
}

const viewerPath = buildStudentPath({
  universityId: "uni_nova",
  college: { id: "college_eng", name: "Engineering" },
  faculty: { id: "faculty_computing", name: "Computing" },
  department: { id: "dept_swe", name: "Software Engineering" },
  level: 300,
});

const otherUniversityPath = buildStudentPath({
  universityId: "uni_other",
  college: { id: "college_other", name: "Engineering" },
  faculty: { id: "faculty_other", name: "Computing" },
  department: { id: "dept_other", name: "Software Engineering" },
  level: 300,
});

/* ----------------------------- visibility -------------------------------- */

interface VisibilityCase {
  name: string;
  access: CommunityAccess;
  canView: boolean;
  canViewContent: boolean;
}

const VISIBILITY_CASES: VisibilityCase[] = [
  // PUBLIC + ACTIVE
  { name: "PUBLIC active outsider sees metadata and content", access: access(), canView: true, canViewContent: true },
  {
    name: "PUBLIC active member keeps content",
    access: access({ memberStatus: "ACTIVE", role: "MEMBER" }),
    canView: true,
    canViewContent: true,
  },
  {
    name: "PUBLIC active banned student sees nothing",
    access: access({ memberStatus: "BANNED" }),
    canView: false,
    canViewContent: false,
  },
  {
    name: "PUBLIC active banned moderator sees nothing",
    access: access({ memberStatus: "BANNED", role: "MODERATOR" }),
    canView: false,
    canViewContent: false,
  },
  {
    name: "PUBLIC active former member sees public content again",
    access: access({ memberStatus: "LEFT" }),
    canView: true,
    canViewContent: true,
  },

  // REQUEST + ACTIVE
  { name: "REQUEST active outsider sees metadata only", access: access({ privacy: "REQUEST" }), canView: true, canViewContent: false },
  {
    name: "REQUEST active member reads content",
    access: access({ privacy: "REQUEST", memberStatus: "ACTIVE", role: "MEMBER" }),
    canView: true,
    canViewContent: true,
  },
  {
    name: "REQUEST active owner reads content",
    access: access({ privacy: "REQUEST", memberStatus: "ACTIVE", role: "OWNER" }),
    canView: true,
    canViewContent: true,
  },
  {
    name: "REQUEST active banned student sees nothing",
    access: access({ privacy: "REQUEST", memberStatus: "BANNED" }),
    canView: false,
    canViewContent: false,
  },
  {
    name: "REQUEST active former member loses content",
    access: access({ privacy: "REQUEST", memberStatus: "LEFT", role: "MEMBER" }),
    canView: true,
    canViewContent: false,
  },

  // INVITE_ONLY + ACTIVE
  {
    name: "INVITE_ONLY outsider is indistinguishable from missing",
    access: access({ privacy: "INVITE_ONLY" }),
    canView: false,
    canViewContent: false,
  },
  {
    name: "INVITE_ONLY invited-but-not-joined student still sees nothing",
    access: access({ privacy: "INVITE_ONLY" }),
    canView: false,
    canViewContent: false,
  },
  {
    name: "INVITE_ONLY member reads content",
    access: access({ privacy: "INVITE_ONLY", memberStatus: "ACTIVE", role: "MEMBER" }),
    canView: true,
    canViewContent: true,
  },
  {
    name: "INVITE_ONLY banned member sees nothing",
    access: access({ privacy: "INVITE_ONLY", memberStatus: "BANNED", role: "MODERATOR" }),
    canView: false,
    canViewContent: false,
  },

  // Non-ACTIVE statuses across every privacy
  {
    name: "SUSPENDED public community is closed to outsiders and members",
    access: access({ status: "SUSPENDED", memberStatus: "ACTIVE", role: "OWNER" }),
    canView: false,
    canViewContent: false,
  },
  {
    name: "DELETED community is closed",
    access: access({ status: "DELETED", memberStatus: "ACTIVE", role: "OWNER" }),
    canView: false,
    canViewContent: false,
  },
  {
    name: "ARCHIVED public community is member-only",
    access: access({ status: "ARCHIVED", memberStatus: "ACTIVE", role: "MEMBER" }),
    canView: true,
    canViewContent: true,
  },
  {
    name: "ARCHIVED public community hides itself from outsiders",
    access: access({ status: "ARCHIVED" }),
    canView: false,
    canViewContent: false,
  },
  {
    name: "ARCHIVED invite-only community stays member-only",
    access: access({ status: "ARCHIVED", privacy: "INVITE_ONLY", memberStatus: "ACTIVE", role: "MODERATOR" }),
    canView: true,
    canViewContent: true,
  },
];

describe("community visibility matrix", () => {
  it.each(VISIBILITY_CASES)("$name", ({ access: row, canView, canViewContent }) => {
    expect(canViewCommunity(row)).toBe(canView);
    expect(canViewCommunityContent(row)).toBe(canViewContent);
  });

  it("hides every non-public community from a different university via post access", () => {
    for (const privacy of ["PUBLIC", "REQUEST", "INVITE_ONLY"] as CommunityPrivacy[]) {
      const post = { audiencePath: [], audienceKind: "COMMUNITY" as const, communityId: "community_1" };
      const otherUniversityAccess = access({ privacy, memberStatus: "ACTIVE", role: "MEMBER" });
      // The access row itself is tenant-scoped; a viewer from another tenant can
      // never be handed one, so the domain refuses a mismatched community id.
      expect(
        canSeePostInCommunity(otherUniversityPath, post, { ...otherUniversityAccess, communityId: "community_other" }),
      ).toBe(false);
      expect(canSeePostInCommunity(otherUniversityPath, post, otherUniversityAccess)).toBe(
        canViewCommunityContent(otherUniversityAccess),
      );
    }
  });

  it("never unlocks a community post from the academic path alone", () => {
    const post = { audiencePath: [], audienceKind: "COMMUNITY" as const, communityId: "community_1" };
    expect(canSeePostInCommunity(viewerPath, post, null)).toBe(false);
    expect(canSeePostInCommunity(viewerPath, post, undefined)).toBe(false);
    expect(canSeePostInCommunity(viewerPath, post, access({ memberStatus: "BANNED" }))).toBe(false);
    expect(canSeePostInCommunity(viewerPath, post, access({ memberStatus: "ACTIVE", role: "MEMBER" }))).toBe(true);
  });
});

/* ----------------------------- permissions ------------------------------- */

const ALL_ACTIONS: CommunityAction[] = [
  "VIEW_COMMUNITY",
  "VIEW_CONTENT",
  "VIEW_MEMBERS",
  "VIEW_RESOURCES",
  "DOWNLOAD_RESOURCE",
  "CREATE_POST",
  "COMMENT",
  "REACT",
  "REPOST",
  "UPLOAD_RESOURCE",
  "MANAGE_RESOURCES",
  "APPROVE_REQUEST",
  "INVITE",
  "REMOVE_MEMBER",
  "MUTE_MEMBER",
  "BAN_MEMBER",
  "REMOVE_CONTENT",
  "PIN_POST",
  "EDIT_COMMUNITY",
  "EDIT_PRIVACY",
  "EDIT_RULES",
  "MANAGE_ROLES",
  "TRANSFER_OWNERSHIP",
  "DELETE_COMMUNITY",
  "REQUEST_OFFICIAL",
  "VIEW_REPORTS",
];

const MEMBER_ALLOWED = new Set<CommunityAction>([
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

const MODERATOR_ALLOWED = new Set<CommunityAction>([
  ...MEMBER_ALLOWED,
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

const OWNER_ALLOWED = new Set<CommunityAction>([
  ...MODERATOR_ALLOWED,
  "EDIT_COMMUNITY",
  "EDIT_PRIVACY",
  "EDIT_RULES",
  "MANAGE_ROLES",
  "TRANSFER_OWNERSHIP",
  "DELETE_COMMUNITY",
  "REQUEST_OFFICIAL",
]);

function expectedFor(access: CommunityAccess, action: CommunityAction): boolean {
  if (!canViewCommunity(access)) return false;
  if (access.status === "ARCHIVED") {
    return (
      access.memberStatus === "ACTIVE" &&
      (action === "VIEW_COMMUNITY" ||
        action === "VIEW_CONTENT" ||
        action === "VIEW_MEMBERS" ||
        action === "VIEW_RESOURCES" ||
        action === "DOWNLOAD_RESOURCE")
    );
  }
  if (access.memberStatus !== "ACTIVE") {
    return action === "VIEW_COMMUNITY" || (access.privacy === "PUBLIC" && action === "VIEW_CONTENT");
  }
  if ((action === "CREATE_POST" || action === "COMMENT") && access.mutedUntil) {
    return new Date(access.mutedUntil).getTime() <= NOW.getTime();
  }
  if (action === "UPLOAD_RESOURCE") {
    return access.role === "OWNER" || access.role === "MODERATOR" || access.allowMemberUploads === true;
  }
  if (access.role === "OWNER") return OWNER_ALLOWED.has(action);
  if (access.role === "MODERATOR") return MODERATOR_ALLOWED.has(action);
  return MEMBER_ALLOWED.has(action);
}

describe("community permission matrix", () => {
  const actors: Array<{ name: string; row: CommunityAccess }> = [
    { name: "outsider", row: access() },
    { name: "request outsider", row: access({ privacy: "REQUEST" }) },
    { name: "invite-only outsider", row: access({ privacy: "INVITE_ONLY" }) },
    { name: "member", row: access({ memberStatus: "ACTIVE", role: "MEMBER" }) },
    { name: "moderator", row: access({ memberStatus: "ACTIVE", role: "MODERATOR" }) },
    { name: "owner", row: access({ memberStatus: "ACTIVE", role: "OWNER" }) },
    {
      name: "muted member",
      row: access({ memberStatus: "ACTIVE", role: "MEMBER", mutedUntil: new Date("2026-12-01T00:00:00.000Z") }),
    },
    {
      name: "member whose mute expired",
      row: access({ memberStatus: "ACTIVE", role: "MEMBER", mutedUntil: new Date("2026-11-01T00:00:00.000Z") }),
    },
    { name: "banned member", row: access({ memberStatus: "BANNED", role: "MEMBER" }) },
    { name: "banned moderator", row: access({ memberStatus: "BANNED", role: "MODERATOR" }) },
    { name: "former owner", row: access({ memberStatus: "LEFT", role: "OWNER" }) },
    { name: "archived member", row: access({ status: "ARCHIVED", memberStatus: "ACTIVE", role: "MEMBER" }) },
    { name: "suspended owner", row: access({ status: "SUSPENDED", memberStatus: "ACTIVE", role: "OWNER" }) },
    {
      name: "member with uploads enabled",
      row: access({ memberStatus: "ACTIVE", role: "MEMBER", allowMemberUploads: true }),
    },
  ];

  it.each(actors)("enforces the full action table for a $name", ({ row }) => {
    for (const action of ALL_ACTIONS) {
      expect(canAccessCommunityAction(row, action, NOW), `${action}`).toBe(expectedFor(row, action));
    }
  });

  it("never grants ownership powers to a moderator or member", () => {
    for (const role of ["MODERATOR", "MEMBER"] as CommunityRole[]) {
      const row = access({ memberStatus: "ACTIVE", role });
      for (const action of ["EDIT_COMMUNITY", "EDIT_PRIVACY", "EDIT_RULES", "MANAGE_ROLES", "TRANSFER_OWNERSHIP", "DELETE_COMMUNITY", "REQUEST_OFFICIAL"] as CommunityAction[]) {
        expect(canAccessCommunityAction(row, action, NOW), `${role} ${action}`).toBe(false);
      }
    }
  });
});

/* --------------------------- join state machine -------------------------- */

interface JoinCase {
  name: string;
  input: Parameters<typeof communityJoinState>[0];
  expected: ReturnType<typeof communityJoinState>;
}

const JOIN_CASES: JoinCase[] = [
  { name: "public active outsider can join", input: { access: access() }, expected: "CAN_JOIN" },
  {
    name: "public active student with a pending request is REQUESTED",
    input: { access: access(), pendingRequest: true },
    expected: "REQUESTED",
  },
  {
    name: "request community outsider can request",
    input: { access: access({ privacy: "REQUEST" }) },
    expected: "CAN_REQUEST",
  },
  {
    name: "invite-only outsider needs an invite",
    input: { access: access({ privacy: "INVITE_ONLY" }) },
    expected: "INVITE_REQUIRED",
  },
  {
    name: "invite-only student holding an invite is INVITED",
    input: { access: access({ privacy: "INVITE_ONLY" }), hasInvite: true },
    expected: "INVITED",
  },
  {
    name: "member is JOINED regardless of privacy",
    input: { access: access({ privacy: "INVITE_ONLY", memberStatus: "ACTIVE", role: "MEMBER" }) },
    expected: "JOINED",
  },
  {
    name: "owner is JOINED",
    input: { access: access({ memberStatus: "ACTIVE", role: "OWNER" }) },
    expected: "JOINED",
  },
  { name: "banned student is BANNED", input: { access: access({ memberStatus: "BANNED" }) }, expected: "BANNED" },
  {
    name: "banned student with an invite is still BANNED",
    input: { access: access({ memberStatus: "BANNED" }), hasInvite: true },
    expected: "BANNED",
  },
  {
    name: "suspended community is UNAVAILABLE",
    input: { access: access({ status: "SUSPENDED" }) },
    expected: "UNAVAILABLE",
  },
  {
    name: "deleted community is UNAVAILABLE",
    input: { access: access({ status: "DELETED" }) },
    expected: "UNAVAILABLE",
  },
  {
    name: "archived community cannot be joined by an outsider",
    input: { access: access({ status: "ARCHIVED" }) },
    expected: "UNAVAILABLE",
  },
  {
    name: "archived community still reads as JOINED for members",
    input: { access: access({ status: "ARCHIVED", memberStatus: "ACTIVE", role: "MEMBER" }) },
    expected: "JOINED",
  },
  {
    name: "former member is JOINED-able again",
    input: { access: access({ memberStatus: "LEFT" }) },
    expected: "CAN_JOIN",
  },
];

describe("community join state machine", () => {
  it.each(JOIN_CASES)("$name", ({ input, expected }) => {
    expect(communityJoinState(input)).toBe(expected);
  });

  it("marks invite-only, request and public copy distinctly", () => {
    expect(new Set(Object.values(COMMUNITY_PRIVACY_DESCRIPTIONS)).size).toBe(3);
  });
});

/* ------------------------------- naming ---------------------------------- */

describe("community name normalization and lookalikes", () => {
  const lookalikes: Array<[string, string]> = [
    ["Campus Tech", "campus tech"],
    ["CAMPUS   TECH!!", "campustech"],
    ["Campu5 Tech", "campus tech"],
    ["Cаmpus Tech", "campus tech"], // Cyrillic а
    ["Campus Τech", "campus tech"], // Greek Τ
    ["Càmpus Téch", "campus tech"],
  ];

  it.each(lookalikes)("folds %j to the same uniqueness key", (input, canonical) => {
    expect(normalizeCommunityName(input)).toBe(normalizeCommunityName(canonical));
  });

  it("keeps genuinely different names apart", () => {
    expect(normalizeCommunityName("Campus Tech")).not.toBe(normalizeCommunityName("Campus Arts"));
  });

  it("slugs names deterministically and never returns an empty slug", () => {
    expect(slugifyCommunityName("Nova Tech & Design")).toBe("nova-tech-design");
    expect(slugifyCommunityName("!!!")).toBe("community");
    expect(slugifyCommunityName("a".repeat(60))).toHaveLength(48);
  });

  it("enforces length and character rules at the boundaries", () => {
    expect(communityNameError("ab")).toMatch(/3 characters/);
    expect(communityNameError("abc")).toBeNull();
    expect(communityNameError("a".repeat(40))).toBeNull();
    expect(communityNameError("a".repeat(41))).toMatch(/40/);
    expect(communityNameError("!!!")).toMatch(/letters or numbers/);
  });

  it("reserves university, short-name, academic and official wording", () => {
    const context = {
      universityName: "Nova University",
      universityShortName: "NovaUni",
      academicNames: ["Software Engineering", "Faculty of Law"],
    };
    const reserved = [
      "Nova University Students",
      "NOVA UNIVERSITY",
      "N0va Un1versity",
      "Official Campus Crew",
      "SUG Senate",
      "Software Engineering",
      "software   engineering!",
      "Faculty of Law",
      "NovaUni Tech",
    ];
    for (const name of reserved) {
      expect(reservedCommunityName(name, context), name).not.toBeNull();
    }
    expect(reservedCommunityName("Engineering Innovators", context)).toBeNull();
    expect(reservedCommunityName("Law Students Association", context)).toBeNull();
    // A short name under five characters is too generic to reserve.
    expect(reservedCommunityName("Nova Coders", { universityName: "Nova University", universityShortName: "Nova" })).toBeNull();
  });
});

/* ------------------------------- invites --------------------------------- */

describe("community invite tokens", () => {
  it("generates unique, high-entropy tokens and stores only the hash", () => {
    const tokens = new Set(Array.from({ length: 64 }, () => generateInviteToken()));
    expect(tokens.size).toBe(64);
    for (const token of tokens) {
      expect(token.length).toBeGreaterThanOrEqual(43);
      const hash = hashInviteToken(token);
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
      expect(hash).not.toContain(token);
    }
  });

  it("clamps expiry to 1..30 days and defaults invalid input to 7", () => {
    expect(inviteExpiry(7, NOW).toISOString()).toBe("2026-12-01T12:00:00.000Z");
    expect(inviteExpiry(0, NOW).toISOString()).toBe("2026-11-25T12:00:00.000Z");
    expect(inviteExpiry(-4, NOW).toISOString()).toBe("2026-11-25T12:00:00.000Z");
    expect(inviteExpiry(999, NOW).toISOString()).toBe("2026-12-24T12:00:00.000Z");
    expect(inviteExpiry(Number.NaN, NOW).toISOString()).toBe("2026-12-01T12:00:00.000Z");
  });

  it("rejects expired, revoked, used and exhausted invites", () => {
    const base = { status: "ACTIVE" as const, expiresAt: new Date("2026-12-01T00:00:00.000Z"), uses: 0, maxUses: 2, kind: "LINK" as const };
    expect(inviteIsUsable(base, NOW)).toBe(true);
    expect(inviteIsUsable({ ...base, expiresAt: new Date("2026-11-24T11:59:59.000Z") }, NOW)).toBe(false);
    expect(inviteError({ ...base, expiresAt: new Date("2026-11-24T11:59:59.000Z") }, NOW)).toMatch(/expired/i);
    expect(inviteIsUsable({ ...base, status: "REVOKED" }, NOW)).toBe(false);
    expect(inviteIsUsable({ ...base, status: "USED" }, NOW)).toBe(false);
    expect(inviteIsUsable({ ...base, uses: 2 }, NOW)).toBe(false);
    expect(inviteError({ ...base, uses: 2 }, NOW)).toMatch(/limit/i);
    expect(inviteIsUsable({ ...base, maxUses: null, uses: 10_000 }, NOW)).toBe(true);
    expect(inviteError(null)).toMatch(/isn't available/i);
  });
});

/* ------------------------------ ownership -------------------------------- */

describe("community ownership rules", () => {
  const member = (userId: string, role: "OWNER" | "MODERATOR" | "MEMBER", joinedAt: string, status: "ACTIVE" | "LEFT" | "BANNED" = "ACTIVE") => ({
    userId,
    role,
    status,
    joinedAt: new Date(joinedAt),
  });

  it("prefers the oldest moderator, then the oldest member, and never the leaving owner", () => {
    const members = [
      member("owner", "OWNER", "2025-01-01"),
      member("mod-old", "MODERATOR", "2025-01-02"),
      member("mod-new", "MODERATOR", "2025-01-03"),
      member("member-old", "MEMBER", "2025-01-04"),
      member("member-new", "MEMBER", "2025-01-05"),
      member("left-mod", "MODERATOR", "2024-01-01", "LEFT"),
    ];
    expect(nextOwnerCandidate(members, "owner")).toEqual({ userId: "mod-old", role: "MODERATOR" });
    const withoutMods = members.filter((row) => row.role !== "MODERATOR");
    expect(nextOwnerCandidate(withoutMods, "owner")).toEqual({ userId: "member-old", role: "MEMBER" });
    expect(nextOwnerCandidate([member("owner", "OWNER", "2025-01-01")], "owner")).toBeNull();
  });

  it("allows only an owner to hand the community to an active non-owner", () => {
    expect(
      canTransferOwnership({ actorId: "o", actorRole: "OWNER", targetId: "m", targetRole: "MEMBER", targetStatus: "ACTIVE" }),
    ).toBe(true);
    expect(
      canTransferOwnership({ actorId: "o", actorRole: "OWNER", targetId: "m", targetRole: "MODERATOR", targetStatus: "ACTIVE" }),
    ).toBe(true);
    expect(
      canTransferOwnership({ actorId: "o", actorRole: "OWNER", targetId: "o", targetRole: "OWNER", targetStatus: "ACTIVE" }),
    ).toBe(false);
    expect(
      canTransferOwnership({ actorId: "m", actorRole: "MODERATOR", targetId: "x", targetRole: "MEMBER", targetStatus: "ACTIVE" }),
    ).toBe(false);
    expect(
      canTransferOwnership({ actorId: "o", actorRole: "OWNER", targetId: "x", targetRole: "MEMBER", targetStatus: "BANNED" }),
    ).toBe(false);
    expect(
      canTransferOwnership({ actorId: "o", actorRole: "OWNER", targetId: "x", targetRole: "MEMBER", targetStatus: "LEFT" }),
    ).toBe(false);
  });
});

/* ------------------------------ resources -------------------------------- */

describe("resource link validation", () => {
  it.each([
    ["https://example.edu.ng/notes.pdf", true],
    ["https://www.youtube.com/watch?v=1", true],
    ["http://example.edu.ng/notes.pdf", false],
    ["https://user:pass@example.edu.ng/file", false],
    ["javascript:alert(1)", false],
    ["not a link", false],
    ["", false],
  ])("%j valid=%s", (link, valid) => {
    expect(validateResourceLink(link) === null).toBe(valid);
  });
});

/* ------------------------------ member statuses -------------------------- */

describe("community membership statuses", () => {
  it("treats every non-active status as not a member", () => {
    for (const status of ["LEFT", "BANNED", null] as Array<CommunityMemberStatus | null>) {
      expect(canViewCommunityContent(access({ privacy: "REQUEST", memberStatus: status }))).toBe(false);
    }
  });

  it("does not let an archived or suspended status slip through the role map", () => {
    for (const status of ["ARCHIVED", "SUSPENDED", "DELETED"] as CommunityStatus[]) {
      const row = access({ status, memberStatus: "ACTIVE", role: "OWNER" });
      expect(canAccessCommunityAction(row, "MANAGE_ROLES", NOW)).toBe(false);
    }
  });
});
