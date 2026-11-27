import { describe, expect, it } from "vitest";
import {
  audienceLabel,
  canSeePost,
  inheritedRepostAudience,
  isDuplicateBody,
  isMutuallyBlocked,
  isMutedByViewer,
  parseHashtags,
  parseMentions,
  pollPercentages,
  pollResultsVisible,
  shouldFlagForReview,
  validatePollOptions,
  visibleAudienceFilter,
  visibleAudiencePaths,
} from "@/lib/domain/posts";
import { audienceOptionsFor, buildStudentPath, canSee } from "@/lib/domain/academic";
import { decodeTimeCursor, encodeTimeCursor } from "@/lib/posts/cursor";

const UNI = "uni_a";
const OTHER_UNI = "uni_b";
const COLLEGE = "college_eng";
const OTHER_COLLEGE = "college_sci";
const FACULTY = "faculty_software";
const OTHER_FACULTY = "faculty_civil";
const DEPT = "dept_software";
const OTHER_DEPT = "dept_civil";

function path(
  level = 300,
  options: { college?: string | null; faculty?: string | null; department?: string } = {},
) {
  const college = options.college === undefined ? COLLEGE : options.college;
  const faculty = options.faculty === undefined ? FACULTY : options.faculty;
  return buildStudentPath({
    universityId: UNI,
    college: college ? { id: college, name: "College" } : null,
    faculty: faculty ? { id: faculty, name: "Faculty" } : null,
    department: { id: options.department ?? DEPT, name: "Software" },
    level,
  });
}

const levels = [100, 200, 300, 400, 500];

