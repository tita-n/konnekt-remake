import { expect, test, type Cookie, type Page } from "@playwright/test";
import { login } from "./helpers";

const STUDENT = "student@nova.edu.ng";
const LEVELMATE = "levelmate@nova.edu.ng";
const sessions = new Map<string, Cookie[]>();

async function switchUser(page: Page, email: string): Promise<void> {
  await page.context().clearCookies();
  const cached = sessions.get(email);
  if (cached) {
    await page.context().addCookies(cached);
    await page.goto("/pulse", { waitUntil: "networkidle" });
    return;
  }
  await login(page, email);
  sessions.set(email, await page.context().cookies());
}

async function mutation(page: Page, method: "POST" | "PATCH", path: string, data: Record<string, unknown>) {
  const token = (await page.context().cookies()).find((cookie) => cookie.name === "konnekt_csrf")?.value ?? "";
  return page.request.fetch(path, {
    method,
    data,
    headers: { "x-konnekt-csrf": token },
  });
}

test.describe("communities product", () => {
  test("a public community accepts posts and keeps them out of academic feeds", async ({ page }) => {
    test.setTimeout(90_000);
    await login(page, STUDENT);
    const suffix = Date.now().toString(36);
    const created = await mutation(page, "POST", "/api/communities", {
      name: `E2E Public Circle ${suffix}`,
      description: "A public community created by an end-to-end test.",
      category: "ACADEMIC",
      privacy: "PUBLIC",
    });
    expect(created.status()).toBe(201);
    const community = (await created.json()) as { id: string; slug: string };

    await switchUser(page, LEVELMATE);
    const pageResponse = await page.goto(`/c/${community.slug}`, { waitUntil: "networkidle" });
    expect(pageResponse?.status()).toBe(200);

    await switchUser(page, STUDENT);
    const marker = `E2E community post ${suffix}`;
    const posted = await mutation(page, "POST", "/api/posts", {
      type: "POST",
      body: marker,
      communityId: community.id,
    });
    expect(posted.status()).toBe(201);

    await switchUser(page, LEVELMATE);
    await page.goto("/pulse", { waitUntil: "networkidle" });
    await expect(page.getByText(marker)).toHaveCount(0);
    const communityPosts = await page.request.get(`/api/communities/${community.id}/posts`);
    expect(communityPosts.ok()).toBe(true);
    expect(await communityPosts.text()).toContain(marker);
  });

  test("invite-only communities are indistinguishable from missing ones for outsiders", async ({ page }) => {
    test.setTimeout(90_000);
    await login(page, LEVELMATE);
    const suffix = Date.now().toString(36);
    const created = await mutation(page, "POST", "/api/communities", {
      name: `E2E Private Circle ${suffix}`,
      description: "An invite-only community that outsiders must never discover.",
      category: "HOBBY",
      privacy: "INVITE_ONLY",
    });
    expect(created.status()).toBe(201);
    const community = (await created.json()) as { id: string; slug: string };

    await switchUser(page, STUDENT);
    const discovery = await page.request.get(`/api/communities?q=${encodeURIComponent(`E2E Private Circle ${suffix}`)}`);
    expect(discovery.ok()).toBe(true);
    expect(await discovery.text()).not.toContain(community.id);

    const hidden = await page.goto(`/c/${community.slug}`, { waitUntil: "networkidle" });
    const missing = await page.goto(`/c/this-community-does-not-exist-${suffix}`, { waitUntil: "networkidle" });
    expect(hidden?.status()).toBe(missing?.status());
    await expect(page.locator("main")).toContainText(/isn't available|not found|404/i);
  });

  test("request-only joins stay pending until the owner approves", async ({ page }) => {
    test.setTimeout(90_000);
    await login(page, STUDENT);
    const suffix = Date.now().toString(36);
    const created = await mutation(page, "POST", "/api/communities", {
      name: `E2E Request Circle ${suffix}`,
      description: "A request-only community for testing the approval flow.",
      category: "TECH",
      privacy: "REQUEST",
    });
    expect(created.status()).toBe(201);
    const community = (await created.json()) as { id: string; slug: string };

    await switchUser(page, LEVELMATE);
    const joined = await mutation(page, "POST", `/api/communities/${community.id}/join`, {
      message: "I would like to join this circle.",
    });
    expect(joined.status()).toBe(201);
    expect(await joined.json()).toMatchObject({ state: "REQUESTED" });

    await switchUser(page, STUDENT);
    const requestList = await page.request.get(`/api/communities/${community.id}/requests`);
    expect(requestList.ok()).toBe(true);
    const requests = (await requestList.json()) as { requests: Array<{ id: string }> };
    expect(requests.requests).toHaveLength(1);
    const approved = await mutation(page, "PATCH", `/api/communities/${community.id}/requests/${requests.requests[0]!.id}`, {
      decision: "APPROVE",
    });
    expect(approved.ok()).toBe(true);

    await switchUser(page, LEVELMATE);
    const memberPage = await page.goto(`/c/${community.slug}`, { waitUntil: "networkidle" });
    expect(memberPage?.status()).toBe(200);
    await expect(page.getByRole("link", { name: "Post in community" })).toBeVisible();
  });

  test("a university admin creates an official community from the console", async ({ page }) => {
    test.setTimeout(90_000);
    await login(page, "admin@nova.edu.ng");
    const suffix = Date.now().toString(36);
    const created = await mutation(page, "POST", "/api/admin/communities", {
      name: `E2E Campus Desk ${suffix}`,
      description: "An official university desk created through the admin console API.",
      category: "ASSOCIATION",
      privacy: "PUBLIC",
    });
    expect(created.status()).toBe(201);
    const community = (await created.json()) as { id: string; slug: string };

    await page.goto("/admin/communities", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Communities" })).toBeVisible();
    await page.getByPlaceholder("Name or description").fill(`E2E Campus Desk ${suffix}`);
    await page.getByRole("button", { name: "Filter" }).click();
    await expect(page.getByText(`E2E Campus Desk ${suffix}`).first()).toBeVisible();
    await expect(page.getByText(/official/i).first()).toBeVisible();

    await page.goto(`/c/${community.slug}`, { waitUntil: "networkidle" });
    await expect(page.getByText("Official").first()).toBeVisible();
  });
});
