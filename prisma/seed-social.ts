/**
 * Phase 1 demo campus: 48 students, 1,000 posts across every audience, plus
 * hashtags, comments, reactions, polls, questions, reports and strikes.
 * Non-production only — seed.ts calls the guard before importing this module.
 */
import type { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

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
  "Chinedu Okafor", "Aisha Bello", "Tunde Adeyemi", "Ngozi Eze", "Ibrahim Musa", "Amaka Obi",
  "Femi Balogun", "Zainab Sule", "Emeka Nwosu", "Halima Abubakar", "Segun Ojo", "Chiamaka Uche",
  "Yusuf Danjuma", "Blessing Etim", "Kelechi Nnamdi", "Fatima Bello", "Dapo Adebayo", "Ifeoma Nwafor",
  "Sadiq Lawal", "Teniola Ajayi", "Uche Okeke", "Maryam Garba", "Bode Oladipo", "Adanna Ibe",
  "Suleiman Bako", "Temi Ogunleye", "Chidi Onuoha", "Rukayat Yusuf", "Nonso Anyanwu", "Yemi Alade",
  "Hauwa Ibrahim", "Kunle Adeleke", "Chinwe Opara", "Abubakar Sani", "Damilola Osho", "Ebele Okonkwo",
  "Aminu Waziri", "Funke Awolowo", "Obinna Ilo", "Safiya Ahmad", "Gbenga Ogunbiyi", "Nneka Chukwu",
  "Musa Abdullahi", "Tola Akinyemi", "Ifeanyi Orji", "Zara Mohammed", "Ade Coker", "Chioma Nwankwo",
];

const DEPARTMENTS = [
  { key: "dept-computer", levels: [100, 200, 300, 400, 500] },
  { key: "dept-mathematics", levels: [100, 200, 300, 400] },
  { key: "dept-physics", levels: [100, 200, 300, 400] },
  { key: "dept-microbiology", levels: [100, 200, 300, 400] },
  { key: "dept-biochemistry", levels: [100, 200, 300, 400] },
  { key: "dept-english", levels: [100, 200, 300, 400] },
  { key: "dept-history", levels: [100, 200, 300, 400] },
  { key: "dept-economics", levels: [100, 200, 300, 400] },
  { key: "dept-masscomm", levels: [100, 200, 300, 400] },
  { key: "dept-law", levels: [100, 200, 300, 400, 500, 600] },
];

const LINEAGE: Record<string, { college: string; faculty: string }> = {
  "dept-computer": { college: "college-sciences", faculty: "faculty-physical" },
  "dept-mathematics": { college: "college-sciences", faculty: "faculty-physical" },
  "dept-physics": { college: "college-sciences", faculty: "faculty-physical" },
  "dept-microbiology": { college: "college-sciences", faculty: "faculty-biological" },
  "dept-biochemistry": { college: "college-sciences", faculty: "faculty-biological" },
  "dept-english": { college: "college-humanities", faculty: "faculty-arts" },
  "dept-history": { college: "college-humanities", faculty: "faculty-arts" },
  "dept-economics": { college: "college-humanities", faculty: "faculty-social" },
  "dept-masscomm": { college: "college-humanities", faculty: "faculty-social" },
  "dept-law": { college: "college-humanities", faculty: "faculty-social" },
};

