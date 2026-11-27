#!/usr/bin/env node
/**
 * Warm-path journey measurement against a running local production server.
 *
 * Creates a database session directly (never a password flow) and calls the
 * same API endpoints the app uses, with `x-perf-trace` so the server returns
 * Server-Timing. Reports TTFB, server total, database queries, Redis commands
 * and payload bytes. It writes no secrets and is safe to run against local
 * development data only.
 *
 * Usage: BASE_URL=http://127.0.0.1:3100 PERF_TRACE_SECRET=... DATABASE_URL=... node scripts/perf-journeys.mjs
 */
import { createHash, randomBytes, createHmac } from "node:crypto";
import { writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3100";
const SECRET = process.env.PERF_TRACE_SECRET ?? "local-perf-trace-secret";
const STUDENT = process.env.PERF_STUDENT ?? "student@nova.edu.ng";

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function parseTiming(header) {
  const out = {};
  for (const part of (header ?? "").split(",")) {
    const [name, ...attrs] = part.trim().split(";");
    const entry = {};
    for (const attr of attrs) {
      const [key, ...rest] = attr.split("=");
      entry[key] = rest.join("=").replace(/^"|"$/g, "");
    }
    if (name) out[name] = entry;
  }
  return out;
}

function pct(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return Number(sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)].toFixed(1));
}

async function main() {
  const db = new PrismaClient();
  const student = await db.user.findFirst({
    where: { email: STUDENT },
    select: { id: true, universityId: true },
  });
  if (!student) throw new Error(`No seeded student ${STUDENT}`);

  const token = randomBytes(32).toString("base64url");
  await db.session.create({
    data: {
      userId: student.id,
      universityId: student.universityId,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
  const authSecret = process.env.AUTH_SECRET ?? "";
  const csrf = authSecret
    ? createHmac("sha256", authSecret).update(`csrf:${token}`).digest("hex")
    : "";
  const cookie = `konnekt_session=${token}; konnekt_csrf=${csrf}`;

  const journeys = [
    { name: "welcome", method: "GET", path: "/", anon: true, kind: "page" },
    { name: "login", method: "GET", path: "/login", anon: true, kind: "page" },
    { name: "pulse feed (first)", method: "GET", path: "/api/feed?filter=all", kind: "api" },
    { name: "pulse feed (next page)", method: "GET", path: "/api/feed?filter=all&cursor=__CURSOR__", kind: "api" },
    { name: "communities hub", method: "GET", path: "/api/communities", kind: "api" },
    { name: "events hub", method: "GET", path: "/api/events?tab=for-you", kind: "api" },
    { name: "pulse page (html)", method: "GET", path: "/pulse", kind: "page" },
  ];

  if (process.env.PERF_POST_ID) {
    journeys.push(
      { name: "post detail", method: "GET", path: `/api/posts/${process.env.PERF_POST_ID}`, kind: "api" },
    );
  }
  if (process.env.PERF_EVENT_ID) {
    journeys.push(
      { name: "event detail", method: "GET", path: `/api/events/${process.env.PERF_EVENT_ID}`, kind: "api" },
    );
  }

  // Resolve a real cursor from the first feed page.
  let cursor = null;
  try {
    const first = await fetch(`${BASE}/api/feed?filter=all`, {
      headers: { cookie, "x-perf-trace": SECRET },
    });
    const body = await first.json();
    cursor = body?.nextCursor ?? null;
  } catch {
    /* the journey row below will show the failure */
  }

  const results = [];
  for (const journey of journeys) {
    const path = journey.path.replace("__CURSOR__", encodeURIComponent(cursor ?? ""));
    if (journey.name.includes("next page") && !cursor) continue;
    const samples = [];
    for (let i = 0; i < 5; i += 1) {
      const start = performance.now();
      const response = await fetch(`${BASE}${path}`, {
        headers: {
          ...(journey.anon ? {} : { cookie }),
          "x-perf-trace": SECRET,
          ...(journey.anon ? {} : {}),
        },
        redirect: "manual",
      });
      const body = await response.arrayBuffer();
      const wall = performance.now() - start;
      const timing = parseTiming(response.headers.get("server-timing"));
      samples.push({
        wallMs: wall,
        status: response.status,
        bytes: body.byteLength,
        totalMs: Number(timing.total?.dur ?? 0),
        authMs: Number(timing.auth?.dur ?? 0),
        dbMs: Number(timing.db?.dur ?? 0),
        dbQueries: Number(String(timing.db?.desc ?? "0").split(" ")[0] ?? 0),
        redisMs: Number(timing.redis?.dur ?? 0),
        redisCommands: Number(String(timing.redis?.desc ?? "0").split(" ")[0] ?? 0),
      });
    }
    const ok = samples.filter((s) => s.status < 400);
    const usable = ok.length ? ok : samples;
    results.push({
      name: journey.name,
      path,
      status: samples[0]?.status,
      ttfbMs: pct(usable.map((s) => s.wallMs), 50),
      serverMs: pct(usable.map((s) => s.totalMs), 50),
      dbQueries: pct(usable.map((s) => s.dbQueries), 50),
      redisCommands: pct(usable.map((s) => s.redisCommands), 50),
      bytes: Math.max(...usable.map((s) => s.bytes)),
    });
    console.log(
      `${journey.name.padEnd(26)} ${String(samples[0]?.status).padEnd(4)} wall ${pct(usable.map((s) => s.wallMs), 50)}ms  server ${pct(usable.map((s) => s.totalMs), 50)}ms  db ${pct(usable.map((s) => s.dbQueries), 50)}q  redis ${pct(usable.map((s) => s.redisCommands), 50)}c  ${Math.max(...usable.map((s) => s.bytes))}B`,
    );
  }

  await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
  await db.$disconnect();
  writeFileSync("perf/journeys.local.json", JSON.stringify({ base: BASE, measuredAt: new Date().toISOString(), results }, null, 2));
  console.log("\nWrote perf/journeys.local.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
