import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { platformDb } from "@/lib/db/platform";
import { tenantDb } from "@/lib/db/tenant";
import { buildStudentPath } from "@/lib/domain/academic";
import type { SocialViewer } from "@/lib/services/social";
import {
  createCommunity,
  decideJoinRequest,
  joinCommunity,
  leaveCommunity,
  listCommunityMembers,
  listDiscoverCommunities,
  listJoinRequests,
  transferCommunityOwnership,
} from "@/lib/services/communities";

const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
let universityId: string;
let universityName: string;
let owner: SocialViewer;
let member: SocialViewer;
let requester: SocialViewer;
let outsiderUniversityId: string;
let outsider: SocialViewer;

function viewer(input: {
  id: string;
  universityId: string;
  username: string;
  departmentId: string;
  level?: number;
  staff?: boolean;
}): SocialViewer {
  const path = buildStudentPath({
    universityId: input.universityId,
    department: { id: input.departmentId, name: "Software Engineering" },
    level: input.level ?? 300,
  });
  return {
    userId: input.id,
    universityId: input.universityId,
    studentPath: path,
    departmentId: input.departmentId,
    level: input.level ?? 300,
    username: input.username,
    fullName: input.username,
    photoUrl: null,
    labels: { college: "College", faculty: "Faculty", department: "Department" },
    lineage: { college: null, faculty: null, department: "Software Engineering" },
    accountAgeHours: 72,
    interests: ["Coding"],
    isUniversityStaff: input.staff ?? false,
    isUniversityAdmin: input.staff ?? false,
  };
}

beforeAll(async () => {
  const university = await platformDb.university.create({
    data: {
      name: `Community Test ${suffix}`,
      shortName: "CTU",
      slug: `community-test-${suffix}`,
      status: "ACTIVE",
      matricPattern: "^[A-Z]{3}/\\d{4}/\\d{3,4}$",
      studentEmailDomains: [`ct-${suffix}.edu.ng`],
      labels: { department: "Department" },
    },
    select: { id: true },
  });
  universityId = university.id;
  universityName = `Community Test ${suffix}`;
  const otherUniversity = await platformDb.university.create({
    data: {
      name: `Community Other ${suffix}`,
      shortName: "COT",
      slug: `community-other-${suffix}`,
      status: "ACTIVE",
      matricPattern: "^[A-Z]{3}/\\d{4}/\\d{3,4}$",
      studentEmailDomains: [`co-${suffix}.edu.ng`],
      labels: { department: "Department" },
    },
    select: { id: true },
  });
  outsiderUniversityId = otherUniversity.id;

  const db = tenantDb(universityId);
  const department = await db.academicNode.create({
    data: {
      universityId,
      type: "DEPARTMENT",
      name: "Software Engineering",
      slug: `swe-${suffix}`,
      levels: [100, 200, 300, 400],
    },
    select: { id: true },
  });
  const baseUser = {
    passwordHash: "not-a-real-hash",
    emailVerified: true,
    status: "VERIFIED" as const,
    consentPolicyVersion: "2026-01-01",
    consentAcceptedAt: new Date(),
    departmentNodeId: department.id,
    level: 300,
    onboardingCompletedAt: new Date(),
    verifiedAt: new Date(),
  };
  const ownerRow = await db.user.create({
    data: {
      ...baseUser,
      universityId,
      email: `owner-${suffix}@ct-${suffix}.edu.ng`,
      username: `owner${suffix}`.slice(0, 30),
      fullName: "Owner Student",
    },
    select: { id: true },
  });
  const memberRow = await db.user.create({
    data: {
      ...baseUser,
      universityId,
      email: `member-${suffix}@ct-${suffix}.edu.ng`,
      username: `member${suffix}`.slice(0, 30),
      fullName: "Member Student",
    },
    select: { id: true },
  });
  const requesterRow = await db.user.create({
    data: {
      ...baseUser,
      universityId,
      email: `requester-${suffix}@ct-${suffix}.edu.ng`,
      username: `requester${suffix}`.slice(0, 30),
      fullName: "Requester Student",
    },
    select: { id: true },
  });
  owner = viewer({ id: ownerRow.id, universityId, username: `owner${suffix}`, departmentId: department.id });
  member = viewer({ id: memberRow.id, universityId, username: `member${suffix}`, departmentId: department.id });
  requester = viewer({ id: requesterRow.id, universityId, username: `requester${suffix}`, departmentId: department.id });

  const otherDb = tenantDb(outsiderUniversityId);
  const otherDepartment = await otherDb.academicNode.create({
    data: {
      universityId: outsiderUniversityId,
      type: "DEPARTMENT",
      name: "Software Engineering",
      slug: `swe-other-${suffix}`,
      levels: [100, 200, 300],
    },
    select: { id: true },
  });
  const otherUser = await otherDb.user.create({
    data: {
      ...baseUser,
      universityId: outsiderUniversityId,
      email: `outsider-${suffix}@co-${suffix}.edu.ng`,
      username: `outsider${suffix}`.slice(0, 30),
      fullName: "Outsider Student",
      departmentNodeId: otherDepartment.id,
    },
    select: { id: true },
  });
  outsider = viewer({
    id: otherUser.id,
    universityId: outsiderUniversityId,
    username: `outsider${suffix}`,
    departmentId: otherDepartment.id,
  });
});

