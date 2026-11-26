import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ rateLimitSuccess: true }));

vi.mock("@/lib/security/rate-limit", () => ({
  rateLimit: vi.fn(async () => ({
    success: state.rateLimitSuccess,
    remaining: state.rateLimitSuccess ? 1 : 0,
    resetSeconds: 60,
  })),
}));
vi.mock("@/lib/db/platform", () => ({
  platformDb: { university: { findMany: vi.fn(async () => []) } },
}));
vi.mock("@/lib/db/tenant", () => ({ tenantDb: vi.fn() }));
vi.mock("@/lib/services/announcements", () => ({
  publishDueAnnouncements: vi.fn(async () => ({ published: 0 })),
}));

import { GET } from "@/app/api/cron/announcements/route";

function request(headers: Record<string, string> = {}) {
  return new NextRequest("https://konnekt.test/api/cron/announcements", { headers });
}

describe("announcement cron route", () => {
  beforeEach(() => {
    state.rateLimitSuccess = true;
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ANNOUNCEMENT_CRON_SECRET", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("fails closed when the secret is missing in production", async () => {
    const response = await GET(request({ authorization: "Bearer anything" }));
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Not authorised." });
  });

  it("rejects a wrong bearer secret and a wrong query secret", async () => {
    vi.stubEnv("ANNOUNCEMENT_CRON_SECRET", "the-real-secret");
    expect((await GET(request({ authorization: "Bearer wrong" }))).status).toBe(401);
    expect((await GET(request())).status).toBe(401);
  });

  it("rate-limits before it reads the secret, so a flood cannot reach the database", async () => {
    state.rateLimitSuccess = false;
    const response = await GET(request({ authorization: "Bearer anything" }));
    expect(response.status).toBe(429);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
