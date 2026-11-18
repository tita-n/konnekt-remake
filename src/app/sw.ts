/// <reference lib="webworker" />
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { CacheFirst, NetworkOnly, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/**
 * App-shell service worker with a deliberately narrow cache.
 *
 * Cached: hashed build assets, static icons/fonts and the offline shell.
 * Never cached: API responses, RSC payloads, HTML documents other than the
 * precached offline page, and anything carrying a session. The per-user feed
 * lives in IndexedDB instead, where it is namespaced by account and deleted on
 * logout.
 */
const STATIC_DESTINATIONS = new Set(["style", "script", "font", "image"]);

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: true,
  disableDevLogs: true,
  runtimeCaching: [
    {
      matcher: ({ url }) => url.pathname.startsWith("/api/"),
      handler: new NetworkOnly(),
    },
    {
      // Every navigation is network-only; the offline fallback below is the
      // only HTML the worker serves, and it contains no account data.
      matcher: ({ request }) => request.mode === "navigate" || request.destination === "document",
      handler: new NetworkOnly(),
    },
    {
      matcher: ({ url, request }) =>
        url.pathname.startsWith("/_next/static/") ||
        url.pathname.startsWith("/icons/") ||
        (STATIC_DESTINATIONS.has(request.destination) && !url.pathname.startsWith("/uploads/")),
      handler: new CacheFirst({ cacheName: "konnekt-static" }),
    },
  ],
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

serwist.addEventListeners();

self.addEventListener("message", (event: ExtendableMessageEvent) => {
  if (event.data?.type !== "KONNEKT_CLEAR_CACHES") return;
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
      await self.registration.unregister();
    })(),
  );
});