afterAll(async () => {
  await platformDb.$disconnect();
});

describe("community service", () => {
  it("creates a community with exactly one owner and blocks reserved names", async () => {
    const created = await createCommunity({
      viewer: owner,
      name: `Study Circle ${suffix}`,
      description: "A community for focused study sessions and shared notes.",
      category: "ACADEMIC",
      privacy: "PUBLIC",
      rules: [{ title: "Be kind", body: "Disagree with ideas, never attack people." }],
    });
    const db = tenantDb(universityId);
    const members = await db.communityMember.findMany({
      where: { communityId: created.id },
      select: { role: true, userId: true },
    });
    expect(members).toHaveLength(1);
    expect(members[0]).toMatchObject({ role: "OWNER", userId: owner.userId });

    await expect(
      createCommunity({
        viewer: member,
        name: `${universityName} Official`,
        description: "Trying to reserve an official name should fail.",
        category: "OTHER",
        privacy: "PUBLIC",
      }),
    ).rejects.toThrow(/reserved|official|university/i);
  });

  it("keeps invite-only communities out of discovery for outsiders", async () => {
    const created = await createCommunity({
      viewer: owner,
      name: `Private Circle ${suffix}`,
      description: "Only members with an invite should ever see this community.",
      category: "HOBBY",
      privacy: "INVITE_ONLY",
    });
    const discovery = await listDiscoverCommunities(member);
    expect(discovery.communities.some((community) => community.id === created.id)).toBe(false);
    const outsiderDiscovery = await listDiscoverCommunities(outsider);
    expect(outsiderDiscovery.communities.some((community) => community.id === created.id)).toBe(false);
  });

  it("keeps request joins pending until a moderator approves them", async () => {
    const created = await createCommunity({
      viewer: owner,
      name: `Request Circle ${suffix}`,
      description: "Request-only community for testing approval and membership counts.",
      category: "TECH",
      privacy: "REQUEST",
    });
    await expect(joinCommunity(requester, created.id, "Please let me in.")).resolves.toEqual({ state: "REQUESTED" });
    await expect(joinCommunity(requester, created.id)).resolves.toEqual({ state: "REQUESTED" });
    const db = tenantDb(universityId);
    expect(await db.communityMember.count({ where: { communityId: created.id, status: "ACTIVE" } })).toBe(1);
    await expect(listJoinRequests(member, created.id)).rejects.toThrow(/permission/i);

    const requests = await listJoinRequests(owner, created.id);
    expect(requests).toHaveLength(1);
    await decideJoinRequest(owner, created.id, requests[0]!.id, "APPROVE");
    const community = await db.community.findUnique({ where: { id: created.id }, select: { memberCount: true } });
    expect(community?.memberCount).toBe(2);
    const approveList = await listJoinRequests(owner, created.id);
    expect(approveList).toHaveLength(0);
    const members = await listCommunityMembers(owner, created.id);
    expect(members.some((row) => row.userId === requester.userId && row.role === "MEMBER")).toBe(true);
  });

  it("transfers ownership and protects the last owner from leaving", async () => {
    const created = await createCommunity({
      viewer: member,
      name: `Transfer Circle ${suffix}`,
      description: "A community used to exercise ownership transfer rules safely.",
      category: "OTHER",
      privacy: "PUBLIC",
    });
    await joinCommunity(owner, created.id);
    await transferCommunityOwnership(member, created.id, owner.userId);
    const db = tenantDb(universityId);
    const roles = await db.communityMember.findMany({
      where: { communityId: created.id },
      select: { userId: true, role: true },
    });
    expect(roles.find((row) => row.userId === owner.userId)?.role).toBe("OWNER");
    expect(roles.find((row) => row.userId === member.userId)?.role).toBe("MODERATOR");

    await leaveCommunity(member, created.id);
    await expect(leaveCommunity(owner, created.id)).rejects.toThrow(/transfer ownership/i);
    const active = await db.communityMember.count({ where: { communityId: created.id, status: "ACTIVE" } });
    expect(active).toBe(1);
  });

  it("the database refuses to remove the last owner even outside the service", async () => {
    const created = await createCommunity({
      viewer: requester,
      name: `Trigger Circle ${suffix}`,
      description: "A community used to prove the database-level owner guard.",
      category: "OTHER",
      privacy: "PUBLIC",
    });
    await expect(
      tenantDb(universityId).communityMember.updateMany({
        where: { communityId: created.id, userId: requester.userId },
        data: { role: "MEMBER" },
      }),
    ).rejects.toThrow(/at least one owner/i);
  });

  it("never exposes another university's communities through the tenant client", async () => {
    const created = await createCommunity({
      viewer: outsider,
      name: `Other Campus ${suffix}`,
      description: "This community belongs to a different university entirely.",
      category: "OTHER",
      privacy: "PUBLIC",
    });
    const crossRead = await tenantDb(universityId).community.findUnique({ where: { id: created.id } });
    expect(crossRead).toBeNull();
    const ownRead = await tenantDb(outsiderUniversityId).community.findUnique({ where: { id: created.id } });
    expect(ownRead?.id).toBe(created.id);
  });
});