const POST_BODIES = [
  "Our demo day went better than expected. Thanks to everyone who showed up, the feedback was genuinely useful.",
  "New study space at the library looks great. The quiet floor is finally quiet.",
  "Reminder: the Engineering Design Workshop holds tomorrow at 10:00 AM in the Central Lab. Don't forget your laptops.",
  "CSC 204 assignment submission closes on Friday. If you're stuck, let's form a quick study group this evening.",
  "Highlights from the campus tech summit: great talks, better conversations, and far too much jollof.",
  "I finally finished the group project. Learned more from the debugging than the lecture notes.",
  "The shuttle timetable changed this week. Check the notice board before you leave for the main gate.",
  "Departmental week is coming. Who's volunteering for the quiz team?",
  "The reading room is freezing today. Bring a jacket if you're planning a long session.",
  "Open mic night was unreal. Shoutout to everyone who performed.",
  "New deadline for the scholarship application: 30 November. The portal is finally working.",
  "If you're new to the faculty, the labs on the second floor are open until 7pm on weekdays.",
  "A small reminder that lecture notes are better shared than gatekept. Upload what you can.",
  "Our basketball team won by two points. The last minute was pure chaos.",
  "Does anyone know if the health centre still does free malaria tests this week?",
  "Just wrapped the Engineering Innovation Track. The AI in Engineering session was worth the early start.",
  "The library has new power outlets on the third floor. Small wins.",
  "Hostel allocation updates are out. Check your portal, not the group chat rumours.",
  "We need three more people for the departmental football team. Beginners welcome, banter mandatory.",
  "Coffee at the student union is half price before 9am. That's the whole post.",
  "Sharing my notes from today's seminar. They're rough but the diagrams are decent.",
  "The debate society meets every Thursday. Today's motion: campus wifi is a human right. It passed.",
  "A soft copy of the past questions is in the department drive. Please stop asking in five different groups.",
  "The new timetable is out and my first class moved to 7am. I am unwell.",
  "Reminder that the counselling centre is free and confidential. Taking care of yourself counts as productivity.",
];

const QUESTIONS = [
  "Does anyone have the CSC 204 past questions?",
  "Best way to prepare for the CSC 204 test?",
  "Where can I find the lab manual for Physics 102?",
  "Has anyone taken the advanced statistics elective?",
  "Which hostel is quietest for exam revision?",
  "How do I apply for the departmental scholarship?",
  "Does the faculty library open on Saturdays?",
  "Anyone know a good place to print A3 posters on campus?",
  "What's the attendance rule for the new semester?",
  "Can a 200 level student take a 300 level elective?",
  "Who is the course rep for Economics 204?",
  "Where do we submit the Biochemistry practical report?",
  "Is there a study group for Law of Contract?",
  "How early should we arrive for the moot court?",
  "Does the health centre provide vaccination records?",
];

const POLLS: Array<{ question: string; options: string[] }> = [
  { question: "Best place to study at night?", options: ["University Library", "Faculty Reading Room", "My Hostel", "The 24-hour cafe"] },
  { question: "What should the department do for week?", options: ["Quiz night", "Football match", "Movie screening", "Food fair"] },
  { question: "Which day works for the study group?", options: ["Tuesday", "Wednesday", "Thursday", "Saturday"] },
  { question: "Best way to survive 7am lectures?", options: ["Sleep early", "Coffee", "Recorded lectures", "Denial"] },
  { question: "Where should we hold the end-of-semester dinner?", options: ["Student union hall", "Amphitheatre", "Off-campus restaurant", "Someone's hostel"] },
  { question: "Most useful revision format?", options: ["Past questions", "Group discussion", "Flashcards", "Watching videos"] },
];

const COMMENTS = [
  "This is really helpful, thank you.",
  "I have them. Check your department drive — the folder is labelled CSC 204.",
  "Same question. Following this.",
  "The timetable changed again? Classic.",
  "I can send you what I have.",
  "Let's meet at the library at 5pm.",
  "This worked for me last semester.",
  "Not sure, but the course rep should know.",
  "Congratulations! That's a big win.",
  "Please share the link when you can.",
  "The second floor lab is usually free after 4pm.",
  "I'd also like to join the study group.",
  "Thanks for flagging this early.",
  "The portal has been down for me since morning.",
  "Good luck to everyone writing this week.",
];

const HASHTAGS = [
  "novatech", "csc204", "exams", "hostel", "football", "campus", "library", "scholarship",
  "design", "music", "startup", "engineering", "law", "health", "food", "innovation",
];

