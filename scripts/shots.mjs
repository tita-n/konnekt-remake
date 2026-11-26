import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const BASE_URL = process.env.SHOTS_BASE_URL || "http://127.0.0.1:3000";
const OUT_DIR = path.resolve(process.cwd(), "design/review");

function resolveChromiumExecutable() {
  const candidates = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    "/ms-playwright/chrome-headless-shell-linux64/chrome-headless-shell",
    "/usr/bin/chromium",
    "/usr/bin/google-chrome",
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

/**
 * Screenshot harness (`pnpm shots`) covering Section 8 screens and states
 * across Light & Dark themes and Mobile (390x844) / Desktop (1440x900).
 */
const SHOTS = [
  // Unauthenticated live routes
  { name: "welcome", path: "/", viewports: ["mobile", "desktop"] },
  { name: "find-university", path: "/signup", viewports: ["mobile"] },
  { name: "login", path: "/login", viewports: ["mobile"] },
  { name: "forgot-password", path: "/forgot-password", viewports: ["mobile"] },
  { name: "reset-password", path: "/reset-password?token=demo", viewports: ["mobile"] },
  { name: "legal-terms", path: "/legal/terms", viewports: ["mobile"] },
  { name: "offline-empty", path: "/offline", viewports: ["mobile"] },

  // Dev fixture screens rendering real components with Nova University data
  { name: "pulse-populated", path: "/design/preview/pulse-populated", viewports: ["mobile", "desktop"] },
  { name: "pulse-states", path: "/design/preview/pulse-states", viewports: ["mobile"] },
  { name: "composer-post", path: "/design/preview/composer-post", viewports: ["mobile"] },
  { name: "composer-question", path: "/design/preview/composer-question", viewports: ["mobile"] },
  { name: "composer-poll", path: "/design/preview/composer-poll", viewports: ["mobile"] },
  { name: "composer-audience", path: "/design/preview/composer-audience", viewports: ["mobile"] },
  { name: "post-detail", path: "/design/preview/post-detail", viewports: ["mobile"] },
  { name: "post-removed-unavailable", path: "/design/preview/post-removed-and-unavailable", viewports: ["mobile"] },
  { name: "post-menus", path: "/design/preview/post-menus", viewports: ["mobile"] },
  { name: "image-viewer", path: "/design/preview/image-viewer", viewports: ["mobile"] },
  { name: "drafts", path: "/design/preview/drafts", viewports: ["mobile"] },
  { name: "bookmarks", path: "/design/preview/bookmarks", viewports: ["mobile"] },
  { name: "hashtag", path: "/design/preview/hashtag", viewports: ["mobile"] },
  { name: "profile-self", path: "/design/preview/profile-self", viewports: ["mobile"] },
  { name: "profile-other", path: "/design/preview/profile-other", viewports: ["mobile"] },
  { name: "settings-appearance", path: "/design/preview/settings-appearance", viewports: ["mobile"] },
  { name: "blocked-muted", path: "/design/preview/blocked-muted", viewports: ["mobile"] },
  { name: "verify-method", path: "/design/preview/verify-method", viewports: ["mobile"] },
  { name: "verify-code", path: "/design/preview/verify-code", viewports: ["mobile"] },
  { name: "verify-id-upload", path: "/design/preview/verify-id-upload", viewports: ["mobile"] },
  { name: "verify-waiting", path: "/design/preview/verify-waiting", viewports: ["mobile"] },
  { name: "verify-rejected", path: "/design/preview/verify-rejected", viewports: ["mobile"] },
  { name: "create-account", path: "/design/preview/create-account", viewports: ["mobile"] },
  { name: "onboarding", path: "/design/preview/onboarding", viewports: ["mobile"] },
  { name: "onboarding-communities", path: "/design/preview/onboarding-communities", viewports: ["mobile"] },
  { name: "communities-hub", path: "/design/preview/communities-hub", viewports: ["mobile", "desktop"] },
  { name: "community-search", path: "/design/preview/community-search", viewports: ["mobile"] },
  { name: "community-create", path: "/design/preview/community-create", viewports: ["mobile"] },
  { name: "community-posts", path: "/design/preview/community-posts", viewports: ["mobile"] },
  { name: "community-resources", path: "/design/preview/community-resources", viewports: ["mobile"] },
  { name: "community-members", path: "/design/preview/community-members", viewports: ["mobile"] },
  { name: "community-about", path: "/design/preview/community-about", viewports: ["mobile"] },
  { name: "community-request-locked", path: "/design/preview/community-request-locked", viewports: ["mobile"] },
  { name: "community-settings", path: "/design/preview/community-settings", viewports: ["mobile", "desktop"] },
  { name: "admin-communities", path: "/design/preview/admin-communities", viewports: ["desktop"] },
  { name: "public-share-preview", path: "/design/preview/public-share-preview", viewports: ["mobile"] },

  // Phase 3 authenticated product screens (Nova demo seed)
  { name: "events-hub", path: "/events", viewports: ["mobile", "desktop"], auth: "student" },
  { name: "event-detail-upcoming", path: "/events/seed-event-upcoming", viewports: ["mobile", "desktop"], auth: "student" },
  { name: "event-detail-live", path: "/events/seed-event-scanner", viewports: ["mobile"], auth: "student" },
  { name: "event-detail-full", path: "/events/seed-event-full", viewports: ["mobile"], auth: "student" },
  { name: "event-detail-past", path: "/events/seed-event-past", viewports: ["mobile"], auth: "student" },
  { name: "event-detail-cancelled", path: "/events/seed-event-cancelled", viewports: ["mobile"], auth: "student" },
  { name: "event-detail-updated", path: "/events/seed-event-updated", viewports: ["mobile"], auth: "student" },
  { name: "event-detail-swe", path: "/events/seed-event-swe", viewports: ["mobile"], auth: "student" },
  { name: "event-rsvp-confirmation", path: "/events/seed-event-joinable", viewports: ["mobile"], auth: "student", action: "rsvp" },
  { name: "event-waitlist-confirmation", path: "/events/seed-event-waitlist", viewports: ["mobile"], auth: "student", action: "waitlist" },
  { name: "event-share-sheet", path: "/events/seed-event-upcoming", viewports: ["mobile"], auth: "student", action: "share" },
  { name: "event-new", path: "/events/new", viewports: ["mobile"], auth: "student" },
  { name: "event-edit", path: "/events/seed-event-updated/edit", viewports: ["mobile"], auth: "student" },
  { name: "event-dashboard", path: "/events/seed-event-scanner/dashboard", viewports: ["mobile", "desktop"], auth: "student" },
  { name: "event-scan", path: "/events/seed-event-scanner/scan", viewports: ["mobile"], auth: "student" },
  { name: "event-ticket", path: "/events/seed-event-scanner/ticket", viewports: ["mobile"], auth: "student" },
  { name: "event-ticket-generated", path: "/events/seed-event-scanner/ticket", viewports: ["mobile"], auth: "student", action: "ticket" },
  { name: "event-scan-offline", path: "/events/seed-event-scanner/scan", viewports: ["mobile"], auth: "student", action: "offline" },
  { name: "my-events", path: "/events/mine", viewports: ["mobile"], auth: "student" },
  { name: "official-channel", path: "/official", viewports: ["mobile", "desktop"], auth: "student" },
  { name: "announcement-detail", path: "/official/a/seed-announcement-registration", viewports: ["mobile"], auth: "student" },
  { name: "admin-events", path: "/admin/events", viewports: ["desktop"], auth: "admin" },
  { name: "admin-official", path: "/admin/official", viewports: ["desktop"], auth: "admin" },
  { name: "admin-reports", path: "/design/preview/admin-reports", viewports: ["desktop"] },
  { name: "admin-students", path: "/design/preview/admin-students", viewports: ["desktop"] },
  { name: "admin-verification", path: "/design/preview/admin-verification", viewports: ["desktop"] },
  { name: "admin-settings", path: "/design/preview/admin-settings", viewports: ["desktop"] },
  { name: "platform-overview", path: "/design/preview/platform-overview", viewports: ["desktop"] },
];

const VIEWPORT_MAP = {
  mobile: { width: 390, height: 844, label: "390x844" },
  desktop: { width: 1440, height: 900, label: "1440x900" },
};

async function run() {
  await mkdir(OUT_DIR, { recursive: true });
  const executablePath = resolveChromiumExecutable();
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });

  try {
    for (const mode of ["light", "dark"]) {
      for (const vpKey of ["mobile", "desktop"]) {
        const vp = VIEWPORT_MAP[vpKey];
        const context = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
          colorScheme: mode,
        });
        const page = await context.newPage();
        let authedRole = null;

        const only = process.env.SHOTS_ONLY ? new Set(process.env.SHOTS_ONLY.split(",").map((name) => name.trim())) : null;
        for (const shot of SHOTS) {
          if (only && !only.has(shot.name)) continue;
          if (shot.auth && authedRole !== shot.auth) {
            await context.clearCookies();
            await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle", timeout: 30_000 });
            await page.getByLabel("Email or username").fill(shot.auth === "admin" ? "admin@nova.edu.ng" : "student@nova.edu.ng");
            await page.getByLabel("Password", { exact: true }).fill("KonnektDemo123!");
            await page.getByRole("button", { name: "Log in" }).click();
            await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 });
            authedRole = shot.auth;
          }
          if (!shot.viewports.includes(vpKey)) continue;
          const sep = shot.path.includes("?") ? "&" : "?";
          const targetUrl = shot.path.startsWith("/design/")
            ? `${BASE_URL}${shot.path}${sep}theme=${mode}`
            : `${BASE_URL}${shot.path}`;

          await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 30_000 });
          await page.evaluate(async (theme) => {
            localStorage.setItem("konnekt.theme", theme);
            document.documentElement.dataset.theme = theme;
            if (document.fonts?.ready) await document.fonts.ready;
          }, mode);
          if (shot.action === "rsvp" || shot.action === "waitlist") {
            const cancel = page.getByRole("button", { name: "Cancel RSVP", exact: true });
            if ((await cancel.count()) > 0) {
              await cancel.click();
              await page.getByRole("button", { name: "I'm going", exact: true }).waitFor();
            }
            await page.getByRole("button", { name: "I'm going", exact: true }).click();
            await page.getByText(/You're (going|on the list)!/).waitFor();
          } else if (shot.action === "share") {
            await page.getByRole("button", { name: "Share event" }).click();
            await page.getByRole("dialog", { name: "Share event" }).waitFor();
            await page.getByAltText("Share card preview").evaluate(async (image) => {
              if (image.complete && image.naturalWidth > 0) return;
              await new Promise((resolve) => {
                image.addEventListener("load", resolve, { once: true });
                image.addEventListener("error", resolve, { once: true });
              });
            });
          } else if (shot.action === "ticket") {
            const generate = page.getByRole("button", { name: /Generate ticket|Show a new code/ });
            await generate.click();
            await page.getByLabel("Ticket QR code").waitFor();
          } else if (shot.action === "offline") {
            await context.setOffline(true);
            await page.getByLabel("Ticket code").fill("OFFLINE_DEMO_TICKET_0001");
            await page.getByRole("button", { name: "Check in", exact: true }).click();
            await page.getByText(/queued scan waiting/).waitFor({ timeout: 15_000 });
          }
          await page.waitForTimeout(450);

          const filename = `${shot.name}-${mode}-${vp.label}.png`;
          await page.screenshot({ path: path.join(OUT_DIR, filename), fullPage: false });
          if (shot.action === "offline") await context.setOffline(false);
        }

        await context.close();
      }
    }
    console.log(`Captured ${SHOTS.length * 2}+ screenshots into design/review/`);
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
