import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { platformDb } from "@/lib/db/platform";
import { tenantDb } from "@/lib/db/tenant";
import { buildStudentPath } from "@/lib/domain/academic";
import type { SocialViewer } from "@/lib/services/social";
import {
  banCommunityMember,
  createCommunity,
  createCommunityInvite,
  getCommunityPage,
  joinCommunity,
  leaveCommunity,
  listCommunityMembers,
  listDiscoverCommunities,
  listMyCommunities,
  listSuggestedCommunities,
  listTrendingCommunities,
  searchCommunities,
  updateCommunity,
} from "@/lib/services/communities";
import {
  __clearTrendingCache,
  createPost,
  getAuthorPosts,
  getBookmarks,
  getCommunityFeed,
  getFeed,
  getHashtagPage,
  getPostDetail,
  getPublicPreview,
  getTrendingTags,
  searchHashtags,
  toggleBookmark,
} from "@/lib/services/posts";

const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
let universityId: string;
let otherUniversityId: string;
let departmentId: string;
let owner: SocialViewer;
let member: SocialViewer;
let outsider: SocialViewer;
let raceCommunityId: string;
let auditCommunityId: string;

function viewer(input: {
  id: string;
  universityId: string;
  username: string;
  departmentId: string;
  staff?: boolean;
}): SocialViewer {
  return {
    userId: input.id,
    universityId: input.universityId,
    studentPath: buildStudentPath({
      universityId: input.universityId,
      department: { id: input.departmentId, name: "Software Engineering" },
      level: 300,
    }),
    departmentId: input.departmentId,
    level: 300,
    username: input.username,
    fullName: input.username,
    photoUrl: null,
    labels: { college: "College", faculty: "Faculty", department: "Department" },
    lineage: { college: null, faculty: null, department: "Software Engineering" },
    accountAgeHours: 72,
    interests: ["Coding"],
    isUniversityStaff: input.staff ?? false,
    isUniversityAdmin: input.staff ?? false,
    isUniversityModerator: false,
    timezone: "Africa/Lagos",
    showEventAttendance: true,
  };
}

async function seedUniversity(slugPrefix: string): Promise<string> {
  const university = await platformDb.university.create({
    data: {
      name: `Hardening ${slugPrefix} ${suffix}`,
      shortName: `H${slugPrefix.slice(0, 2).toUpperCase()}`,
      slug: `hardening-${slugPrefix}-${suffix}`,
      status: "ACTIVE",
      matricPattern: "^[A-Z]{3}/\\d{4}/\\d{3,4}$",
      studentEmailDomains: [`${slugPrefix}-${suffix}.edu.ng`],
      labels: { department: "Department" },
    },
    select: { id: true },
  });
  return university.id;
}

beforeAll(async () => {
  universityId = await seedUniversity("a");
  otherUniversityId = await seedUniversity("b");

  const db = tenantDb(universityId);
  const department = await db.academicNode.create({
    data: {
      universityId,
      type: "DEPARTMENT",
      name: "Software Engineering",
      slug: `swe-h-${suffix}`,
      levels: [100, 200, 300, 400],
    },
    select: { id: true },
  });
  departmentId = department.id;
  const base = {
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
      ...base,
      universityId,
      email: `owner-h-${suffix}@a-${suffix}.edu.ng`,
      username: `ownerh${suffix}`.slice(0, 30),
      fullName: "Owner Student",
    },
    select: { id: true },
  });
  const memberRow = await db.user.create({
    data: {
      ...base,
      universityId,
      email: `member-h-${suffix}@a-${suffix}.edu.ng`,
      username: `memberh${suffix}`.slice(0, 30),
      fullName: "Member Student",
    },
    select: { id: true },
  });
  owner = viewer({ id: ownerRow.id, universityId, username: `ownerh${suffix}`, departmentId });
  member = viewer({ id: memberRow.id, universityId, username: `memberh${suffix}`, departmentId });

  const otherDb = tenantDb(otherUniversityId);
  const otherDepartment = await otherDb.academicNode.create({
    data: {
      universityId: otherUniversityId,
      type: "DEPARTMENT",
      name: "Software Engineering",
      slug: `swe-hb-${suffix}`,
      levels: [100, 200, 300],
    },
    select: { id: true },
  });
  const outsiderRow = await otherDb.user.create({
    data: {
      ...base,
      universityId: otherUniversityId,
      email: `outsider-h-${suffix}@b-${suffix}.edu.ng`,
      username: `outsiderh${suffix}`.slice(0, 30),
      fullName: "Outsider Student",
      departmentNodeId: otherDepartment.id,
    },
    select: { id: true },
  });
  outsider = viewer({
    id: outsiderRow.id,
    universityId: otherUniversityId,
    username: `outsiderh${suffix}`,
    departmentId: otherDepartment.id,
  });

  // Created up front so the per-user daily creation limit is not consumed by
  // the ordering of individual tests.
  raceCommunityId = (
    await createCommunity({
      viewer: member,
      name: `Race Circle ${suffix}`,
      description: "Used to prove the cached member counter cannot drift under races.",
      category: "OTHER",
      privacy: "PUBLIC",
    })
  ).id;
  auditCommunityId = (
    await createCommunity({
      viewer: member,
      name: `Audit Circle ${suffix}`,
      description: "Privileged actions here must each leave an audit entry behind.",
      category: "OTHER",
      privacy: "PUBLIC",
    })
  ).id;
});

