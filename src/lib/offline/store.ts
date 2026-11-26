"use client";

import type { PostView } from "@/lib/posts/types";

/**
 * Per-account offline storage. Every key is namespaced by user id, the whole
 * database and all Cache Storage entries are deleted on logout, and nothing is
 * written for anonymous visitors. This is what keeps a shared phone from
 * leaking one student's feed to the next.
 */
const DB_NAME = "konnekt-offline";
const DB_VERSION = 2;
const FEED_STORE = "feeds";
const OUTBOX_STORE = "outbox";
const CHECKIN_STORE = "checkins";

export interface CachedFeed {
  userId: string;
  filter: string;
  savedAt: string;
  posts: PostView[];
}

export interface OutboxItem {
  id: string;
  userId: string;
  createdAt: string;
  attempts: number;
  status: "sending" | "failed";
  error?: string;
  payload: Record<string, unknown>;
}

/**
 * A scan captured on a staff device. `id` is the clientScanId sent to the
 * server, so replaying the same row can never check a student in twice. Rows
 * are deleted only after the server confirms the scan or a duplicate.
 */
export interface QueuedCheckIn {
  id: string;
  eventId: string;
  method: "QR" | "MANUAL";
  code?: string;
  userId?: string;
  createdAt: string;
  attempts: number;
  status: "pending" | "failed";
  error?: string;
}

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(FEED_STORE)) db.createObjectStore(FEED_STORE, { keyPath: "userId" });
      if (!db.objectStoreNames.contains(OUTBOX_STORE)) db.createObjectStore(OUTBOX_STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(CHECKIN_STORE)) db.createObjectStore(CHECKIN_STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    const transaction = db.transaction(storeName, mode);
    const request = run(transaction.objectStore(storeName));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    transaction.oncomplete = () => db.close();
  });
}

export async function cacheFeed(userId: string, filter: string, posts: PostView[]): Promise<void> {
  await withStore<IDBValidKey>(FEED_STORE, "readwrite", (store) =>
    store.put({ userId, filter, savedAt: new Date().toISOString(), posts } satisfies CachedFeed),
  );
}

export async function readCachedFeed(userId: string): Promise<CachedFeed | null> {
  const value = await withStore<CachedFeed | undefined>(FEED_STORE, "readonly", (store) => store.get(userId));
  return value ?? null;
}

export async function readLatestCachedFeed(): Promise<CachedFeed | null> {
  const rows = await withStore<CachedFeed[]>(FEED_STORE, "readonly", (store) => store.getAll());
  return (rows ?? []).sort((a, b) => b.savedAt.localeCompare(a.savedAt))[0] ?? null;
}

export async function enqueueOutbox(item: OutboxItem): Promise<void> {
  await withStore<IDBValidKey>(OUTBOX_STORE, "readwrite", (store) => store.put(item));
}

export async function listOutbox(userId: string): Promise<OutboxItem[]> {
  const rows = await withStore<OutboxItem[]>(OUTBOX_STORE, "readonly", (store) => store.getAll());
  return (rows ?? []).filter((item) => item.userId === userId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function removeOutbox(id: string): Promise<void> {
  await withStore<undefined>(OUTBOX_STORE, "readwrite", (store) => store.delete(id));
}

export async function updateOutbox(item: OutboxItem): Promise<void> {
  await withStore<IDBValidKey>(OUTBOX_STORE, "readwrite", (store) => store.put(item));
}

export async function enqueueCheckIn(item: QueuedCheckIn): Promise<void> {
  await withStore<IDBValidKey>(CHECKIN_STORE, "readwrite", (store) => store.put(item));
}

export async function listQueuedCheckIns(eventId: string): Promise<QueuedCheckIn[]> {
  const rows = await withStore<QueuedCheckIn[]>(CHECKIN_STORE, "readonly", (store) => store.getAll());
  return (rows ?? [])
    .filter((item) => item.eventId === eventId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function updateQueuedCheckIn(item: QueuedCheckIn): Promise<void> {
  await withStore<IDBValidKey>(CHECKIN_STORE, "readwrite", (store) => store.put(item));
}

export async function removeQueuedCheckIn(id: string): Promise<void> {
  await withStore<undefined>(CHECKIN_STORE, "readwrite", (store) => store.delete(id));
}

/**
 * Wipes every trace of the signed-in account from this device: Cache Storage,
 * the offline database (feeds and outbox), and account-scoped localStorage.
 * The service worker is told to drop caches too, in case it holds a precache
 * entry not visible to this document.
 */
export async function clearKonnektClientData(): Promise<void> {
  try {
    navigator.serviceWorker?.controller?.postMessage({ type: "KONNEKT_CLEAR_CACHES" });
  } catch {
    // Worker may not be controlling the page yet.
  }
  try {
    if (typeof caches !== "undefined") {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch {
    // Cache Storage can be unavailable in private modes.
  }
  try {
    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase(DB_NAME);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
    });
  } catch {
    // Nothing else to clear.
  }
  try {
    for (const storage of [localStorage, sessionStorage]) {
      const keys = Object.keys(storage).filter((key) => key.startsWith("konnekt"));
      for (const key of keys) storage.removeItem(key);
    }
  } catch {
    // Storage may be blocked.
  }
}

/** Retry queued posts once per item; successful ones are removed. */
export async function flushOutbox(userId: string): Promise<{ sent: number; failed: number }> {
  const items = await listOutbox(userId);
  let sent = 0;
  let failed = 0;
  for (const item of items) {
    if (!navigator.onLine) break;
    try {
      const response = await fetch("/api/posts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": item.id,
          "x-konnekt-csrf":
            document.cookie.match(/(?:^|;\s*)konnekt_csrf=([^;]+)/)?.[1]?.replace(/^/, "") ?? "",
        },
        body: JSON.stringify(item.payload),
      });
      if (response.ok) {
        await removeOutbox(item.id);
        sent += 1;
        continue;
      }
      if (response.status >= 500) break;
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      await updateOutbox({ ...item, status: "failed", attempts: item.attempts + 1, error: data.error ?? "Couldn't send." });
      failed += 1;
    } catch {
      await updateOutbox({ ...item, attempts: item.attempts + 1 });
      break;
    }
  }
  return { sent, failed };
}
