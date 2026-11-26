import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { timingSafeEqual } from "node:crypto";
import { hostOf, nearestRank, regionSegment } from "@/lib/perf/region";
// Diagnostics are infrastructure: they must measure the real unscoped connection.
// eslint-disable-next-line no-restricted-imports
import { platformDb } from "@/lib/db/platform";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Staging-only region diagnostics.
 *
 * Protected by the same `PERF_TRACE_SECRET` used for the opt-in performance
 * trace, supplied as `x-perf-trace`. Without the secret the route is a 404, so
 * it is indistinguishable from any other absent route. It reports only the
 * function region, the database/Redis region *segments* and round-trip times —
 * never a hostname, credential or connection string.
 */
function secretMatches(header: string | null): boolean {
  const secret = process.env.PERF_TRACE_SECRET?.trim();
  if (!secret || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function measure(fn: () => Promise<unknown>, rounds: number): Promise<{ coldMs: number; warmMs: number; samples: number }> {
  const samples: number[] = [];
  for (let i = 0; i < rounds; i += 1) {
    const start = process.hrtime.bigint();
    await fn();
    samples.push(Number(process.hrtime.bigint() - start) / 1_000_000);
  }
  return {
    coldMs: Number((samples[0] ?? 0).toFixed(2)),
    warmMs: nearestRank(samples.slice(1), 50),
    samples: samples.length,
  };
}

export async function GET(request: Request): Promise<NextResponse> {
  if (!secretMatches(request.headers.get("x-perf-trace"))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const databaseUrl = process.env.DATABASE_URL;
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;

  const database = await measure(async () => {
    await platformDb.$queryRaw`SELECT 1`;
  }, 5);

  let redis: { coldMs: number; warmMs: number; samples: number } | null = null;
  if (redisUrl && process.env.UPSTASH_REDIS_REST_TOKEN) {
    const client = new Redis({
      url: redisUrl,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    try {
      redis = await measure(() => client.ping(), 5);
    } catch {
      redis = null;
    }
  }

  return NextResponse.json(
    {
      functionRegion: process.env.VERCEL_REGION ?? "local",
      databaseRegion: regionSegment(hostOf(databaseUrl)),
      redisRegion: process.env.UPSTASH_REGION ?? regionSegment(hostOf(redisUrl)),
      database,
      redis,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