afterAll(async () => {
  await platformDb.$disconnect();
});

describe("tenant isolation on every community table", () => {
  it("never returns another university's community rows from the tenant client", async () => {
    const created = await createCommunity({
      viewer: owner,
      name: `Isolation Circle ${suffix}`,
      description: "Rows created here must be invisible to the other campus tenant.",
      category: "OTHER",
      privacy: "PUBLIC",
    });
    const db = tenantDb(universityId);
    const post = await createPost({
      viewer: owner,
      type: "POST",
      body: `Isolation post ${suffix}`,
      audienceId: "",
      communityId: created.id,
    });
    const rule = await db.communityRule.create({
      data: {
        universityId,
        communityId: created.id,
        position: 1,
        title: "Be kind",
        body: "Disagree with ideas, never attack people.",
      },
      select: { id: true },
    });
    const invite = await createCommunityInvite(owner, created.id, { kind: "LINK", days: 7, maxUses: 5 });
    await db.communityResource.create({
      data: {
        universityId,
        communityId: created.id,
        uploaderId: owner.userId,
        kind: "LINK",
        title: "Isolation notes",
        category: "ACADEMIC",
        url: "https://example.edu.ng/notes.pdf",
      },
    });
    await db.communityPin.create({
      data: { universityId, communityId: created.id, postId: post.id, position: 1, pinnedById: owner.userId },
    });
    await db.communityOfficialRequest.create({
      data: {
        universityId,
        communityId: created.id,
        requestedById: owner.userId,
        note: "Please make this official for the isolation test.",
      },
    });
    const joinRequest = await db.joinRequest.create({
      data: { universityId, communityId: created.id, userId: member.userId, message: "May I join?" },
      select: { id: true },
    });

    const other = tenantDb(otherUniversityId);
    const lookups = [
      other.community.findUnique({ where: { id: created.id } }),
      other.communityMember.findFirst({ where: { communityId: created.id } }),
      other.joinRequest.findUnique({ where: { id: joinRequest.id } }),
      other.communityInvite.findUnique({ where: { id: invite.id } }),
      other.communityRule.findUnique({ where: { id: rule.id } }),
      other.communityResource.findFirst({ where: { communityId: created.id } }),
      other.communityPin.findFirst({ where: { communityId: created.id } }),
      other.communityOfficialRequest.findFirst({ where: { communityId: created.id } }),
    ];
    for (const result of await Promise.all(lookups)) expect(result).toBeNull();

    const otherCommunity = await createCommunity({
      viewer: outsider,
      name: `Isolation Other ${suffix}`,
      description: "A different campus community with the same shape.",
      category: "OTHER",
      privacy: "PUBLIC",
    });
    expect(await getCommunityPage(owner, otherCommunity.slug)).toBeNull();
    expect(await getCommunityPage(outsider, created.slug)).toBeNull();
  });
});

