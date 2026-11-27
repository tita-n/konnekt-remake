import { AsyncLocalStorage } from "node:async_hooks";
import { timingSafeEqual } from "node:crypto";

/**
 * Opt-in server timing.
 *
 * Nothing here runs unless the request carries `X-Perf-Trace` equal to the
 * `PERF_TRACE_SECRET` configured on the deployment. Without the secret the
 * header is ignored, no AsyncLocalStorage context is created, no database
 * counter is incremented beyond a cheap null check, and no timing response
 * header or log line is produced. The secret itself is never echoed, logged or
 * included in the trace.
 */
export interface PerfState {
  startedAt: number;
  authMs: number | null;
  dbMs: number;
  dbQueries: number;
  redisMs: number;
  redisCommands: number;
}

const storage = new AsyncLocalStorage<PerfState>();

export function getPerfState(): PerfState | undefined {
  return storage.getStore();
}

export function recordDbQuery(durationMs: number): void {
  const state = storage.getStore();
  if (!state) return;
  state.dbQueries += 1;
  state.dbMs += durationMs;
}

export function recordRedisCommand(durationMs: number): void {
  const state = storage.getStore();
  if (!state) return;
  state.redisCommands += 1;
  state.redisMs += durationMs;
}

/** Mark the end of authorisation so the trace can separate auth from render. */
export function markAuthComplete(): void {
  const state = storage.getStore();
  if (state && state.authMs === null) state.authMs = highResolutionNow() - state.startedAt;
}

function highResolutionNow(): number {
  return Number(process.hrtime.bigint()) / 1_000_000;
}

function secretMatches(header: string | null): boolean {
  const secret = process.env.PERF_TRACE_SECRET?.trim();
  if (!secret || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function isPerfTraceRequested(header: string | null): boolean {
  return secretMatches(header);
}

function metrics(state: PerfState, totalMs: number): string[] {
  const authMs = state.authMs ?? 0;
  const renderMs = Math.max(0, totalMs - authMs);
  return [
    `auth;dur=${authMs.toFixed(1)}`,
    `db;dur=${state.dbMs.toFixed(1)};desc="${state.dbQueries} queries"`,
    `redis;dur=${state.redisMs.toFixed(1)};desc="${state.redisCommands} commands"`,
    `render;dur=${renderMs.toFixed(1)}`,
    `total;dur=${totalMs.toFixed(1)}`,
  ];
}

/**
 * Wrap a route handler. `fn` must return a `Response`. When tracing is off the
 * handler runs exactly as before; when it is on the same response gains one
 * `Server-Timing` header and one structured log line.
 */
export async function withPerfTrace(
  request: Request,
  fn: () => Promise<Response>,
): Promise<Response> {
  const requested = isPerfTraceRequested(request.headers.get("x-perf-trace"));
  if (!requested) return fn();

  const state: PerfState = {
    startedAt: highResolutionNow(),
    authMs: null,
    dbMs: 0,
    dbQueries: 0,
    redisMs: 0,
    redisCommands: 0,
  };
  const response = await storage.run(state, fn);
  const totalMs = highResolutionNow() - state.startedAt;

  response.headers.set("Server-Timing", metrics(state, totalMs).join(", "));
  const url = new URL(request.url);
  console.log(
    JSON.stringify({
      type: "perf",
      method: request.method,
      route: url.pathname,
      status: response.status,
      authMs: Number((state.authMs ?? 0).toFixed(1)),
      dbMs: Number(state.dbMs.toFixed(1)),
      dbQueries: state.dbQueries,
      redisMs: Number(state.redisMs.toFixed(1)),
      redisCommands: state.redisCommands,
      renderMs: Number(Math.max(0, totalMs - (state.authMs ?? 0)).toFixed(1)),
      totalMs: Number(totalMs.toFixed(1)),
    }),
  );
  return response;
}

/** Test-only: run a callback inside a trace context without a request. */
export function __runWithPerfState<T>(fn: () => T): T {
  return storage.run(
    { startedAt: highResolutionNow(), authMs: null, dbMs: 0, dbQueries: 0, redisMs: 0, redisCommands: 0 },
    fn,
  );
}