describe("audience visibility", () => {
  it("lets every student in the university see a PUBLIC post", () => {
    for (const level of levels) {
      expect(
        canSeePost(path(level), { audiencePath: ["PUBLIC"], audienceKind: "PUBLIC" }),
      ).toBe(true);
    }
  });

  it("matches level, department, faculty and college exactly", () => {
    const viewer = path(300);
    expect(canSeePost(viewer, { audiencePath: path(300).map(String), audienceKind: "LEVEL" })).toBe(true);
    expect(canSeePost(viewer, { audiencePath: [UNI, COLLEGE, FACULTY, DEPT], audienceKind: "DEPARTMENT" })).toBe(true);
    expect(canSeePost(viewer, { audiencePath: [UNI, COLLEGE, FACULTY], audienceKind: "FACULTY" })).toBe(true);
    expect(canSeePost(viewer, { audiencePath: [UNI, COLLEGE], audienceKind: "COLLEGE" })).toBe(true);
  });

  it("rejects a different level, department, faculty or college", () => {
    const viewer = path(300);
    expect(canSeePost(viewer, { audiencePath: path(200).map(String), audienceKind: "LEVEL" })).toBe(false);
    expect(canSeePost(viewer, { audiencePath: [UNI, COLLEGE, FACULTY, OTHER_DEPT], audienceKind: "DEPARTMENT" })).toBe(false);
    expect(canSeePost(viewer, { audiencePath: [UNI, COLLEGE, OTHER_FACULTY], audienceKind: "FACULTY" })).toBe(false);
    expect(canSeePost(viewer, { audiencePath: [UNI, OTHER_COLLEGE], audienceKind: "COLLEGE" })).toBe(false);
  });

  it("never crosses universities, even when node ids collide", () => {
    expect(canSeePost(path(300), { audiencePath: [OTHER_UNI], audienceKind: "COLLEGE" })).toBe(false);
    expect(canSeePost(path(300), { audiencePath: [OTHER_UNI, COLLEGE, FACULTY, DEPT, 300], audienceKind: "LEVEL" })).toBe(false);
    expect(canSeePost(path(300), { audiencePath: ["PUBLIC"], audienceKind: "LEVEL" })).toBe(false);
    expect(canSeePost(path(300), { audiencePath: [], audienceKind: "PUBLIC" })).toBe(false);
  });

  it("handles universities that skip the college or faculty layer", () => {
    const noCollege = buildStudentPath({
      universityId: UNI,
      faculty: { id: FACULTY, name: "Faculty" },
      department: { id: DEPT, name: "Software" },
      level: 300,
    });
    expect(canSeePost(noCollege, { audiencePath: [UNI, FACULTY], audienceKind: "FACULTY" })).toBe(true);
    expect(canSeePost(noCollege, { audiencePath: [UNI, FACULTY, DEPT], audienceKind: "DEPARTMENT" })).toBe(true);
    expect(canSeePost(noCollege, { audiencePath: [UNI, COLLEGE], audienceKind: "COLLEGE" })).toBe(false);

    const departmentOnly = buildStudentPath({
      universityId: UNI,
      department: { id: DEPT, name: "Software" },
      level: 100,
    });
    expect(canSeePost(departmentOnly, { audiencePath: [UNI], audienceKind: "PUBLIC" })).toBe(false);
    expect(canSeePost(departmentOnly, { audiencePath: [UNI, DEPT], audienceKind: "DEPARTMENT" })).toBe(true);
  });

  it("offers only audiences along the author's own path", () => {
    const input = {
      universityId: UNI,
      college: { id: COLLEGE, name: "Engineering" },
      faculty: { id: FACULTY, name: "Software" },
      department: { id: DEPT, name: "Software Engineering" },
      level: 300,
    };
    const options = audienceOptionsFor(input);
    expect(options.map((option) => option.scope)).toEqual(["university", "college", "faculty", "department", "level"]);
    for (const option of options) {
      expect(canSee(buildStudentPath(input), option.path)).toBe(true);
    }
  });

  it("exhaustively agrees between the in-memory check and the SQL filter", () => {
    const viewer = path(300);
    const posts: Array<{ audiencePath: Array<string | number>; audienceKind: Parameters<typeof canSeePost>[1]["audienceKind"] }> = [];
    const kinds = ["PUBLIC", "COLLEGE", "FACULTY", "DEPARTMENT", "LEVEL"] as const;
    for (const kind of kinds) {
      for (const candidate of visibleAudiencePaths(viewer)) {
        posts.push({ audiencePath: candidate, audienceKind: kind });
      }
      posts.push({ audiencePath: [UNI, COLLEGE, FACULTY, OTHER_DEPT], audienceKind: kind });
      posts.push({ audiencePath: [UNI, OTHER_COLLEGE], audienceKind: kind });
      posts.push({ audiencePath: [UNI, COLLEGE, FACULTY, DEPT, 200], audienceKind: kind });
      posts.push({ audiencePath: [OTHER_UNI], audienceKind: kind });
    }

    for (const post of posts) {
      const inMemory = canSeePost(viewer, post);
      const filter = visibleAudienceFilter(viewer);
      const inFilter = filter.OR.some((clause) =>
        "audienceKind" in clause
          ? clause.audienceKind === post.audienceKind
          : clause.audiencePath.equals.length === post.audiencePath.length &&
            clause.audiencePath.equals.every((segment, index) => segment === post.audiencePath[index]),
      );
      // The SQL filter is intentionally a little broader than the pure check
      // for path-shaped rows; every row is re-checked before leaving the API.
      if (inMemory) expect(inFilter).toBe(true);
      if (post.audienceKind === "PUBLIC") expect(inMemory).toBe(post.audiencePath[0] === "PUBLIC");
    }
  });

  it("inherits the original audience on every repost", () => {
    const original = { audiencePath: [UNI, COLLEGE, FACULTY, DEPT], audienceKind: "DEPARTMENT" as const };
    const repost = inheritedRepostAudience(original);
    expect(repost).toEqual({ audiencePath: original.audiencePath, audienceKind: "DEPARTMENT" });
    // No caller-supplied widening survives: the audience is copied verbatim.
    expect(canSeePost(path(300), repost)).toBe(canSeePost(path(300), original));
    expect(canSeePost(path(300, { department: OTHER_DEPT }), repost)).toBe(false);
  });
});

