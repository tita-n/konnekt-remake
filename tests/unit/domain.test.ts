import { describe, expect, it } from "vitest";
import { normalizeMatric, validateMatric } from "@/lib/domain/matric";
import { emailDomain, isStudentEmail, domainProblem, normalizeDomains } from "@/lib/domain/student-email";
import { checkAccentContrast, contrastRatio, readableOn, mix } from "@/lib/domain/color";
import { passwordStrength } from "@/lib/domain/password-strength";
import { parseAcademicCsv } from "@/lib/domain/academic-csv";
import { canTransitionUserStatus } from "@/lib/domain/status";
import { slugifyNodeName } from "@/lib/domain/slug";

const DEMO_PATTERN = "^[A-Z]{2,4}/\\d{4}/\\d{3,4}$";

describe("matric numbers", () => {
  it("normalizes whitespace and unicode dashes without changing digits", () => {
    expect(normalizeMatric(" csc/2024/1234 ")).toBe("CSC/2024/1234");
    expect(normalizeMatric("CSC\u20132024\u20131234")).toBe("CSC-2024-1234");
  });

  it("accepts values matching the university pattern", () => {
    expect(validateMatric("csc/2024/1234", DEMO_PATTERN)).toMatchObject({ ok: true, normalized: "CSC/2024/1234" });
    expect(validateMatric("MTH/2023/021", DEMO_PATTERN).ok).toBe(true);
  });

  it("rejects empty, overlong and mismatched values", () => {
    expect(validateMatric("", DEMO_PATTERN).error).toBe("EMPTY");
    expect(validateMatric("A".repeat(33), DEMO_PATTERN).error).toBe("TOO_LONG");
    expect(validateMatric("2024-1234", DEMO_PATTERN).error).toBe("FORMAT");
  });

  it("fails closed when the configured pattern is broken", () => {
    expect(validateMatric("CSC/2024/1234", "([").error).toBe("INVALID_PATTERN");
  });
});

describe("student email verification", () => {
  it("matches exact institutional domains only", () => {
    const domains = ["student.demo.edu.ng", "demo.edu.ng"];
    expect(isStudentEmail("ada@student.demo.edu.ng", domains)).toBe(true);
    expect(isStudentEmail("ada@DEMO.EDU.NG", domains)).toBe(true);
    expect(isStudentEmail("ada@evil-demo.edu.ng", domains)).toBe(false);
    expect(isStudentEmail("ada@gmail.com", domains)).toBe(false);
    expect(emailDomain("not-an-email")).toBeNull();
  });

  it("normalizes duplicates and rejects public mail domains", () => {
    expect(normalizeDomains(["@Demo.edu.ng", "demo.edu.ng.", ""])).toEqual(["demo.edu.ng"]);
    expect(domainProblem("gmail.com")).toMatch(/Public email/);
    expect(domainProblem("student.demo.edu.ng")).toBeNull();
    expect(domainProblem("not a domain")).not.toBeNull();
  });
});

describe("university accent contrast", () => {
  it("accepts the demo accent on light and dark surfaces", () => {
    const report = checkAccentContrast("#147A57");
    expect(report.passes).toBe(true);
    expect(report.onWhite).toBeGreaterThanOrEqual(3);
    expect(report.onDark).toBeGreaterThanOrEqual(3);
    expect(report.primaryButton).toBeGreaterThanOrEqual(4.5);
  });

  it("rejects accents that vanish on one theme", () => {
    expect(checkAccentContrast("#FFFF00").passes).toBe(false);
    expect(checkAccentContrast("#000000").passes).toBe(false);
    expect(checkAccentContrast("not-a-colour").passes).toBe(false);
  });

  it("computes standard contrast ratios and text colours", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBe(21);
    expect(readableOn("#FFFFFF")).toBe("#0C1411");
    expect(readableOn("#000000")).toBe("#FFFFFF");
    expect(mix("#000000", "#FFFFFF", 0.5)).toBe("#808080");
  });
});

describe("password strength", () => {
  it("scores a long mixed password highly and blocks common ones", () => {
    expect(passwordStrength("Konnekt-Campus-2026!").score).toBeGreaterThanOrEqual(3);
    expect(passwordStrength("password").score).toBe(0);
  });

  it("penalises user identifiers", () => {
    expect(passwordStrength("Adaeze-Adaeze-2026", ["adaeze"]).score).toBeLessThanOrEqual(1);
  });
});

describe("academic CSV import", () => {
  const existing = [{ name: "Faculty of Science", type: "FACULTY" as const, parentId: null }];

  it("parses a headerless CSV and plans new departments", () => {
    const preview = parseAcademicCsv(
      "College of Science,Faculty of Science,Computer Science,100;200;300\nCollege of Arts,Faculty of Arts,History,100;200",
      existing,
    );
    expect(preview.valid).toBe(true);
    expect(preview.rows).toHaveLength(2);
    expect(preview.rows[0]).toMatchObject({ department: "Computer Science", levels: [100, 200, 300], action: "create" });
  });

  it("marks existing departments and rejects invalid rows", () => {
    const preview = parseAcademicCsv(
      "college,faculty,department,levels\nCollege,Faculty of Science,Computer Science,100;200\nCollege,Faculty of Science,,100",
      existing,
    );
    expect(preview.valid).toBe(false);
    expect(preview.rows.some((row) => row.action === "error")).toBe(true);
    const existingPreview = parseAcademicCsv("College,Faculty of Science,Computer Science,100", [
      { name: "Faculty of Science", type: "FACULTY", parentId: null },
      { name: "Computer Science", type: "DEPARTMENT", parentId: "x" },
    ]);
    expect(existingPreview.rows[0]?.action).toBe("exists");
  });

  it("rejects duplicate rows and empty imports", () => {
    const duplicate = parseAcademicCsv(
      "A,B,Department,100\nA,B,Department,200",
      existing,
    );
    expect(duplicate.valid).toBe(false);
    expect(parseAcademicCsv("", existing).valid).toBe(false);
  });
});

describe("state machines", () => {
  it("allows only documented user transitions", () => {
    expect(canTransitionUserStatus("PENDING", "VERIFIED")).toBe(true);
    expect(canTransitionUserStatus("VERIFIED", "SUSPENDED")).toBe(true);
    expect(canTransitionUserStatus("SUSPENDED", "VERIFIED")).toBe(true);
    expect(canTransitionUserStatus("SUSPENDED", "PENDING")).toBe(false);
    expect(canTransitionUserStatus("DELETED_PENDING", "VERIFIED")).toBe(false);
    expect(canTransitionUserStatus("VERIFIED", "VERIFIED")).toBe(false);
  });
});

describe("academic slugs", () => {
  it("produces stable URL-safe slugs", () => {
    expect(slugifyNodeName("Computer Science")).toBe("computer-science");
    expect(slugifyNodeName("  Àkọ́kọ́  ")).toBe("akoko");
    expect(slugifyNodeName("!!!")).toBe("");
  });
});
