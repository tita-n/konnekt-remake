import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

/**
 * Proof that the e2e app is not reading or writing the demo database. The CI
 * job also hashes the demo tables before and after Playwright; this spec makes
 * the same boundary visible as a normal test.
 */
test("e2e uses its own database and leaves the Nova demo seed intact", async () => {
  const devUrl = process.env.DEV_DATABASE_URL;
  expect(devUrl, "DEV_DATABASE_URL must point at the seeded demo database").toBeTruthy();

  const appUrl = process.env.DATABASE_URL;
  expect(appUrl, "the app server must use the guarded e2e URL").toBeTruthy();
  expect(new URL(appUrl!).pathname).not.toBe(new URL(devUrl!).pathname);

  const dev = new PrismaClient({ datasourceUrl: devUrl });
  try {
    const nova = await dev.university.findUnique({ where: { slug: "nova-university" } });
    expect(nova).toBeTruthy();
    expect(await dev.user.count({ where: { universityId: nova!.id } })).toBeGreaterThanOrEqual(50);
    expect(await dev.post.count({ where: { universityId: nova!.id } })).toBeGreaterThanOrEqual(100);

    // E2E-generated posts are deterministic and prefixed; none may exist here.
    expect(await dev.post.count({ where: { universityId: nova!.id, body: { startsWith: "E2E " } } })).toBe(0);
  } finally {
    await dev.$disconnect();
  }
});
