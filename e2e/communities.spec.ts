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

  test("an owner manages rules, invites and resources from the community screens", async ({ page }) => {
    test.setTimeout(120_000);
    // Admin-created so this test does not consume a student's daily community
    // creation budget, which is shared with the other cases in this file.
    await login(page, "admin@nova.edu.ng");
    const suffix = Date.now().toString(36);
    const created = await mutation(page, "POST", "/api/admin/communities", {
      name: `E2E Manage Circle ${suffix}`,
      description: "A public community used to exercise every management screen.",
      category: "ACADEMIC",
      privacy: "PUBLIC",
    });
    expect(created.status()).toBe(201);
    const community = (await created.json()) as { id: string; slug: string };

    await page.goto(`/c/${community.slug}/settings`, { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Basics" })).toBeVisible();

    const ruleTitle = `Keep it useful ${suffix}`;
    await page.getByRole("button", { name: "Add rule" }).click();
    await page.getByLabel("Rule 1 title").fill(ruleTitle);
    await page.getByLabel("Rule 1 description").fill("Cite sources when you share past questions.");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Community updated")).toBeVisible();
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByLabel("Rule 1 title")).toHaveValue(ruleTitle);

    await page.getByRole("button", { name: "Create link" }).click();
    await expect(page.getByRole("button", { name: "Copy invite link" })).toBeVisible();
    await expect(page.getByText(/invite=/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Revoke invite" })).toHaveCount(1);

    await page.goto(`/c/${community.slug}`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Resources" }).click();
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await page.getByRole("button", { name: "Link", exact: true }).click();
    const resourceTitle = `Lab setup guide ${suffix}`;
    await page.getByLabel("Title").fill(resourceTitle);
    await page.getByLabel("https:// link").fill("https://example.edu.ng/lab-setup.pdf");
    await page.getByRole("button", { name: "Add resource" }).last().click();
    await expect(page.getByText(resourceTitle)).toBeVisible();

    await page.getByRole("button", { name: "Members" }).click();
    await expect(page.getByPlaceholder("Search by name or username")).toBeVisible();
    await expect(page.getByText("@nova_admin")).toBeVisible();
  });

  test("a university admin creates an official community from the console", async ({ page }) => {
    test.setTimeout(90_000);
    // A dedicated admin, so this case does not spend the shared admin's
    // three-community daily creation allowance.
    await login(page, "desk@nova.edu.ng");
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
    await expect(page.getByRole("img", { name: "Official community" }).first()).toBeVisible();
  });
});
