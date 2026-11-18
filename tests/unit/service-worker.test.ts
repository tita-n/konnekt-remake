import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "../..");
const serviceWorker = readFileSync(join(root, "src/app/sw.ts"), "utf8");
const logout = readFileSync(join(root, "src/components/app/logout-button.tsx"), "utf8");
const offlineStore = readFileSync(join(root, "src/lib/offline/store.ts"), "utf8");
const nextConfig = readFileSync(join(root, "next.config.ts"), "utf8");

describe("service worker privacy boundary", () => {
  it("never uses the default cache-on-fetch runtime for app responses", () => {
    expect(serviceWorker).not.toContain("defaultCache");
    expect(serviceWorker).not.toMatch(/StaleWhileRevalidate|CacheFirst[\s\S]{0,200}html/i);
  });

  it("forces API responses to the network and every navigation is network-only", () => {
    expect(serviceWorker).toMatch(/NetworkOnly/);
    expect(serviceWorker).toMatch(/\/api\//);
    expect(serviceWorker).toMatch(/request\.mode === "navigate"/);
    expect(serviceWorker).toMatch(/fallbacks/);
  });

  it("keeps navigation out of the HTTP cache in Next", () => {
    expect(nextConfig).toContain("cacheOnNavigation: false");
  });

  it("logout clears caches, IndexedDB and account storage", () => {
    expect(logout).toContain("clearKonnektClientData");
    for (const call of ["caches.keys", "caches.delete", "indexedDB.deleteDatabase", "KONNEKT_CLEAR_CACHES"]) {
      expect(offlineStore).toContain(call);
    }
    expect(offlineStore).toMatch(/localStorage/);
  });
});