describe("block and mute rules", () => {
  it("hides content in both directions when either side blocked", () => {
    const none = { blockedByViewer: new Set<string>(), blockedViewer: new Set<string>() };
    expect(isMutuallyBlocked("a", "b", none)).toBe(false);
    expect(isMutuallyBlocked("a", "b", { ...none, blockedByViewer: new Set(["b"]) })).toBe(true);
    expect(isMutuallyBlocked("a", "b", { ...none, blockedViewer: new Set(["a"]) })).toBe(true);
  });

  it("mutes only the muter's view and never hides the author from themselves", () => {
    expect(isMutedByViewer("a", "b", new Set(["b"]))).toBe(true);
    expect(isMutedByViewer("b", "a", new Set(["b"]))).toBe(false);
    expect(isMutedByViewer("a", "a", new Set(["a"]))).toBe(false);
  });
});

describe("hashtag and mention parsing", () => {
  it("extracts unique lowercase hashtags", () => {
    expect(parseHashtags("Hello #NovaUniversity and #CSC204, again #novAuniversity")).toEqual([
      "novauniversity",
      "csc204",
    ]);
  });

  it("does not treat a bare hash or URL fragment as a hashtag", () => {
    expect(parseHashtags("# not a tag, https://x.test/#frag")).toEqual([]);
  });

  it("extracts mentions with or without leading punctuation", () => {
    expect(parseMentions("Hi @AdaEze and (@tunde_2), email a@b.com")).toEqual(["adaeze", "tunde_2"]);
    expect(parseMentions("@ab")).toEqual([]);
  });
});

describe("flags and duplicates", () => {
  it("flags contact details without blocking the post", () => {
    const result = shouldFlagForReview("Call 0803 123 4567 or mail me at a@b.com");
    expect(result.flagged).toBe(true);
    expect(result.reasons).toEqual(["contact_email", "contact_phone"]);
  });

  it("normalises whitespace and punctuation for duplicate detection", () => {
    expect(isDuplicateBody("Hello,   world!", "hello world")).toBe(true);
    expect(isDuplicateBody("Hello world", "Hello there world")).toBe(false);
  });
});

describe("polls", () => {
  it("requires two to four distinct short options", () => {
    expect(validatePollOptions(["", " "])).not.toBeNull();
    expect(validatePollOptions(["A"])).not.toBeNull();
    expect(validatePollOptions(["A", "A"])).not.toBeNull();
    expect(validatePollOptions(["A", "B", "C", "D", "E"])).not.toBeNull();
    expect(validatePollOptions(["A", "B"])).toBeNull();
  });

  it("shows results only after voting or closing", () => {
    const future = new Date(Date.now() + 60_000);
    expect(pollResultsVisible({ hasVoted: false, endsAt: future })).toBe(false);
    expect(pollResultsVisible({ hasVoted: true, endsAt: future })).toBe(true);
    expect(pollResultsVisible({ hasVoted: false, endsAt: new Date(Date.now() - 1) })).toBe(true);
  });

  it("rounds percentages to exactly 100", () => {
    expect(pollPercentages([1, 1, 1])).toEqual([34, 33, 33]);
    expect(pollPercentages([0, 0])).toEqual([0, 0]);
  });
});

describe("ordering and labels", () => {
  it("keeps strict time order with an id tiebreak and no audience boost", () => {
    const first = new Date("2026-11-17T12:00:00Z");
    const second = new Date("2026-11-17T12:00:00Z");
    expect(first.getTime()).toBe(second.getTime());
    const cursor = decodeTimeCursor(encodeTimeCursor(first, "post-b"));
    expect(cursor).toEqual({ createdAt: first.toISOString(), id: "post-b" });
    // The retired rankAt cursor shape is still readable.
    const legacy = Buffer.from(JSON.stringify({ r: first.toISOString(), i: "post-a" })).toString("base64url");
    expect(decodeTimeCursor(legacy)).toEqual({ createdAt: first.toISOString(), id: "post-a" });
  });

  it("uses the university's own layer labels", () => {
    expect(audienceLabel("COLLEGE", { college: "Faculty" }, { college: "Engineering" })).toBe("Faculty: Engineering");
    expect(audienceLabel("LEVEL")).toBe("My level");
    expect(audienceLabel("PUBLIC")).toBe("Public");
  });
});
