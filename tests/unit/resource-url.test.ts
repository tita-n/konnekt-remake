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
  return import("@/lib/media/resource-store");
}

function param(url: string, name: string): string {
  const value = new URL(url).searchParams.get(name);
  expect(value, `missing ${name} in ${url}`).not.toBeNull();
  return value!;
}

describe("signed resource URLs", () => {
  beforeEach(() => {
    vi.resetModules();
    for (const [key, value] of Object.entries({ ...BASE_ENV, ...CLOUDINARY_ENV })) vi.stubEnv(key, value);
    vi.stubEnv("NODE_ENV", "test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("signs an authenticated, attachment-only download that expires", async () => {
    const { signedResourceUrl } = await loadStore();
    const before = Math.floor(Date.now() / 1000);
    const url = signedResourceUrl("konnekt/community-resources/abc123", "pdf", 120)!;
    const after = Math.floor(Date.now() / 1000);

    expect(url).toMatch(/^https:\/\/api\.cloudinary\.com\/v1_1\/konnekt-test\/raw\/download\?/);
    expect(param(url, "public_id")).toBe("konnekt/community-resources/abc123");
    expect(param(url, "type")).toBe("authenticated");
    expect(param(url, "attachment")).toBe("true");
    expect(param(url, "signature")).toMatch(/^[a-f0-9]{40}$/);
    expect(param(url, "api_key")).toBe(CLOUDINARY_ENV.CLOUDINARY_API_KEY);
    expect(Number(param(url, "expires_at"))).toBeGreaterThanOrEqual(before + 120);
    expect(Number(param(url, "expires_at"))).toBeLessThanOrEqual(after + 120);
    // Authenticated, signed links are never served from a public upload path.
    expect(url).not.toContain("/upload/");
  });

  it("binds the expiry into the signature so a tampered lifetime fails verification", async () => {
    const { signedResourceUrl } = await loadStore();
    const key = "konnekt/community-resources/same-file";
    const short = signedResourceUrl(key, "pdf", 30)!;
    const long = signedResourceUrl(key, "pdf", 600)!;
    expect(Number(param(long, "expires_at"))).toBeGreaterThan(Number(param(short, "expires_at")));
    expect(param(short, "signature")).not.toBe(param(long, "signature"));

    const tampered = new URL(short);
    tampered.searchParams.set("expires_at", param(long, "expires_at"));
    expect(param(tampered.toString(), "signature")).toBe(param(short, "signature"));
  });

  it("refuses to sign local development keys or anything without storage", async () => {
    const { signedResourceUrl } = await loadStore();
    expect(signedResourceUrl("local:resources/abc.pdf", "pdf")).toBeNull();

    vi.unstubAllEnvs();
    vi.stubEnv("NODE_ENV", "test");
    for (const [key, value] of Object.entries(BASE_ENV)) vi.stubEnv(key, value);
    const { signedResourceUrl: unconfigured } = await loadStore();
    expect(unconfigured("konnekt/community-resources/abc", "pdf", 120)).toBeNull();
  });
});
