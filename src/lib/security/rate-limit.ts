import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env, hasRedis, isProduction } from "@/lib/env";
import { recordRedisCommand } from "@/lib/perf/trace";

/**
 * Sliding-window rate limits. Redis in deployed environments; an in-process
 * store in dev/test. If Redis is configured but unreachable we fail closed
 * rather than silently removing protection.
 */
export interface Policy {
  limit: number;
  windowSeconds: number;
}

export const POLICIES = {
  signup: { limit: 5, windowSeconds: 60 * 60 },
  login: { limit: 10, windowSeconds: 10 * 60 },
  loginIdentifier: { limit: 5, windowSeconds: 10 * 60 },
  passwordResetRequest: { limit: 3, windowSeconds: 60 * 60 },
  passwordResetComplete: { limit: 10, windowSeconds: 60 * 60 },
  emailCodeSend: { limit: 3, windowSeconds: 10 * 60 },
  emailCodeSendIp: { limit: 10, windowSeconds: 60 * 60 },
  emailCodeVerify: { limit: 6, windowSeconds: 10 * 60 },
  upload: { limit: 12, windowSeconds: 60 * 60 },
  usernameCheck: { limit: 60, windowSeconds: 60 },
  vouchRequest: { limit: 3, windowSeconds: 24 * 60 * 60 },
  waitlist: { limit: 5, windowSeconds: 60 * 60 },
  adminMutation: { limit: 120, windowSeconds: 60 },
  dataExport: { limit: 3, windowSeconds: 24 * 60 * 60 },
  postCreate: { limit: 10, windowSeconds: 60 * 60 },
  repost: { limit: 30, windowSeconds: 60 * 60 },
  draftSave: { limit: 120, windowSeconds: 60 * 60 },
  commentCreate: { limit: 5, windowSeconds: 60 },
  commentCreateHourly: { limit: 60, windowSeconds: 60 * 60 },
  reaction: { limit: 120, windowSeconds: 60 },
  report: { limit: 20, windowSeconds: 24 * 60 * 60 },
  pollVote: { limit: 60, windowSeconds: 60 * 60 },
  communityCreate: { limit: 3, windowSeconds: 24 * 60 * 60 },
  communityJoin: { limit: 20, windowSeconds: 24 * 60 * 60 },
  communityInvite: { limit: 50, windowSeconds: 24 * 60 * 60 },
  communityMemberAction: { limit: 120, windowSeconds: 60 * 60 },
  communityResource: { limit: 20, windowSeconds: 24 * 60 * 60 },
  communityNameCheck: { limit: 120, windowSeconds: 60 },
  uploadSign: { limit: 40, windowSeconds: 60 * 60 },
  mentionSearch: { limit: 120, windowSeconds: 60 },
  // Accounts younger than 24 hours get a reduced budget under a separate key,
  // so the stricter window can never inherit a cached looser limiter.
  postCreateYoung: { limit: 5, windowSeconds: 60 * 60 },
  commentCreateYoung: { limit: 3, windowSeconds: 60 },
  commentCreateHourlyYoung: { limit: 20, windowSeconds: 60 * 60 },
  reactionYoung: { limit: 60, windowSeconds: 60 },
  reportYoung: { limit: 5, windowSeconds: 24 * 60 * 60 },
  pollVoteYoung: { limit: 30, windowSeconds: 60 * 60 },
  eventCreate: { limit: 3, windowSeconds: 24 * 60 * 60 },
  eventRsvp: { limit: 60, windowSeconds: 60 * 60 },
  eventComment: { limit: 5, windowSeconds: 60 },
  eventCommentHourly: { limit: 60, windowSeconds: 60 * 60 },
  eventUpdate: { limit: 20, windowSeconds: 60 * 60 },
  eventCheckIn: { limit: 600, windowSeconds: 60 * 60 },
  eventTicketRegenerate: { limit: 5, windowSeconds: 24 * 60 * 60 },
  eventCsvExport: { limit: 10, windowSeconds: 24 * 60 * 60 },
  eventShareCard: { limit: 20, windowSeconds: 60 * 60 },
  announcementCreate: { limit: 10, windowSeconds: 24 * 60 * 60 },
  announcementCritical: { limit: 2, windowSeconds: 24 * 60 * 60 },
  announcementAck: { limit: 120, windowSeconds: 60 * 60 },
  announcementCron: { limit: 30, windowSeconds: 10 * 60 },
} as const satisfies Record<string, Policy>;

