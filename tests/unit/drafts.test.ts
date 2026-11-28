import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDebouncedTask } from "@/lib/client/debounce";
import { isStaleDraftWrite, nextDraftVersion } from "@/lib/posts/draft-version";

describe("draft debounce", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("collapses a typing burst into one trailing write", async () => {
    const writes: string[] = [];
    const saver = createDebouncedTask<string>((value) => {
      writes.push(value);
    }, 300);

    saver.schedule("h");
    saver.schedule("he");
    saver.schedule("hel");
    expect(writes).toEqual([]);
    await vi.advanceTimersByTimeAsync(299);
    expect(writes).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(writes).toEqual(["hel"]);
  });

  it("cancel drops the pending write and flush runs it immediately", async () => {
    const writes: string[] = [];
    const saver = createDebouncedTask<string>((value) => {
      writes.push(value);
    }, 300);
    saver.schedule("discarded");
    saver.cancel();
    await vi.advanceTimersByTimeAsync(500);
    expect(writes).toEqual([]);

    saver.schedule("flush me");
    saver.flush();
    expect(writes).toEqual(["flush me"]);
    await vi.advanceTimersByTimeAsync(500);
    expect(writes).toEqual(["flush me"]);
  });
});

describe("draft versioning", () => {
  const now = new Date("2026-11-27T10:00:00.000Z");
  const earlier = new Date("2026-11-27T09:59:00.000Z");

  it("rejects an older version", () => {
    expect(isStaleDraftWrite({ version: 1, clientTime: now }, { version: 2, clientTime: earlier })).toBe(true);
  });

  it("accepts a newer version even with an older device clock", () => {
    expect(isStaleDraftWrite({ version: 3, clientTime: earlier }, { version: 2, clientTime: now })).toBe(false);
  });

  it("at the same version, the newer device time wins", () => {
    expect(isStaleDraftWrite({ version: 2, clientTime: earlier }, { version: 2, clientTime: now })).toBe(true);
    expect(isStaleDraftWrite({ version: 2, clientTime: now }, { version: 2, clientTime: earlier })).toBe(false);
  });

  it("treats a first write and equal timestamps as acceptable", () => {
    expect(isStaleDraftWrite({ clientTime: earlier }, { version: 4, clientTime: now })).toBe(false);
    expect(isStaleDraftWrite({ version: 2, clientTime: now }, { version: 2, clientTime: now })).toBe(false);
  });

  it("always advances the stored version", () => {
    expect(nextDraftVersion(undefined, 1)).toBe(2);
    expect(nextDraftVersion(2, 2)).toBe(3);
    expect(nextDraftVersion(5, 2)).toBe(6);
  });
});
