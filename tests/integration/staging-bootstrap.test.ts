import { describe, expect, it } from "vitest";
import { platformDb } from "@/lib/db/platform";
import {
  assertStagingBootstrapEnvironment,
  bootstrapStaging,
  NOVA_SLUG,
} from "../../scripts/staging-bootstrap-lib";

const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const email = `staging-bootstrap-${suffix}@example.test`;

// The audit log is append-only, so the fixture admin deliberately stays behind
// rather than forcing an update/delete through the database trigger.


describe("staging bootstrap", () => {
  it("refuses any environment except explicit staging", () => {
    expect(() => assertStagingBootstrapEnvironment({})).toThrow(/DEPLOY_ENVIRONMENT/);
    expect(() =>
      assertStagingBootstrapEnvironment({ DEPLOY_ENVIRONMENT: "production" }),
    ).toThrow(/DEPLOY_ENVIRONMENT/);
    expect(() =>
      assertStagingBootstrapEnvironment({
        DEPLOY_ENVIRONMENT: "staging",
        VERCEL_ENV: "production",
      }),
    ).toThrow(/VERCEL_ENV/);
    expect(() =>
      assertStagingBootstrapEnvironment({
        DEPLOY_ENVIRONMENT: "staging",
        APP_URL: "https://konnekt.example",
        DATABASE_URL: "postgresql://db/konnekt",
        SEED_PLATFORM_ADMIN_EMAIL: "admin@example.test",
        RESEND_API_KEY: "re_test",
        EMAIL_FROM: "Konnekt <hello@example.test>",
      }),
    ).not.toThrow();
  });

  it("creates the Nova tenant and one must-set-password platform admin, then is safe to rerun", async () => {
    const sent: Array<{ to: string; resetUrl: string }> = [];
    const first = await bootstrapStaging(platformDb, {
      platformAdminEmail: email,
      appUrl: "https://konnekt-remake.vercel.app/",
      sendPasswordSetLink: async (input) => {
        sent.push(input);
      },
    });
    expect(first.adminId).toBeTruthy();
    expect(first.adminCreated).toBe(true);
    expect(first.resetLinkSent).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toBe(email);
    expect(sent[0]?.resetUrl).toMatch(/^https:\/\/konnekt-remake\.vercel\.app\/reset-password\?token=/);

    const university = await platformDb.university.findUnique({ where: { slug: NOVA_SLUG } });
    expect(university).toBeTruthy();
    const nodes = await platformDb.academicNode.findMany({ where: { universityId: university!.id } });
    expect(nodes.filter((node) => node.type === "COLLEGE").length).toBeGreaterThanOrEqual(4);
    expect(nodes.filter((node) => node.type === "FACULTY").length).toBeGreaterThanOrEqual(4);
    for (const department of ["Software Engineering", "Mechanical Engineering", "Architecture", "Law", "Medicine", "Mass Communication", "Accounting"]) {
      expect(nodes.some((node) => node.type === "DEPARTMENT" && node.name === department)).toBe(true);
    }

    const admin = await platformDb.user.findUnique({
      where: { id: first.adminId },
      select: { email: true, status: true, emailVerified: true, onboardingCompletedAt: true, passwordHash: true },
    });
    expect(admin?.email).toBe(email);
    expect(admin?.status).toBe("VERIFIED");
    expect(admin?.emailVerified).toBe(true);
    expect(admin?.onboardingCompletedAt).toBeTruthy();
    expect(admin?.passwordHash).not.toContain("password");
    expect(await platformDb.roleAssignment.count({ where: { userId: first.adminId, role: "PLATFORM_ADMIN" } })).toBe(1);
    expect(await platformDb.passwordResetToken.count({ where: { userId: first.adminId, usedAt: null } })).toBe(1);
    expect(await platformDb.auditLog.count({ where: { action: "staging.bootstrap", actorId: first.adminId } })).toBe(1);

    const second = await bootstrapStaging(platformDb, {
      platformAdminEmail: email,
      appUrl: "https://konnekt-remake.vercel.app/",
      sendPasswordSetLink: async (input) => {
        sent.push(input);
      },
    });
    expect(second.adminId).toBe(first.adminId);
    expect(second.adminCreated).toBe(false);
    expect(second.universityCreated).toBe(false);
    expect(second.academicNodesCreated).toBe(0);
    expect(second.resetLinkSent).toBe(false);
    expect(sent).toHaveLength(1);
    expect(await platformDb.roleAssignment.count({ where: { userId: first.adminId, role: "PLATFORM_ADMIN" } })).toBe(1);
    expect(await platformDb.auditLog.count({ where: { action: "staging.bootstrap", actorId: first.adminId } })).toBe(2);
  }, 30_000);
});
