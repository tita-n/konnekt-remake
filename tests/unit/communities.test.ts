import { describe, expect, it } from "vitest";
import {
  COMMUNITY_CATEGORY_LABELS,
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
} from "@/lib/domain/community";
import {
  generateInviteToken,
  hashInviteToken,
  inviteError,
  inviteExpiry,
  inviteIsUsable,
} from "@/lib/domain/community-invite";
import { canSeePost, canSeePostInCommunity, filterIncludesCommunityPosts } from "@/lib/domain/posts";
import { buildStudentPath } from "@/lib/domain/academic";

const UNI = "uni_nova";
const COLLEGE = "college_eng";
const FACULTY = "faculty_computing";
const DEPT = "dept_swe";

const studentPath = buildStudentPath({
  universityId: UNI,
  college: { id: COLLEGE, name: "Engineering" },
  faculty: { id: FACULTY, name: "Computing" },
  department: { id: DEPT, name: "Software Engineering" },
  level: 300,
});

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

describe("community names", () => {
  it("normalizes lookalike names before uniqueness checks", () => {
    expect(normalizeCommunityName("N0va  Téch!!")).toBe("novatech");
    expect(normalizeCommunityName("Nоva Теch")).toBe("novatech");
    expect(slugifyCommunityName("Nova Tech & Design")).toBe("nova-tech-design");
  });

  it("reserves official, university and academic names", () => {
    const context = {
      universityName: "Nova University",
      universityShortName: "Nova",
      academicNames: ["Software Engineering", "Faculty of Law"],
    };
    expect(reservedCommunityName("Nova University Students", context)).not.toBeNull();
    expect(reservedCommunityName("Official Campus Crew", context)).not.toBeNull();
    expect(reservedCommunityName("Software Engineering", context)).not.toBeNull();
    expect(reservedCommunityName("Engineering Innovators", context)).toBeNull();
    expect(communityNameError("A")).not.toBeNull();
    expect(communityNameError("A valid community")).toBeNull();
    expect(COMMUNITY_CATEGORY_LABELS.TECH).toBe("Tech");
  });
});

describe("community visibility", () => {
  it("keeps REQUEST metadata visible while its content stays member-only", () => {
    const outsider = access({ privacy: "REQUEST" });
    expect(canViewCommunity(outsider)).toBe(true);
    expect(canViewCommunityContent(outsider)).toBe(false);
    expect(canAccessCommunityAction(outsider, "VIEW_CONTENT")).toBe(false);
    expect(canAccessCommunityAction(outsider, "VIEW_COMMUNITY")).toBe(true);
    expect(canViewCommunityContent(access({ privacy: "REQUEST", memberStatus: "ACTIVE", role: "MEMBER" }))).toBe(true);
  });

  it("makes INVITE_ONLY indistinguishable from a missing community to outsiders", () => {
    const outsider = access({ privacy: "INVITE_ONLY" });
    expect(canViewCommunity(outsider)).toBe(false);
    expect(canViewCommunityContent(outsider)).toBe(false);
    expect(canAccessCommunityAction(outsider, "VIEW_COMMUNITY")).toBe(false);
    expect(communityJoinState({ access: outsider })).toBe("INVITE_REQUIRED");
    const invited = access({ privacy: "INVITE_ONLY" });
    expect(communityJoinState({ access: invited, hasInvite: true })).toBe("INVITED");
  });

  it("keeps archived communities readable by members only", () => {
    const member = access({ status: "ARCHIVED", memberStatus: "ACTIVE", role: "MEMBER" });
    expect(canViewCommunity(member)).toBe(true);
    expect(canViewCommunityContent(member)).toBe(true);
    expect(canAccessCommunityAction(member, "CREATE_POST")).toBe(false);
    expect(canAccessCommunityAction(access({ status: "ARCHIVED" }), "VIEW_COMMUNITY")).toBe(false);
    expect(canViewCommunity(access({ status: "SUSPENDED", memberStatus: "ACTIVE" }))).toBe(false);
  });
});