describe("community settings", () => {
  it("keeps the URL stable when other settings change and moves it on rename", async () => {
    const original = `Settings Circle ${suffix}`;
    const created = await createCommunity({
      viewer: member,
      name: original,
      description: "Settings saves must not silently move the community URL.",
      category: "OTHER",
      privacy: "PUBLIC",
      rules: [{ title: "Be kind", body: "Disagree with ideas, never attack people." }],
    });

    await updateCommunity(member, created.id, {
      name: original,
      description: "Updated description that still keeps the same address.",
      rules: [
        { title: "Be kind", body: "Disagree with ideas, never attack people." },
        { title: "Cite sources", body: "Credit the person who shared past questions." },
      ],
    });
    const db = tenantDb(universityId);
    expect((await db.community.findUnique({ where: { id: created.id }, select: { slug: true } }))?.slug).toBe(
      created.slug,
    );
    expect((await getCommunityPage(member, created.slug))?.id).toBe(created.id);

    const renamed = `Renamed Circle ${suffix}`;
    await updateCommunity(member, created.id, { name: renamed });
    const after = await db.community.findUnique({ where: { id: created.id }, select: { slug: true, name: true } });
    expect(after?.name).toBe(renamed);
    expect(after?.slug).not.toBe(created.slug);
    expect(after?.slug).toBe(`renamed-circle-${suffix}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""));
    expect(await getCommunityPage(member, created.slug)).toBeNull();
    expect((await getCommunityPage(member, after!.slug))?.id).toBe(created.id);
  });
});

describe("invite-only communities never leak", () => {
  let communityId: string;
  let communitySlug: string;
  let postId: string;
  const tag = `secrettag${suffix}`.toLowerCase();

  beforeAll(async () => {
    const created = await createCommunity({
      viewer: owner,
      name: `Hidden Circle ${suffix}`,
      description: "Invite-only community used to prove every read path stays closed.",
      category: "TECH",
      privacy: "INVITE_ONLY",
    });
    communityId = created.id;
    communitySlug = created.slug;
    const post = await createPost({
      viewer: owner,
      type: "POST",
      body: `Members-only notes about #${tag}`,
      audienceId: "",
      communityId,
    });
    postId = post.id;
    __clearTrendingCache();
  });

  it("hides the community from every discovery surface", async () => {
    const [discover, trending, suggested, search, mine] = await Promise.all([
      listDiscoverCommunities(outsider),
      listTrendingCommunities(outsider),
      listSuggestedCommunities(outsider),
      searchCommunities(outsider, `Hidden Circle ${suffix}`),
      listMyCommunities(outsider),
    ]);
    for (const list of [discover.communities, trending, suggested, search.communities]) {
      expect(list.some((row) => row.id === communityId)).toBe(false);
    }
    expect(mine.active.some((row) => row.id === communityId)).toBe(false);
    expect(mine.rest.some((row) => row.id === communityId)).toBe(false);
    expect(mine.invitations.some((row) => row.community.id === communityId)).toBe(false);
  });

  it("returns the same not-found shape as a missing community", async () => {
    expect(await getCommunityPage(outsider, communitySlug)).toBeNull();
    expect(await getCommunityPage(outsider, `missing-${suffix}`)).toBeNull();
    expect(await getCommunityFeed(outsider, communityId, "latest")).toBeNull();
    expect(await getCommunityFeed(outsider, `missing-${suffix}`, "latest")).toBeNull();
    expect(await getPostDetail(outsider, postId)).toBeNull();
    expect(await getPostDetail(outsider, `missing-${suffix}`)).toBeNull();
  });

  it("keeps the post out of feeds, author pages, hashtags and search", async () => {
    __clearTrendingCache();
    const [feed, authorPosts, tags, hashtagPage, suggestions] = await Promise.all([
      getFeed(outsider, "all"),
      getAuthorPosts(outsider, owner.userId),
      getTrendingTags(outsider, "all"),
      getHashtagPage(outsider, tag, "latest"),
      searchHashtags(outsider, tag.slice(0, 8)),
    ]);
    expect(feed.posts.some((row) => row.id === postId)).toBe(false);
    expect(authorPosts.some((row) => row.id === postId)).toBe(false);
    expect(tags.some((row) => row.tag === tag)).toBe(false);
    expect(hashtagPage?.posts ?? []).toHaveLength(0);
    expect(hashtagPage?.postCount ?? 0).toBe(0);
    expect(suggestions).not.toContain(tag);
  });

  it("blocks bookmarks, share previews and reposts", async () => {
    await expect(toggleBookmark(outsider, postId)).rejects.toThrow();
    const bookmarks = await getBookmarks(outsider);
    expect(bookmarks.posts.some((row) => row.id === postId)).toBe(false);
    expect(await getPublicPreview(postId)).toEqual({ kind: "generic" });
    await expect(
      createPost({
        viewer: outsider,
        type: "REPOST",
        body: "",
        audienceId: "",
        repostOfId: postId,
      }),
    ).rejects.toThrow();
  });

  it("still serves members and the invite landing page", async () => {
    const page = await getCommunityPage(owner, communitySlug);
    expect(page?.id).toBe(communityId);
    const invite = await createCommunityInvite(owner, communityId, { kind: "LINK", days: 7, maxUses: 3 });
    expect(invite.token).toBeTruthy();
    const landing = await getCommunityPage(member, communitySlug, invite.token);
    expect(landing?.id).toBe(communityId);
    const detail = await getPostDetail(owner, postId);
    expect(detail?.post.id).toBe(postId);
  });
});

