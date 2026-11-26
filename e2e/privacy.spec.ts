import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

test("public share preview reveals no author, counts or metadata", async ({ page }) => {
  const db = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });
  try {
    const publicPost = await db.post.findUnique({ where: { idempotencyKey: "e2e-public-preview" } });
    const levelPost = await db.post.findUnique({ where: { idempotencyKey: "e2e-feed-welcome" } });
    expect(publicPost && levelPost).toBeTruthy();

    const publicResponse = await page.goto(`/p/${publicPost!.id}`);
    expect(publicResponse?.status()).toBe(200);
    const publicHtml = await page.content();
    expect(publicHtml).toContain("blur-[4px]");
    expect(publicHtml).not.toContain("Chinedu Okafor");
    expect(publicHtml).not.toContain("@chinedu_okafor");
    expect(publicHtml).not.toMatch(/<meta[^>]+property=["']og:/i);
    expect(publicHtml).toContain("noindex");

    const levelResponse = await page.goto(`/p/${levelPost!.id}`);
    expect(levelResponse?.status()).toBe(200);
    const levelHtml = await page.content();
    expect(levelHtml).toContain("This post is only available inside Konnekt.");
    expect(levelHtml).not.toContain("Aisha Bello");
    expect(levelHtml).not.toContain("deterministic e2e campus feed");
    expect(levelHtml).not.toMatch(/<meta[^>]+property=["']og:/i);

    // Events differ from posts: a private/missing event intentionally gets a
    // generic share card, but it must never expose the event or its audience.
    const eventResponse = await page.goto("/e/00000000-0000-4000-8000-000000000000");
    expect(eventResponse?.status()).toBe(200);
    const eventHtml = await page.content();
    expect(eventHtml).toContain("This event is private");
    expect(eventHtml).toContain("noindex");
  } finally {
    await db.$disconnect();
  }
});
