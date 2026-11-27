/**
 * Phase 2 community seed. Non-production only; seed.ts gates this module with
 * assertSeedAllowed(). It creates a realistic mix of public, request and
 * invite-only communities, with owners, moderators, rules and a few posts.
 */
import type { PrismaClient } from "@prisma/client";

interface CommunitySeed {
  name: string;
  description: string;
  category:
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
  privacy: "PUBLIC" | "REQUEST" | "INVITE_ONLY";
  official?: boolean;
}

const COMMUNITIES: CommunitySeed[] = [
  { name: "Software Engineering Hub", description: "Projects, past questions and honest advice for Software Engineering students across every level.", category: "ACADEMIC", privacy: "PUBLIC" },
  { name: "CSC 204 Study Circle", description: "A focused study circle for algorithms and data structures. Share notes, ask questions, revise together.", category: "ACADEMIC", privacy: "PUBLIC" },
  { name: "Engineering Innovators", description: "Student builders across every engineering department. Demos, hackathons and maker sessions.", category: "TECH", privacy: "PUBLIC", official: true },
  { name: "Nova Tech Community", description: "The student tech community on campus: product, code, design and everything in between.", category: "TECH", privacy: "PUBLIC", official: true },
  { name: "Design and Product Crew", description: "UI/UX, product thinking and portfolio reviews for students who want to build useful things.", category: "ARTS", privacy: "REQUEST" },
  { name: "Inter-Faculty Football", description: "Fixtures, results, trials and match-day conversation for the campus football league.", category: "SPORTS", privacy: "PUBLIC" },
  { name: "Nova Basketball Court", description: "Pickup games, varsity trials and training schedules. All skill levels welcome.", category: "SPORTS", privacy: "PUBLIC" },
  { name: "Track and Field Team", description: "Training plans, meet announcements and support for Nova's track and field athletes.", category: "SPORTS", privacy: "REQUEST" },
  { name: "Moremi Hall Community", description: "Everything Moremi Hall: maintenance updates, hostel events and finding a study partner.", category: "HOSTEL", privacy: "PUBLIC" },
  { name: "Amina Hostel Neighbours", description: "A quiet, useful space for Amina Hostel residents to share notices and look out for each other.", category: "HOSTEL", privacy: "REQUEST" },
  { name: "Law Students Society", description: "Moot court, tutorials, internship leads and the weekly law review circle.", category: "ACADEMIC", privacy: "PUBLIC", official: true },
  { name: "Medicine Study Group", description: "Clinical years and pre-clinical revision. Share cases, diagrams and study schedules.", category: "ACADEMIC", privacy: "REQUEST" },
  { name: "Mass Comm Creatives", description: "Reporting, photography, film and campus storytelling. Bring your rough cuts.", category: "ARTS", privacy: "PUBLIC" },
  { name: "Accounting Tutorials", description: "Past papers, worked solutions and calm explanations for tricky accounting topics.", category: "ACADEMIC", privacy: "PUBLIC" },
  { name: "Nova Entrepreneurship Club", description: "Founders, side projects and startup clinic nights. Build with people who ship.", category: "BUSINESS", privacy: "PUBLIC" },
  { name: "Campus Investors", description: "Personal finance, investing basics and a no-hype space to learn together.", category: "BUSINESS", privacy: "REQUEST" },
  { name: "Nova Music Collective", description: "Rehearsals, gigs, production tips and finding bandmates across campus.", category: "ARTS", privacy: "PUBLIC" },
  { name: "Film and Photography", description: "Photo walks, film screenings and honest feedback on student work.", category: "ARTS", privacy: "PUBLIC" },
  { name: "Faith Fellowship", description: "Midweek fellowship, prayer requests and community service updates.", category: "FAITH", privacy: "PUBLIC" },
  { name: "Muslim Students Circle", description: "Weekly halaqa, prayer notices and support for Muslim students on campus.", category: "FAITH", privacy: "PUBLIC" },
  { name: "Gaming and Esports", description: "Campus tournaments, game nights and a place to find a squad.", category: "HOBBY", privacy: "PUBLIC" },
  { name: "Book and Film Club", description: "One book, one film, one honest conversation each month.", category: "HOBBY", privacy: "REQUEST" },
  { name: "Chess Club", description: "Casual boards, campus ladder and tournament practice. Beginners welcome.", category: "HOBBY", privacy: "PUBLIC" },
  { name: "Architecture Studio", description: "Critique sessions, model-making nights and A2 plotting advice.", category: "ACADEMIC", privacy: "PUBLIC" },
  { name: "Campus Architecture Society", description: "Association updates, site visits and the annual exhibition.", category: "ASSOCIATION", privacy: "REQUEST", official: true },
  { name: "Student Union Notices", description: "Official SUG updates, meetings and decisions in one verified place.", category: "ASSOCIATION", privacy: "PUBLIC", official: true },
  { name: "Class of 2028", description: "A home for the incoming class: meet classmates, share questions, plan meetups.", category: "ASSOCIATION", privacy: "PUBLIC" },
  { name: "Scholarship Board", description: "Verified scholarship opportunities, deadlines and application tips.", category: "ACADEMIC", privacy: "PUBLIC" },
  { name: "Nova Creators", description: "A private circle for writers, filmmakers and artists who want focused feedback before sharing broadly.", category: "ARTS", privacy: "INVITE_ONLY" },
  { name: "Senate House Residents", description: "Private community for Senate House residents. Notices, keys and quiet-hours conversations.", category: "HOSTEL", privacy: "INVITE_ONLY" },
];

