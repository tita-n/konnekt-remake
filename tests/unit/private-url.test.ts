import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const CLOUDINARY_ENV = {
  CLOUDINARY_CLOUD_NAME: "konnekt-test",
  CLOUDINARY_API_KEY: "123456789012345",
  CLOUDINARY_API_SECRET: "test-secret",
};

const BASE_ENV = {
  DATABASE_URL: "postgresql://user:pass@127.0.0.1:5432/konnekt_test",
  AUTH_SECRET: "0123456789abcdef0123456789abcdef01234567",
  APP_URL: "http://127.0.0.1:3000",
  TURNSTILE_BYPASS: "1",
};

async function loadStore() {
  vi.resetModules();
  return import("@/lib/media/private-store");
}

function param(url: string, name: string): string {
  const value = new URL(url).searchParams.get(name);
  expect(value, `missing ${name} in ${url}`).not.toBeNull();
  return value!;
}

describe("signed private image URLs", () => {
  beforeEach(() => {
    vi.resetModules();
    for (const [key, value] of Object.entries({ ...BASE_ENV, ...CLOUDINARY_ENV })) vi.stubEnv(key, value);
    vi.stubEnv("NODE_ENV", "test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("signs an authenticated image download whose expiry is part of the signature", async () => {
    const { signedPrivateUrl } = await loadStore();
    const before = Math.floor(Date.now() / 1000);
    const url = signedPrivateUrl("konnekt/id-cards/abc123", 120)!;
    const after = Math.floor(Date.now() / 1000);

    expect(url).toMatch(/^https:\/\/api\.cloudinary\.com\/v1_1\/konnekt-test\/image\/download\?/);
    expect(param(url, "public_id")).toBe("konnekt/id-cards/abc123");
    expect(param(url, "type")).toBe("authenticated");
    expect(param(url, "attachment")).toBe("true");
    expect(param(url, "signature")).toMatch(/^[a-f0-9]{40}$/);
    expect(Number(param(url, "expires_at"))).toBeGreaterThanOrEqual(before + 120);
    expect(Number(param(url, "expires_at"))).toBeLessThanOrEqual(after + 120);
    expect(url).not.toContain("/upload/");

    const later = signedPrivateUrl("konnekt/id-cards/abc123", 600)!;
    expect(Number(param(later, "expires_at"))).toBeGreaterThan(Number(param(url, "expires_at")));
    expect(param(later, "signature")).not.toBe(param(url, "signature"));
  });

  it("refuses local keys and unconfigured storage", async () => {
    const { signedPrivateUrl } = await loadStore();
    expect(signedPrivateUrl("local:abc", 120)).toBeNull();

    vi.unstubAllEnvs();
    vi.stubEnv("NODE_ENV", "test");
    for (const [key, value] of Object.entries(BASE_ENV)) vi.stubEnv(key, value);
    const { signedPrivateUrl: unconfigured } = await loadStore();
    expect(unconfigured("konnekt/id-cards/abc", 120)).toBeNull();
  });
});