function makeRandom(seedValue = 20261117) {
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

async function makeSeedImages(): Promise<Array<{ publicId: string; url: string; width: number; height: number }>> {
  const dir = path.join(process.cwd(), "public", "uploads", "posts");
  await mkdir(dir, { recursive: true });
  const designs = [
    { bg: "#dcefe5", accent: "#147a57", title: "NOVA CAMPUS", sub: "Innovation open day" },
    { bg: "#e7e9fb", accent: "#4c4fc4", title: "TECH SUMMIT", sub: "2026 edition" },
    { bg: "#fdeede", accent: "#b35b13", title: "STUDY WEEK", sub: "Library, 3rd floor" },
  ];
  const images = [];
  for (let index = 0; index < designs.length; index += 1) {
    const design = designs[index]!;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="720">
      <rect width="1080" height="720" fill="${design.bg}"/>
      <rect x="60" y="60" width="960" height="600" rx="36" fill="#ffffff" stroke="${design.accent}" stroke-width="4"/>
      <circle cx="180" cy="210" r="64" fill="${design.accent}" opacity="0.2"/>
      <rect x="300" y="150" width="500" height="18" rx="9" fill="${design.accent}" opacity="0.55"/>
      <rect x="300" y="200" width="380" height="14" rx="7" fill="${design.accent}" opacity="0.3"/>
      <text x="60" y="380" font-family="sans-serif" font-size="72" font-weight="700" fill="${design.accent}">${design.title}</text>
      <text x="60" y="440" font-family="sans-serif" font-size="36" fill="#33413a">${design.sub}</text>
      <rect x="60" y="520" width="960" height="4" fill="${design.accent}" opacity="0.3"/>
      <text x="60" y="600" font-family="sans-serif" font-size="30" fill="#55645c">Verified students · Demo University</text>
    </svg>`;
    const buffer = await sharp(Buffer.from(svg)).webp({ quality: 78 }).toBuffer();
    const filename = `seed-campus-${index + 1}.webp`;
    await writeFile(path.join(dir, filename), buffer);
    images.push({ publicId: `local:posts/seed-campus-${index + 1}`, url: `/uploads/posts/${filename}`, width: 1080, height: 720 });
  }
  return images;
}

export async function seedSocialContent(db: PrismaClient, context: SeedContext): Promise<void> {
  const random = makeRandom();
  const existing = await db.post.count({ where: { universityId: context.universityId } });
  if (existing > 100) {
    console.log(`Social seed already present (${existing} posts); skipping.`);
    return;
  }

  // 48 additional students spread across levels, departments and colleges.
  const generated: DemoAuthor[] = [];
  for (let index = 0; index < NAMES.length; index += 1) {
    const department = DEPARTMENTS[index % DEPARTMENTS.length]!;
    const level = department.levels[index % department.levels.length]!;
    const name = NAMES[index]!;
    const email = `seed.student${index + 1}@demo.edu.ng`;
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
          interests: [],
          consentPolicyVersion: "2026-01-01",
          consentAcceptedAt: new Date(),
          verifiedAt: new Date(),
          bio: index % 5 === 0 ? `${level} level ${name.split(" ").slice(-1)[0]}. Around campus, mostly.` : null,
        },
        select: { id: true },
      }));
    generated.push({ id: user.id, fullName: name, username, deptKey: department.key, level });
  }
  const authors = [...context.demoAuthors, ...generated];

  const images = await makeSeedImages();
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

  for (let index = 0; index < 760; index += 1) {
    const author = pick(random, authors);
    const kind = pick(random, audienceKinds);
    const tag = pick(random, HASHTAGS);
    const createdAt = dateWithin(12);
    const body = `${pick(random, POST_BODIES)} #${tag}`;
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

  for (let start = 0; start < plain.length; start += 200) {
    await db.post.createMany({ data: plain.slice(start, start + 200) as never });
  }

  // Questions with topic tags and, for some, an accepted answer after comments.
  const questionPosts: Array<{ id: string; authorId: string }> = [];
  for (let index = 0; index < 90; index += 1) {
    const author = pick(random, authors);
    const kind = pick(random, audienceKinds.filter((value) => value !== "PUBLIC"));
    const createdAt = dateWithin(12);
    const title = pick(random, QUESTIONS);
    const tag = pick(random, HASHTAGS);
    const created = await db.post.create({
      data: {
        universityId: context.universityId,
        authorId: author.id,
        type: "QUESTION",
        body: `${pick(random, POST_BODIES)}\n\n#${tag}`,
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

  // Polls with real options and votes.
  const polls: Array<{ postId: string; pollId: string; options: Array<{ id: string; index: number }> }> = [];
  for (let index = 0; index < 90; index += 1) {
    const author = pick(random, authors);
    const kind = pick(random, ["PUBLIC", "PUBLIC", "DEPARTMENT", "LEVEL", "COLLEGE"] as const);
    const createdAt = dateWithin(10);
    const source = pick(random, POLLS);
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
        endsAt: new Date(now + Math.ceil(random() * 7) * 24 * 60 * 60 * 1000),
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

  // Reposts carry the original audience verbatim.
  const repostData = [];
  for (let index = 0; index < 60; index += 1) {
    const original = pick(random, seededPosts.slice(0, 600));
    const author = pick(random, authors);
    const createdAt = dateWithin(6);
    const id = randomUUID();
    repostData.push({
      id,
      universityId: context.universityId,
      authorId: author.id,
      type: "REPOST",
      body: "",
      audiencePath: original.kind === "PUBLIC" ? ["PUBLIC"] : pathFor(
        authors.find((candidate) => candidate.id === original.authorId) ?? author,
        original.kind,
      ),
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

  // Media on a dozen posts, so every card variant has real content.
  await db.postMedia.createMany({
    data: postIds.slice(0, 12).map((postId, index) => {
      const image = images[index % images.length]!;
      return {
        id: randomUUID(),
        universityId: context.universityId,
        postId,
        publicId: image.publicId,
        url: image.url,
        width: image.width,
        height: image.height,
        order: 0,
        alt: "Illustration of campus activity",
      };
    }),
  });

  // Hashtags and their post links.
  const hashtagIds = new Map<string, string>();
  for (const tag of HASHTAGS) {
    const hashtag = await db.hashtag.upsert({
      where: { universityId_tag: { universityId: context.universityId, tag } },
      create: { universityId: context.universityId, tag },
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

  // Comments, including replies and accepted answers.
  const commentData: Array<Record<string, unknown>> = [];
  const commentIds: string[] = [];
  for (let index = 0; index < 260; index += 1) {
    const post = pick(random, seededPosts.filter((candidate) => candidate.authorId !== authors[0]?.id));
    const author = pick(random, authors);
    const createdAt = new Date(Math.min(now, post.createdAt.getTime() + Math.ceil(random() * 72) * 60 * 60 * 1000));
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
  for (let index = 0; index < 90; index += 1) {
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
      createdAt: new Date(Math.min(now, parent.createdAt.getTime() + 2 * 60 * 60 * 1000)),
      helpfulCount: Math.floor(random() * 10),
    });
  }
  const acceptedAnswers: Array<{ postId: string; commentId: string }> = [];
  for (const question of questionPosts.slice(0, 30)) {
    const id = randomUUID();
    commentData.push({
      id,
      universityId: context.universityId,
      postId: question.id,
      authorId: pick(random, authors.filter((author) => author.id !== question.authorId)).id,
      body: "I have the materials. Check your department drive, or send me a message and I'll share the folder.",
      status: "ACTIVE",
      helpfulCount: 12 + Math.floor(random() * 30),
      createdAt: dateWithin(5),
    });
    acceptedAnswers.push({ postId: question.id, commentId: id });
  }
  await db.comment.createMany({ data: commentData as never });

  // Reactions, bookmarks and poll votes.
  const reactionData = [];
  const bookmarkData = [];
  for (let index = 0; index < 1400; index += 1) {
    const postId = pick(random, postIds);
    const author = pick(random, authors);
    reactionData.push({
      id: randomUUID(),
      universityId: context.universityId,
      userId: author.id,
      targetType: "POST",
      targetId: postId,
      createdAt: dateWithin(8),
    });
  }
  for (let index = 0; index < 420; index += 1) {
    bookmarkData.push({
      id: randomUUID(),
      universityId: context.universityId,
      userId: pick(random, authors).id,
      postId: pick(random, postIds),
      createdAt: dateWithin(8),
    });
  }
  await db.reaction.createMany({ data: reactionData as never, skipDuplicates: true });
  await db.bookmark.createMany({ data: bookmarkData as never, skipDuplicates: true });

  const voteData = [];
  for (const poll of polls) {
    const voters = new Set<string>();
    const count = 2 + Math.floor(random() * 6);
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
        createdAt: dateWithin(5),
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

  // Reports, a resolved removal and three active strikes on one account.
  const reportTargets = postIds.slice(20, 32);
  const reasons = ["HARASSMENT", "SPAM", "HATE_OR_ABUSE", "FALSE_INFORMATION", "SOMETHING_ELSE", "VIOLENCE_OR_THREATS"] as const;
  for (let index = 0; index < reportTargets.length; index += 1) {
    const postId = reportTargets[index]!;
    const reporter = pick(random, authors);
    await db.report
      .create({
        data: {
          universityId: context.universityId,
          reporterId: reporter.id,
          targetType: "POST",
          targetId: postId,
          reason: reasons[index % reasons.length]!,
          details: index % 2 === 0 ? "This keeps showing up in my feed and it looks like spam." : null,
        },
      })
      .catch(() => undefined);
  }

  const disciplined = generated[3]!;
  const disciplinedPosts = seededPosts.filter((post) => post.authorId === disciplined.id).slice(0, 3);
  const strikeReasons = [
    "Inappropriate and disrespectful remarks toward another student. First strike issued.",
    "Repeated promotional links in multiple groups. Second strike issued.",
    "Offensive language directed at a department. Third strike issued.",
  ];
  for (let index = 0; index < disciplinedPosts.length; index += 1) {
    const target = disciplinedPosts[index]!;
    const action = await db.moderationAction.create({
      data: {
        universityId: context.universityId,
        moderatorId: context.moderatorId,
        targetType: "POST",
        targetId: target.id,
        action: index === 1 ? "WARN" : "REMOVE",
        reason: strikeReasons[index]!,
      },
      select: { id: true },
    });
    await db.strike.create({
      data: {
        universityId: context.universityId,
        userId: disciplined.id,
        moderationActionId: action.id,
        expiresAt: new Date(now + 60 * 24 * 60 * 60 * 1000),
      },
    });
    if (index !== 1) {
      await db.post.update({
        where: { id: target.id },
        data: { status: "REMOVED", moderationReason: strikeReasons[index], removedAt: new Date() },
      });
    }
  }
  await db.user.update({
    where: { id: disciplined.id },
    data: { flaggedForReviewAt: new Date() },
  });

  // A few personal-state rows so settings have real content.
  const demo = context.demoAuthors[0]!;
  await db.mute
    .create({ data: { universityId: context.universityId, userId: demo.id, mutedUserId: generated[7]!.id } })
    .catch(() => undefined);
  await db.block
    .create({ data: { universityId: context.universityId, userId: demo.id, blockedUserId: generated[9]!.id } })
    .catch(() => undefined);
  await db.draft
    .create({
      data: {
        universityId: context.universityId,
        userId: demo.id,
        type: "POST",
        payload: { body: "The department workshop on software testing was really insightful. Here are a few key notes…" },
        audience: { id: `level:${context.nodeIds.get("dept-computer")}:300`, label: "My Level", kind: "LEVEL" },
      },
    })
    .catch(() => undefined);

  console.log("Seeded Phase 1 social content", {
    students: authors.length,
    posts: postIds.length,
    questions: questionPosts.length,
    polls: polls.length,
    comments: commentData.length,
  });
}
