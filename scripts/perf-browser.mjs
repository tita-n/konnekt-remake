#!/usr/bin/env node
/**
 * Browser-side journey timing under a Lagos-like network profile:
 * 200 ms added latency, 1.6 Mbps down, 4x CPU slowdown. Uses a database
 * session so no password or Turnstile flow is involved. Local only.
 */
import { createHash, createHmac, randomBytes } from "node:crypto";
import { chromium } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3100";
const STUDENT = process.env.PERF_STUDENT ?? "student@nova.edu.ng";

const sha256 = (value) => createHash("sha256").update(value, "utf8").digest("hex");

async function main() {
  const db = new PrismaClient();
  const student = await db.user.findFirst({ where: { email: STUDENT }, select: { id: true, universityId: true } });
  if (!student) throw new Error(`No seeded student ${STUDENT}`);
  const token = randomBytes(32).toString("base64url");
  await db.session.create({
    data: { userId: student.id, universityId: student.universityId, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 3600_000) },
  });
  const csrf = createHmac("sha256", process.env.AUTH_SECRET ?? "").update(`csrf:${token}`).digest("hex");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addCookies([
    { name: "konnekt_session", value: token, url: BASE, httpOnly: true },
    { name: "konnekt_csrf", value: csrf, url: BASE },
  ]);
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 200,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });

  const rows = [];
  for (const [name, path] of [
    ["welcome", "/"],
    ["login", "/login"],
    ["pulse (first paint)", "/pulse"],
    ["communities hub", "/communities"],
    ["events hub", "/events"],
  ]) {
    const started = Date.now();
    const response = await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    const ttfb = await page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0];
      return nav ? Math.round(nav.responseStart) : 0;
    });
    await page.waitForTimeout(300);
    const paints = await page.evaluate(() =>
      performance.getEntriesByType("paint").map((entry) => ({ name: entry.name, start: Math.round(entry.startTime) })),
    );
    const fcp = paints.find((p) => p.name === "first-contentful-paint")?.start ?? null;
    const js = await page.evaluate(() =>
      performance
        .getEntriesByType("resource")
        .filter((entry) => entry.name.endsWith(".js"))
        .reduce((sum, entry) => sum + (entry.transferSize || 0), 0),
    );
    rows.push({ name, status: response?.status(), ttfb, fcp, total: Date.now() - started, jsBytes: js });
    console.log(`${name.padEnd(22)} ${response?.status()} ttfb ${ttfb}ms fcp ${fcp ?? "-"}ms js ${Math.round(js / 1024)}kB`);
  }

  await browser.close();
  await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
  await db.$disconnect();
  console.log(JSON.stringify({ measuredAt: new Date().toISOString(), profile: "latency 200ms, 1.6Mbps, 4x CPU", rows }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
