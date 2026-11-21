/**
 * Phase 1 Nova University campus seed: 50+ realistic Nigerian students, campus posts
 * across every audience kind, multi-image galleries using /seed/*.svg, polls,
 * questions with accepted answers, reposts, hashtags, reports and moderation history.
 * Non-production only — seed.ts calls assertSeedAllowed() before importing this module.
 */
import type { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";

export interface DemoAuthor {
  id: string;
  fullName: string;
  username: string;
  deptKey: string;
  level: number;
}

interface SeedContext {
  universityId: string;
  nodeIds: Map<string, string>;
  passwordHash: string;
  demoAuthors: DemoAuthor[];
  moderatorId: string;
}

const NAMES = [
  "Amaka Obi", "Femi Balogun", "Zainab Sule", "Halima Abubakar", "Segun Ojo",
  "Chiamaka Uche", "Yusuf Danjuma", "Blessing Etim", "Kelechi Nnamdi", "Fatima Bello",
  "Dapo Adebayo", "Ifeoma Nwafor", "Sadiq Lawal", "Teniola Ajayi", "Uche Okeke",
  "Maryam Garba", "Bode Oladipo", "Adanna Ibe", "Suleiman Bako", "Temi Ogunleye",
  "Chidi Onuoha", "Rukayat Yusuf", "Nonso Anyanwu", "Yemi Adewale", "Hauwa Ibrahim",
  "Kunle Adeleke", "Chinwe Opara", "Abubakar Sani", "Damilola Osho", "Ebele Okonkwo",
  "Aminu Waziri", "Obinna Ilo", "Safiya Ahmad", "Gbenga Ogunbiyi", "Nneka Chukwu",
  "Musa Abdullahi", "Tola Akinyemi", "Ifeanyi Orji", "Zara Mohammed", "Ade Coker",
  "Chioma Nwankwo", "Kolawole Balogun", "Simi Adekunle", "Umar Farooq", "Chidinma Oko",
];

const DEPARTMENTS = [
  { key: "dept-swe", levels: [100, 200, 300, 400, 500] },
  { key: "dept-mech", levels: [100, 200, 300, 400, 500] },
  { key: "dept-arch", levels: [100, 200, 300, 400, 500] },
  { key: "dept-law", levels: [100, 200, 300, 400, 500] },
  { key: "dept-medicine", levels: [100, 200, 300, 400, 500, 600] },
  { key: "dept-masscomm", levels: [100, 200, 300, 400] },
  { key: "dept-accounting", levels: [100, 200, 300, 400] },
];

const LINEAGE: Record<string, { college: string; faculty: string }> = {
  "dept-swe": { college: "college-engineering", faculty: "faculty-computing" },
  "dept-mech": { college: "college-engineering", faculty: "faculty-computing" },
  "dept-arch": { college: "college-engineering", faculty: "faculty-computing" },
  "dept-law": { college: "college-law", faculty: "faculty-law" },
  "dept-medicine": { college: "college-medicine", faculty: "faculty-clinical" },
  "dept-masscomm": { college: "college-management", faculty: "faculty-social" },
  "dept-accounting": { college: "college-management", faculty: "faculty-social" },
};

const SEED_VECTOR_IMAGES = [
  { publicId: "seed:campus-facade", url: "/seed/campus-facade.svg", width: 960, height: 540, alt: "Nova University main campus building" },
  { publicId: "seed:tech-summit", url: "/seed/tech-summit.svg", width: 960, height: 540, alt: "TechSummit 2026 auditorium stage" },
  { publicId: "seed:university-library", url: "/seed/university-library.svg", width: 960, height: 540, alt: "Bright university reading library" },
  { publicId: "seed:engineering-lab", url: "/seed/engineering-lab.svg", width: 960, height: 540, alt: "Software engineering workshop lab" },
  { publicId: "seed:football-pitch", url: "/seed/football-pitch.svg", width: 960, height: 540, alt: "Nova University stadium football pitch" },
  { publicId: "seed:lecture-hall", url: "/seed/lecture-hall.svg", width: 960, height: 540, alt: "Tiered lecture hall amphitheatre" },
  { publicId: "seed:hostel-courtyard", url: "/seed/hostel-courtyard.svg", width: 960, height: 540, alt: "Campus hostel courtyard walkways" },
  { publicId: "seed:study-group", url: "/seed/study-group.svg", width: 960, height: 540, alt: "Students collaborating at a study table" },
  { publicId: "seed:design-workshop", url: "/seed/design-workshop.svg", width: 960, height: 540, alt: "Design thinking sticky-note board" },
  { publicId: "seed:campus-quad", url: "/seed/campus-quad.svg", width: 960, height: 540, alt: "Green campus quad and clocktower" },
];

const POST_BODIES = [
  "Our demo day went better than expected. Thanks to everyone who showed up and tested our campus prototype—the feedback was genuinely useful.",
  "Just wrapped the Engineering Innovation Track at TechSummit! Huge thank-you to the speakers and volunteers who kept the livestream running smoothly.",
  "Reminder: CSC 204 lab submission closes on Friday at 6:00 PM. If you're still stuck on the tree traversal task, let's meet on the 3rd floor of the library.",
  "Water pump at Moremi Hall Block B has been fixed finally! Quick appreciation post for the hostel maintenance crew for sorting it before morning lectures.",
  "Inter-faculty football finals kick off at 4:00 PM today at the Main Bowl. Engineering vs Law is going to be electric—come early for front seats.",
  "New quiet study booths on the library top floor are actually quiet this semester, plus every desk has working sockets.",
  "Morning shuttle queue at the main gate was ten minutes long today, so give yourself extra time before 8:00 AM tutorials.",
  "Law Society moot court auditions open on Monday. Open to 100L–400L students who want public speaking practice.",
  "Design & Product Workshop holds this Thursday by 2:00 PM in Architecture Studio 2. Bring a sketchbook or laptop—Figma templates will be shared.",
  "A small reminder that good lecture notes are better shared than hoarded. Upload summary PDFs to the class drive so everyone can prep.",
  "Does anyone know whether the medical centre runs blood group and genotype checks on Saturdays without a prior booking?",
  "The sun finally cooled down across the campus quad this evening. Best time for a walk after marathon lab sessions.",
  "This semester taught me a real lesson: reading slides three days before exams is never equal to building one clean mini-project every weekend. For everyone in Software Engineering 200L and 300L juggling algorithms, database design, and internship interviews, try doing two focused 45-minute blocks right after lunch in the quiet wing before heading back to the hostel.",
];

const QUESTIONS = [
  "Does anyone have the CSC 204 past questions from 2023 and 2024?",
  "What is the best textbook for Engineering Thermodynamics 2?",
  "Can a 200L student audit the UI/UX design elective?",
  "Where do we submit the signed SIWES placement letter?",
  "Does the main university library open on Sundays during exam weeks?",
  "Anyone forming an accountability group for Law of Contract revision?",
  "Which print shop near the Faculty of Engineering does A2 architecture plots clearly?",
  "How early do we need to arrive at Amphitheatre A before 8:00 AM GST?",
];

const POLLS: Array<{ question: string; options: string[] }> = [
  { question: "Best place to study at night on campus?", options: ["University Library", "Engineering Reading Room", "Hostel Common Room", "Senate Quad Cafe"] },
  { question: "Which event should headline Engineering Week?", options: ["Hackathon", "Inter-dept Football Final", "Tech Career Panel", "Game & Grill Night"] },
  { question: "Preferred time for our weekend CSC 204 study session?", options: ["Saturday 10:00 AM", "Saturday 4:00 PM", "Sunday 3:00 PM", "Online Sunday 8:00 PM"] },
  { question: "How do you survive 8:00 AM lectures?", options: ["Sleep before midnight", "Hot tea from canteen", "Walk with course mates", "Hope slides go up early"] },
];

const COMMENTS = [
  "This helped so much! Just downloaded the folder and started question 3.",
  "Count me in for the 5pm library revision session.",
  "Confirmed—the 3rd floor sockets are working today!",
  "Thanks for sharing early before everyone panicked.",
  "Engineering taking that trophy home 2-0 today, watch.",
  "Course rep dropped the updated PDF in the announcements thread too.",
  "I have the handwritten worked solutions—replying here so anyone can grab them.",
];

const HASHTAGS = [
  "TechSummit", "csc204", "NovaCampus", "exams", "hostel", "football",
  "library", "design", "engineering", "law", "scholarship", "startup",
];

function makeRandom(seedValue = 20261119) {
  let seed = seedValue >>> 0;
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

function pick<T>(random: () => number, list: readonly T[]): T {
  return list[Math.floor(random() * list.length)] as T;
}

const AUDIENCE_BOOST: Record<string, number> = { PUBLIC: 0, COLLEGE: 10, FACULTY: 20, DEPARTMENT: 30, LEVEL: 40 };

function rankedAt(createdAt: Date, kind: string): Date {
  return new Date(createdAt.getTime() + (AUDIENCE_BOOST[kind] ?? 0) * 60_000);
}

export async function seedSocialContent(db: PrismaClient, context: SeedContext): Promise<void> {
  const random = makeRandom();

  const existing = await db.post.count({ where: { universityId: context.universityId } });
  if (existing > 100) {
    console.log(`Nova social seed already present (${existing} posts); leaving it untouched.`);
    return;
  }

  const generated: DemoAuthor[] = [];
  for (let index = 0; index < NAMES.length; index += 1) {
    const department = DEPARTMENTS[index % DEPARTMENTS.length]!;
    const level = department.levels[index % department.levels.length]!;
    const name = NAMES[index]!;
    const email = `seed.student${index + 1}@nova.edu.ng`;
    const username = `nova_${name.split(" ")[0]!.toLowerCase()}_${index + 1}`;
    const existingUser = await db.user.findFirst({ where: { email }, select: { id: true } });
    const user =
      existingUser ??
      (await db.user.create({
        data: {
          universityId: context.universityId,
          email,
          emailVerified: true,
          username,
          passwordHash: context.passwordHash,
          fullName: name,
          status: "VERIFIED",
          departmentNodeId: context.nodeIds.get(department.key)!,
          level,
          interests: ["Coding", "Campus", "Music"],
          consentPolicyVersion: "2026-01-01",
          consentAcceptedAt: new Date(),
          verifiedAt: new Date(),
          bio: index % 4 === 0 ? `${level}L Nova University student.` : null,
        },
        select: { id: true },
      }));
    generated.push({ id: user.id, fullName: name, username, deptKey: department.key, level });
  }
  const authors = [...context.demoAuthors, ...generated];
  const now = Date.now();
  const audienceKinds = ["PUBLIC", "PUBLIC", "PUBLIC", "COLLEGE", "FACULTY", "DEPARTMENT", "DEPARTMENT", "LEVEL"] as const;

  function pathFor(author: DemoAuthor, kind: string): string[] {
    const lineage = LINEAGE[author.deptKey]!;
    const collegeId = context.nodeIds.get(lineage.college)!;
    const facultyId = context.nodeIds.get(lineage.faculty)!;
    const deptId = context.nodeIds.get(author.deptKey)!;
    const full = [context.universityId, collegeId, facultyId, deptId, String(author.level)];
    if (kind === "PUBLIC") return ["PUBLIC"];
    if (kind === "COLLEGE") return [context.universityId, collegeId];
    if (kind === "FACULTY") return [context.universityId, collegeId, facultyId];
    if (kind === "DEPARTMENT") return [context.universityId, collegeId, facultyId, deptId];
    return full;
  }

  function dateWithin(days: number): Date {
    return new Date(now - Math.floor(random() * days * 24 * 60 * 60 * 1000));
  }

  const postIds: string[] = [];
  const plain: Array<Record<string, unknown>> = [];
  const seededPosts: Array<{ id: string; authorId: string; kind: (typeof audienceKinds)[number]; tag: string; createdAt: Date }> = [];

  for (let index = 0; index < 320; index += 1) {
    const author = pick(random, authors);
    const kind = pick(random, audienceKinds);
    const tag = pick(random, HASHTAGS);
    const createdAt = dateWithin(12);
    const body = `${POST_BODIES[index % POST_BODIES.length]} #${tag}`;
    const id = randomUUID();
    postIds.push(id);
    seededPosts.push({ id, authorId: author.id, kind, tag, createdAt });
    plain.push({
      id,
      universityId: context.universityId,
      authorId: author.id,
      type: "POST",
      body,
      audiencePath: pathFor(author, kind),
      audienceKind: kind,
      status: "ACTIVE",
      createdAt,
      updatedAt: createdAt,
      rankAt: rankedAt(createdAt, kind),
    });
  }
  await db.post.createMany({ data: plain as never });

  // Questions with topic tags and accepted answers.
  const questionPosts: Array<{ id: string; authorId: string }> = [];
  for (let index = 0; index < 45; index += 1) {
    const author = pick(random, authors);
    const kind = pick(random, audienceKinds.filter((v) => v !== "PUBLIC"));
    const createdAt = dateWithin(10);
    const title = QUESTIONS[index % QUESTIONS.length]!;
    const tag = pick(random, HASHTAGS);
    const created = await db.post.create({
      data: {
        universityId: context.universityId,
        authorId: author.id,
        type: "QUESTION",
        body: `${POST_BODIES[index % POST_BODIES.length]}\n\n#${tag}`,
        questionTitle: title,
        topicTag: tag.toUpperCase(),
        audiencePath: pathFor(author, kind),
        audienceKind: kind,
        status: "ACTIVE",
        createdAt,
        updatedAt: createdAt,
        rankAt: rankedAt(createdAt, kind),
      },
      select: { id: true },
    });
    questionPosts.push({ id: created.id, authorId: author.id });
    postIds.push(created.id);
    seededPosts.push({ id: created.id, authorId: author.id, kind, tag, createdAt });
  }

  // Polls.
  const polls: Array<{ postId: string; pollId: string; options: Array<{ id: string; index: number }> }> = [];
  for (let index = 0; index < 45; index += 1) {
    const author = pick(random, authors);
    const kind = pick(random, ["PUBLIC", "PUBLIC", "DEPARTMENT", "LEVEL", "COLLEGE"] as const);
    const createdAt = dateWithin(9);
    const source = POLLS[index % POLLS.length]!;
    const tag = pick(random, HASHTAGS);
    const created = await db.post.create({
      data: {
        universityId: context.universityId,
        authorId: author.id,
        type: "POLL",
        body: `${source.question} #${tag}`,
        audiencePath: pathFor(author, kind),
        audienceKind: kind,
        status: "ACTIVE",
        createdAt,
        updatedAt: createdAt,
        rankAt: rankedAt(createdAt, kind),
      },
      select: { id: true },
    });
    const poll = await db.poll.create({
      data: {
        universityId: context.universityId,
        postId: created.id,
        endsAt: new Date(now + Math.ceil(random() * 5) * 24 * 60 * 60 * 1000),
        options: {
          create: source.options.map((text, order) => ({ universityId: context.universityId, text, order })),
        },
      },
      select: { id: true, options: { select: { id: true, order: true } } },
    });
    polls.push({
      postId: created.id,
      pollId: poll.id,
      options: poll.options.map((option) => ({ id: option.id, index: option.order })),
    });
    postIds.push(created.id);
    seededPosts.push({ id: created.id, authorId: author.id, kind, tag, createdAt });
  }

  // Reposts.
  const repostData = [];
  for (let index = 0; index < 30; index += 1) {
    const original = pick(random, seededPosts.slice(0, 200));
    const author = pick(random, authors);
    const createdAt = dateWithin(5);
    const id = randomUUID();
    repostData.push({
      id,
      universityId: context.universityId,
      authorId: author.id,
      type: "REPOST",
      body: "",
      audiencePath:
        original.kind === "PUBLIC"
          ? ["PUBLIC"]
          : pathFor(authors.find((candidate) => candidate.id === original.authorId) ?? author, original.kind),
      audienceKind: original.kind,
      status: "ACTIVE",
      repostOfId: original.id,
      createdAt,
      updatedAt: createdAt,
      rankAt: rankedAt(createdAt, original.kind),
    });
    postIds.push(id);
  }
  await db.post.createMany({ data: repostData as never });

  // Attach 1, 2, 3, and 4 vector SVGs across recent posts so every MediaGrid layout renders in Pulse.
  const mediaRows: Array<Record<string, unknown>> = [];
  const counts = [1, 2, 3, 4, 5, 1, 2, 1, 4, 1, 2, 1];
  for (let idx = 0; idx < counts.length; idx += 1) {
    const postId = postIds[idx];
    if (!postId) continue;
    const numImages = counts[idx]!;
    for (let order = 0; order < numImages; order += 1) {
      const vec = SEED_VECTOR_IMAGES[(idx + order) % SEED_VECTOR_IMAGES.length]!;
      mediaRows.push({
        id: randomUUID(),
        universityId: context.universityId,
        postId,
        publicId: vec.publicId,
        url: vec.url,
        width: vec.width,
        height: vec.height,
        order,
        alt: vec.alt,
      });
    }
  }
  await db.postMedia.createMany({ data: mediaRows as never });

  // Hashtags.
  const hashtagIds = new Map<string, string>();
  for (const tag of HASHTAGS) {
    const hashtag = await db.hashtag.upsert({
      where: { universityId_tag: { universityId: context.universityId, tag: tag.toLowerCase() } },
      create: { universityId: context.universityId, tag: tag.toLowerCase() },
      update: {},
      select: { id: true },
    });
    hashtagIds.set(tag, hashtag.id);
  }
  await db.postHashtag.createMany({
    data: seededPosts.flatMap((post) => {
      const id = hashtagIds.get(post.tag);
      return id ? [{ id: randomUUID(), universityId: context.universityId, postId: post.id, hashtagId: id }] : [];
    }),
    skipDuplicates: true,
  });

  // Comments + replies + accepted answers.
  const commentData: Array<Record<string, unknown>> = [];
  const commentIds: string[] = [];
  for (let index = 0; index < 140; index += 1) {
    const post = pick(random, seededPosts);
    const author = pick(random, authors);
    const createdAt = new Date(Math.min(now, post.createdAt.getTime() + Math.ceil(random() * 48) * 3600_000));
    const id = randomUUID();
    commentIds.push(id);
    commentData.push({
      id,
      universityId: context.universityId,
      postId: post.id,
      authorId: author.id,
      body: pick(random, COMMENTS),
      status: "ACTIVE",
      createdAt,
      helpfulCount: Math.floor(random() * 40),
    });
  }
  for (let index = 0; index < 45; index += 1) {
    const parentId = pick(random, commentIds);
    const parent = commentData.find((row) => row.id === parentId) as { postId: string; createdAt: Date };
    const author = pick(random, authors);
    commentData.push({
      id: randomUUID(),
      universityId: context.universityId,
      postId: parent.postId,
      authorId: author.id,
      parentId,
      body: pick(random, COMMENTS),
      status: "ACTIVE",
      createdAt: new Date(Math.min(now, parent.createdAt.getTime() + 2 * 3600_000)),
      helpfulCount: Math.floor(random() * 12),
    });
  }
  const acceptedAnswers: Array<{ postId: string; commentId: string }> = [];
  for (const question of questionPosts.slice(0, 18)) {
    const id = randomUUID();
    commentData.push({
      id,
      universityId: context.universityId,
      postId: question.id,
      authorId: pick(random, authors.filter((author) => author.id !== question.authorId)).id,
      body: "Check the Software Engineering shared folder—past questions from 2022 to 2024 are uploaded with worked solutions.",
      status: "ACTIVE",
      helpfulCount: 14 + Math.floor(random() * 25),
      createdAt: dateWithin(4),
    });
    acceptedAnswers.push({ postId: question.id, commentId: id });
  }
  await db.comment.createMany({ data: commentData as never });

  // Reactions, bookmarks, votes.
  const reactionData = [];
  const bookmarkData = [];
  for (let index = 0; index < 700; index += 1) {
    reactionData.push({
      id: randomUUID(),
      universityId: context.universityId,
      userId: pick(random, authors).id,
      targetType: "POST",
      targetId: pick(random, postIds),
      createdAt: dateWithin(7),
    });
  }
  for (let index = 0; index < 180; index += 1) {
    bookmarkData.push({
      id: randomUUID(),
      universityId: context.universityId,
      userId: pick(random, authors).id,
      postId: pick(random, postIds),
      createdAt: dateWithin(7),
    });
  }
  await db.reaction.createMany({ data: reactionData as never, skipDuplicates: true });
  await db.bookmark.createMany({ data: bookmarkData as never, skipDuplicates: true });

  const voteData = [];
  for (const poll of polls) {
    const voters = new Set<string>();
    const count = 4 + Math.floor(random() * 10);
    for (let index = 0; index < count; index += 1) {
      const voter = pick(random, authors);
      if (voters.has(voter.id)) continue;
      voters.add(voter.id);
      const option = pick(random, poll.options);
      voteData.push({
        id: randomUUID(),
        universityId: context.universityId,
        pollId: poll.pollId,
        optionId: option.id,
        userId: voter.id,
        createdAt: dateWithin(4),
      });
    }
  }
  await db.pollVote.createMany({ data: voteData as never, skipDuplicates: true });

  await db.$executeRawUnsafe(
    `UPDATE "Post" p SET
      "commentCount" = COALESCE((SELECT COUNT(*) FROM "Comment" c WHERE c."postId" = p."id" AND c."status"::text = 'ACTIVE'), 0),
      "reactionCount" = COALESCE((SELECT COUNT(*) FROM "Reaction" r WHERE r."targetType"::text = 'POST' AND r."targetId" = p."id"), 0),
      "bookmarkCount" = COALESCE((SELECT COUNT(*) FROM "Bookmark" b WHERE b."postId" = p."id"), 0),
      "repostCount" = COALESCE((SELECT COUNT(*) FROM "Post" q WHERE q."repostOfId" = p."id" AND q."status"::text <> 'DELETED'), 0)`,
  );
  await db.$executeRawUnsafe(
    `UPDATE "PollOption" o SET "voteCount" = COALESCE((SELECT COUNT(*) FROM "PollVote" v WHERE v."optionId" = o."id"), 0)`,
  );
  for (const answer of acceptedAnswers) {
    await db.post.update({ where: { id: answer.postId }, data: { acceptedCommentId: answer.commentId } }).catch(() => undefined);
  }

  // Reports & moderation history.
  const reportTargets = postIds.slice(15, 24);
  const reasons = ["HARASSMENT", "SPAM", "HATE_OR_ABUSE", "FALSE_INFORMATION", "SOMETHING_ELSE", "VIOLENCE_OR_THREATS"] as const;
  for (let index = 0; index < reportTargets.length; index += 1) {
    await db.report
      .create({
        data: {
          universityId: context.universityId,
          reporterId: pick(random, authors).id,
          targetType: "POST",
          targetId: reportTargets[index]!,
          reason: reasons[index % reasons.length]!,
          details: index % 2 === 0 ? "Repeated promotional links posted across departmental feeds." : null,
        },
      })
      .catch(() => undefined);
  }

  const demo = context.demoAuthors[0]!;
  await db.mute
    .create({ data: { universityId: context.universityId, userId: demo.id, mutedUserId: generated[4]!.id } })
    .catch(() => undefined);
  await db.block
    .create({ data: { universityId: context.universityId, userId: demo.id, blockedUserId: generated[6]!.id } })
    .catch(() => undefined);
  await db.draft
    .create({
      data: {
        universityId: context.universityId,
        userId: demo.id,
        type: "POST",
        payload: { body: "Quick summary of the Software Engineering 300L testing seminar notes before Friday's quiz…" },
        audience: { id: `level:${context.nodeIds.get("dept-swe")}:300`, label: "My Level", kind: "LEVEL" },
      },
    })
    .catch(() => undefined);

  console.log("Seeded Nova University Phase 1 content", {
    students: authors.length,
    posts: postIds.length,
    questions: questionPosts.length,
    polls: polls.length,
  });
}