export type PolicyName = keyof typeof POLICIES;

export interface LimitResult {
  success: boolean;
  remaining: number;
  resetSeconds: number;
}

const memory = new Map<string, number[]>();

function memoryLimit(key: string, policy: Policy): LimitResult {
  const now = Date.now();
  const windowStart = now - policy.windowSeconds * 1000;
  const existing = (memory.get(key) ?? []).filter((t) => t > windowStart);
  const success = existing.length < policy.limit;
  if (success) existing.push(now);
  memory.set(key, existing);
  if (memory.size > 5000) {
    for (const [k, hits] of memory) {
      if (hits.every((t) => t <= windowStart)) memory.delete(k);
    }
  }
  const oldest = existing[0] ?? now;
  return {
    success,
    remaining: Math.max(0, policy.limit - existing.length),
    resetSeconds: Math.max(1, Math.ceil((oldest + policy.windowSeconds * 1000 - now) / 1000)),
  };
}

let redis: Redis | null = null;
const limiters = new Map<string, Ratelimit>();

function limiterFor(name: PolicyName, policy: Policy): Ratelimit | null {
  if (!hasRedis) return null;
  const cached = limiters.get(name);
  if (cached) return cached;
  redis ??= new Redis({ url: env.UPSTASH_REDIS_REST_URL!, token: env.UPSTASH_REDIS_REST_TOKEN! });
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(policy.limit, `${policy.windowSeconds} s`),
    prefix: `konnekt:rl:${name}`,
    analytics: false,
  });
  limiters.set(name, limiter);
  return limiter;
}

/**
 * Stricter limits for accounts younger than 24 hours. The caller passes a
 * reduced policy for new accounts; the same sliding-window machinery applies.
 */
export async function rateLimitWithPolicy(
  name: PolicyName,
  policy: Policy,
  identifier: string,
): Promise<LimitResult> {
  return limitInternal(name, policy, identifier);
}

export async function rateLimit(name: PolicyName, identifier: string): Promise<LimitResult> {
  return limitInternal(name, POLICIES[name], identifier);
}

async function limitInternal(name: PolicyName, policy: Policy, identifier: string): Promise<LimitResult> {
  const limiter = limiterFor(name, policy);
  if (!limiter) {
    if (isProduction) {
      // Should be unreachable: env validation requires Redis in production.
      console.error("[security] rate limiter unavailable in production; denying request");
      return { success: false, remaining: 0, resetSeconds: 60 };
    }
    return memoryLimit(`${name}:${identifier}`, policy);
  }
  try {
    const start = process.hrtime.bigint();
    const result = await limiter.limit(identifier);
    recordRedisCommand(Number(process.hrtime.bigint() - start) / 1_000_000);
    return {
      success: result.success,
      remaining: result.remaining,
      resetSeconds: Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)),
    };
  } catch (error) {
    console.error("[security] rate limiter error", error instanceof Error ? error.message : "unknown");
    return isProduction
      ? { success: false, remaining: 0, resetSeconds: 60 }
      : memoryLimit(`${name}:${identifier}`, policy);
  }
}

/** Reset a policy counter, used after a successful login to clear backoff. */
export async function resetRateLimit(name: PolicyName, identifier: string): Promise<void> {
  const limiter = limiterFor(name, POLICIES[name]);
  if (limiter) {
    const start = process.hrtime.bigint();
    await limiter.resetUsedTokens(identifier)
      .catch(() => undefined)
      .finally(() => recordRedisCommand(Number(process.hrtime.bigint() - start) / 1_000_000));
  } else {
    memory.delete(`${name}:${identifier}`);
  }
}

/** Test helper: clear the in-memory limiter store. */
export function __resetMemoryRateLimits(): void {
  memory.clear();
}