const POSTS = [
  "Welcome to the community! Introduce yourself below and tell us what you want to get out of this space.",
  "Sharing a quick update from today's meeting — add anything I missed in the replies.",
  "Anyone free to meet on the library third floor this week? Bring whatever you're currently working on.",
  "Found a really useful resource for this topic. Check the Resources tab when you get a chance.",
];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export async function seedCommunities(
  db: PrismaClient,
  context: { universityId: string; moderatorId: string; demoAuthors: Array<{ id: string }> },
): Promise<void> {
  const existing = await db.community.count({ where: { universityId: context.universityId } });
  if (existing > 0) {
    console.log(`Communities already seeded (${existing}); leaving them untouched.`);
    return;
  }
  const users = await db.user.findMany({
    where: { universityId: context.universityId, status: "VERIFIED", departmentNodeId: { not: null } },
    orderBy: { createdAt: "asc" },
    select: { id: true, fullName: true },
  });
  if (users.length === 0) return;
  const owners = [...new Set([...context.demoAuthors.map((author) => author.id), ...users.map((user) => user.id)])];
  const now = Date.now();

  for (const [index, seed] of COMMUNITIES.entries()) {
    const ownerId = owners[index % owners.length]!;
    const memberPool = users
      .filter((user) => user.id !== ownerId)
      .slice(index % 8, (index % 8) + Math.min(18, users.length - 1));
    const moderators = memberPool.slice(0, 2).map((user) => user.id);
    const members = memberPool.slice(2);
    const postBodies = [POSTS[index % POSTS.length]!, POSTS[(index + 1) % POSTS.length]!];
    const createdAt = new Date(now - (index + 2) * 36 * 60 * 60 * 1000);
    const postAuthors = [ownerId, moderators[0] ?? members[0]?.id ?? ownerId];

    const community = await db.community.create({
      data: {
        universityId: context.universityId,
        name: seed.name,
        nameNormalized: normalize(seed.name),
        slug: slugify(seed.name),
        description: seed.description,
        category: seed.category,
        privacy: seed.privacy,
        isOfficial: seed.official === true,
        createdById: ownerId,
        memberCount: 1 + moderators.length + members.length,
        postCount: postBodies.length,
        lastActivityAt: new Date(now - (index % 7) * 60 * 60 * 1000),
        createdAt,
        allowMemberUploads: index % 3 === 0,
        rules: {
          create: [
            {
              universityId: context.universityId,
              position: 0,
              title: "Be kind",
              body: "Disagree with ideas, never attack people. Harassment gets removed.",
            },
            {
              universityId: context.universityId,
              position: 1,
              title: "Keep it relevant",
              body: "Post about this community's subject so the feed stays useful.",
            },
            {
              universityId: context.universityId,
              position: 2,
              title: "Protect privacy",
              body: "Do not post someone's private details, ID or contact information.",
            },
          ],
        },
      },
      select: { id: true, slug: true },
    });

    await db.communityMember.create({
      data: {
        universityId: context.universityId,
        communityId: community.id,
        userId: ownerId,
        role: "OWNER",
        joinedAt: createdAt,
        lastSeenAt: createdAt,
      },
    });
    if (moderators.length + members.length > 0) {
      await db.communityMember.createMany({
        data: [
          ...moderators.map((id) => ({
            universityId: context.universityId,
            communityId: community.id,
            userId: id,
            role: "MODERATOR" as const,
            joinedAt: new Date(createdAt.getTime() + 60 * 60 * 1000),
          })),
          ...members.map((member) => ({
            universityId: context.universityId,
            communityId: community.id,
            userId: member.id,
            role: "MEMBER" as const,
            joinedAt: new Date(createdAt.getTime() + 2 * 60 * 60 * 1000),
          })),
        ],
        skipDuplicates: true,
      });
    }

    for (const [postIndex, body] of postBodies.entries()) {
      await db.post.create({
        data: {
          universityId: context.universityId,
          authorId: postAuthors[postIndex] ?? ownerId,
          type: "POST",
          body,
          audienceKind: "COMMUNITY",
          audiencePath: [],
          communityId: community.id,
          reactionCount: (index * 3 + postIndex * 5) % 24,
          commentCount: (index + postIndex) % 5,
          createdAt: new Date(createdAt.getTime() + (postIndex + 1) * 30 * 60 * 1000),
          rankAt: new Date(createdAt.getTime() + (postIndex + 1) * 30 * 60 * 1000),
        },
      });
    }

    if (seed.privacy === "REQUEST" && users.length > memberPool.length + 2) {
      const requester = users[(index + memberPool.length + 2) % users.length]!;
      if (requester.id !== ownerId) {
        await db.joinRequest.create({
          data: {
            universityId: context.universityId,
            communityId: community.id,
            userId: requester.id,
            message: "I'd like to join and contribute to the study sessions.",
          },
        });
      }
    }

    if (!seed.official && index % 9 === 0) {
      await db.communityOfficialRequest.create({
        data: {
          universityId: context.universityId,
          communityId: community.id,
          requestedById: ownerId,
          note: "This group already coordinates official activities with the faculty and would like verified official status.",
        },
      });
    }
  }

  const icons = ["/seed/tech-summit.svg", "/seed/engineering-lab.svg", "/seed/design-workshop.svg", "/seed/study-group.svg"];
  const banners = ["/seed/campus-facade.svg", "/seed/lecture-hall.svg", "/seed/hostel-courtyard.svg", "/seed/football-pitch.svg"];
  const seededCommunities = await db.community.findMany({
    where: { universityId: context.universityId },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  for (const [index, community] of seededCommunities.entries()) {
    await db.community.update({
      where: { id: community.id },
      data: {
        iconPublicId: icons[index % icons.length]!,
        bannerPublicId: banners[index % banners.length]!,
      },
    });
  }

  await db.auditLog.create({
    data: {
      actorId: context.moderatorId,
      universityId: context.universityId,
      action: "seed.communities",
      targetType: "University",
      targetId: context.universityId,
      metadata: { communities: COMMUNITIES.length },
    },
  });
  console.log(`Seeded ${COMMUNITIES.length} communities`);
}
