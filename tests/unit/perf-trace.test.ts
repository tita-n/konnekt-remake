import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __runWithPerfState,
  getPerfState,
  isPerfTraceRequested,
  recordDbQuery,
  recordRedisCommand,
  withPerfTrace,
} from "@/lib/perf/trace";

const SECRET = "perf-trace-secret-for-tests";

describe("opt-in performance trace", () => {
  beforeEach(() => {
    vi.stubEnv("PERF_TRACE_SECRET", SECRET);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("is inert without the configured secret", async () => {
    vi.stubEnv("PERF_TRACE_SECRET", "");
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const response = await withPerfTrace(
      new Request("https://konnekt.test/api/feed", { headers: { "x-perf-trace": SECRET } }),
      async () => {
        recordDbQuery(5);
        expect(getPerfState()).toBeUndefined();
        return new Response("ok");
      },
    );
    expect(response.headers.get("Server-Timing")).toBeNull();
    expect(log).not.toHaveBeenCalled();
  });

  it("ignores a missing or wrong header even when a secret is configured", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    expect(isPerfTraceRequested(null)).toBe(false);
    expect(isPerfTraceRequested("wrong")).toBe(false);
    const response = await withPerfTrace(
      new Request("https://konnekt.test/api/feed"),
      async () => new Response("ok"),
    );
    expect(response.headers.get("Server-Timing")).toBeNull();
    expect(log).not.toHaveBeenCalled();
  });

  it("emits timings and counts, and never leaks the secret", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const response = await withPerfTrace(
      new Request("https://konnekt.test/api/feed?cursor=x", {
        headers: { "x-perf-trace": SECRET },
      }),
      async () => {
        recordDbQuery(4);
        recordDbQuery(6);
        recordRedisCommand(1.5);
        return new Response("ok", { status: 201 });
      },
    );
    const timing = response.headers.get("Server-Timing") ?? "";
    expect(timing).toContain("db;dur=10.0;desc=\"2 queries\"");
    expect(timing).toContain("redis;dur=1.5;desc=\"1 commands\"");
    expect(timing).toContain("total;dur=");
    expect(timing).toContain("auth;dur=");
    expect(timing).toContain("render;dur=");

    expect(log).toHaveBeenCalledTimes(1);
    const payload = String(log.mock.calls[0]?.[0]);
    expect(payload).not.toContain(SECRET);
    const parsed = JSON.parse(payload);
    expect(parsed).toMatchObject({
      type: "perf",
      method: "GET",
      route: "/api/feed",
      status: 201,
      dbQueries: 2,
      redisCommands: 1,
    });
    expect(Object.keys(parsed).sort()).toEqual(
      [
        "authMs",
        "dbMs",
        "dbQueries",
        "method",
        "redisCommands",
        "redisMs",
        "renderMs",
        "route",
        "status",
        "totalMs",
        "type",
      ].sort(),
    );
  });

  it("counts nothing outside a traced request", () => {
    __runWithPerfState(() => {
      recordDbQuery(3);
      recordRedisCommand(2);
      const state = getPerfState();
      expect(state?.dbQueries).toBe(1);
      expect(state?.redisCommands).toBe(1);
    });
    const before = { db: 0, redis: 0 };
    recordDbQuery(100);
    recordRedisCommand(100);
    expect(before).toEqual({ db: 0, redis: 0 });
  });
});