describe("community permissions", () => {
  it("enforces owner, moderator and member actions with mute and upload rules", () => {
    const owner = access({ memberStatus: "ACTIVE", role: "OWNER" });
    const moderator = access({ memberStatus: "ACTIVE", role: "MODERATOR" });
    const member = access({ memberStatus: "ACTIVE", role: "MEMBER" });
    expect(canAccessCommunityAction(owner, "EDIT_COMMUNITY")).toBe(true);
    expect(canAccessCommunityAction(moderator, "EDIT_COMMUNITY")).toBe(false);
    expect(canAccessCommunityAction(moderator, "PIN_POST")).toBe(true);
    expect(canAccessCommunityAction(member, "PIN_POST")).toBe(false);
    expect(canAccessCommunityAction(member, "UPLOAD_RESOURCE")).toBe(false);
    expect(canAccessCommunityAction(access({ ...member, allowMemberUploads: true }), "UPLOAD_RESOURCE")).toBe(true);
    const muted = access({
      ...member,
      mutedUntil: new Date(Date.now() + 60_000),
    });
    expect(canAccessCommunityAction(muted, "CREATE_POST")).toBe(false);
    expect(canAccessCommunityAction(muted, "COMMENT")).toBe(false);
    expect(canAccessCommunityAction(muted, "REACT")).toBe(true);
  });

  it("chooses a moderator first and never transfers to an inactive owner", () => {
    const members = [
      { userId: "owner", role: "OWNER" as const, status: "ACTIVE" as const, joinedAt: new Date("2025-01-01") },
      { userId: "member", role: "MEMBER" as const, status: "ACTIVE" as const, joinedAt: new Date("2025-01-02") },
      { userId: "mod", role: "MODERATOR" as const, status: "ACTIVE" as const, joinedAt: new Date("2025-01-03") },
    ];
    expect(nextOwnerCandidate(members, "owner")).toEqual({ userId: "mod", role: "MODERATOR" });
    expect(
      canTransferOwnership({
        actorId: "owner",
        actorRole: "OWNER",
        targetId: "mod",
        targetRole: "MODERATOR",
        targetStatus: "ACTIVE",
      }),
    ).toBe(true);
    expect(
      canTransferOwnership({
        actorId: "owner",
        actorRole: "OWNER",
        targetId: "banned",
        targetRole: "MEMBER",
        targetStatus: "BANNED",
      }),
    ).toBe(false);
  });
});

describe("community posts", () => {
  it("keeps community posts out of academic feeds and honours access", () => {
    const post = { audiencePath: [], audienceKind: "COMMUNITY" as const, communityId: "community_1" };
    expect(canSeePost(studentPath, post)).toBe(false);
    expect(canSeePostInCommunity(studentPath, post, access())).toBe(true);
    expect(canSeePostInCommunity(studentPath, post, access({ privacy: "REQUEST" }))).toBe(false);
    expect(canSeePostInCommunity(studentPath, post, access({ memberStatus: "BANNED" }))).toBe(false);
    expect(canSeePostInCommunity(studentPath, post, null)).toBe(false);
    expect(filterIncludesCommunityPosts("all")).toBe(true);
    expect(filterIncludesCommunityPosts("communities")).toBe(true);
    expect(filterIncludesCommunityPosts("department")).toBe(false);
  });
});

describe("community invites and resources", () => {
  it("stores only a hash of a high-entropy invite token", () => {
    const token = generateInviteToken();
    expect(token.length).toBeGreaterThanOrEqual(40);
    expect(hashInviteToken(token)).toHaveLength(64);
    expect(hashInviteToken(token)).toBe(hashInviteToken(token));
    expect(hashInviteToken(token)).not.toBe(token);
    const expiry = inviteExpiry(7);
    expect(expiry.getTime()).toBeGreaterThan(Date.now());
    const usable = { status: "ACTIVE" as const, expiresAt: expiry, uses: 0, maxUses: 2, kind: "LINK" as const };
    expect(inviteIsUsable(usable)).toBe(true);
    expect(inviteError(usable)).toBeNull();
    expect(inviteIsUsable({ ...usable, uses: 2 })).toBe(false);
    expect(inviteError({ ...usable, status: "REVOKED" })).toMatch(/revoked/i);
  });

  it("accepts only complete https resource links", () => {
    expect(validateResourceLink("https://example.edu.ng/notes.pdf")).toBeNull();
    expect(validateResourceLink("http://example.edu.ng/notes.pdf")).not.toBeNull();
    expect(validateResourceLink("https://user:pass@example.edu.ng/file")).not.toBeNull();
    expect(validateResourceLink("not a link")).not.toBeNull();
  });
});