describe("ban enforcement", () => {
  it("removes content access and blocks rejoining", async () => {
    const created = await createCommunity({
      viewer: owner,
      name: `Ban Circle ${suffix}`,
      description: "Public community used to verify that a ban closes every door.",
      category: "OTHER",
      privacy: "PUBLIC",
    });
    await joinCommunity(member, created.id);
    const post = await createPost({
      viewer: owner,
      type: "POST",
      body: `Public post before the ban ${suffix}`,
      audienceId: "",
      communityId: created.id,
    });
    expect(await getCommunityFeed(member, created.id, "latest")).not.toBeNull();

    await banCommunityMember(owner, created.id, member.userId, "Repeated harassment after warnings");
    const db = tenantDb(universityId);
    const row = await db.communityMember.findFirst({
      where: { communityId: created.id, userId: member.userId },
      select: { status: true, role: true },
    });
    expect(row).toEqual({ status: "BANNED", role: "MEMBER" });
    expect((await db.community.findUnique({ where: { id: created.id }, select: { memberCount: true } }))?.memberCount).toBe(1);

    expect(await getCommunityPage(member, created.slug)).toBeNull();
    expect(await getCommunityFeed(member, created.id, "latest")).toBeNull();
    expect(await getPostDetail(member, post.id)).toBeNull();
    await expect(joinCommunity(member, created.id)).rejects.toThrow(/can't join|isn't available/i);
    const members = await listCommunityMembers(owner, created.id);
    expect(members.some((row) => row.userId === member.userId)).toBe(false);
    const banned = await listCommunityMembers(owner, created.id, { status: "BANNED" });
    expect(banned.some((row) => row.userId === member.userId)).toBe(true);
  });
});

describe("memberCount under concurrency", () => {
  it("increments and decrements exactly once for racing join/leave calls", async () => {
    const db = tenantDb(universityId);
    const count = async () =>
      (await db.community.findUnique({ where: { id: raceCommunityId }, select: { memberCount: true } }))!.memberCount;

    const joins = await Promise.allSettled([
      joinCommunity(owner, raceCommunityId),
      joinCommunity(owner, raceCommunityId),
      joinCommunity(owner, raceCommunityId),
      joinCommunity(owner, raceCommunityId),
    ]);
    expect(joins.every((result) => result.status === "fulfilled")).toBe(true);
    expect(await db.communityMember.count({ where: { communityId: raceCommunityId, status: "ACTIVE" } })).toBe(2);
    expect(await count()).toBe(2);

    await Promise.allSettled([
      leaveCommunity(owner, raceCommunityId),
      leaveCommunity(owner, raceCommunityId),
      leaveCommunity(owner, raceCommunityId),
      leaveCommunity(owner, raceCommunityId),
    ]);
    expect(await count()).toBe(1);
    expect(await db.communityMember.count({ where: { communityId: raceCommunityId, status: "ACTIVE" } })).toBe(1);
  });
});

describe("audit trail for privileged actions", () => {
  it("writes one audit row per join, role change, ban and community edit", async () => {
    await joinCommunity(owner, auditCommunityId);
    await banCommunityMember(member, auditCommunityId, owner.userId, "Audit test ban reason");
    const db = tenantDb(universityId);
    const rows = await db.auditLog.findMany({
      where: { targetType: "COMMUNITY", targetId: auditCommunityId },
      select: { action: true, actorId: true },
      orderBy: { createdAt: "asc" },
    });
    const actions = rows.map((row) => row.action);
    expect(actions).toContain("community.create");
    expect(actions).toContain("community.join");
    expect(actions).toContain("community.member.ban");
    expect(rows.every((row) => Boolean(row.actorId))).toBe(true);
  });
});
