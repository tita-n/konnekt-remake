import "server-only";
// Idempotency claims are user-scoped infrastructure, not tenant content.
// eslint-disable-next-line no-restricted-imports
import { platformDb } from "@/lib/db/platform";

/**
 * Exactly-once user intents.
 *
 * A mutating request may carry an `Idempotency-Key`. The first request claims
 * the key in one atomic insert; a duplicate waits for the original result and
 * replays it instead of running the handler again. Failed (5xx) attempts release
 * the claim so the client can retry. Records expire after 24 hours and are
 * scoped to one user, so two students can never see each other's result.
 */
export const IDEMPOTENCY_HEADER = "idempotency-key";
const TTL_MS = 24 * 60 * 60 * 1000;
const WAIT_STEP_MS = 40;
const WAIT_ROUNDS = 25;

export function idempotencyKeyFrom(request: Request): string | null {
  const key = request.headers.get(IDEMPOTENCY_HEADER)?.trim();
  if (!key || key.length > 120) return null;
  return key;
}

function replay(record: { status: number | null; response: string | null }): Response {
  if (record.status === null || record.response === null) {
    return Response.json({ error: "That request is still being processed." }, { status: 409 });
  }
  return new Response(record.response, {
    status: record.status,
    headers: { "Content-Type": "application/json", "Idempotency-Replayed": "true" },
  });
}

export async function withIdempotency(
  request: Request,
  userId: string,
  handler: () => Promise<Response>,
): Promise<Response> {
  const key = idempotencyKeyFrom(request);
  if (!key) return handler();

  // Claim atomically. `createMany` with skipDuplicates is one insert and is
  // safe under concurrent identical requests.
  const claimed = await platformDb.idempotencyRecord.createMany({
    data: [{ userId, key }],
    skipDuplicates: true,
  });

  if (claimed.count === 0) {
    for (let round = 0; round < WAIT_ROUNDS; round += 1) {
      const existing = await platformDb.idempotencyRecord.findUnique({
        where: { userId_key: { userId, key } },
        select: { status: true, response: true },
      });
      if (!existing) break;
      if (existing.status !== null && existing.response !== null) return replay(existing);
      await new Promise((resolve) => setTimeout(resolve, WAIT_STEP_MS));
    }
    return Response.json({ error: "That request is still being processed." }, { status: 409 });
  }

  let response: Response;
  try {
    response = await handler();
  } catch (error) {
    await platformDb.idempotencyRecord.deleteMany({ where: { userId, key } });
    throw error;
  }

  if (response.status >= 500) {
    await platformDb.idempotencyRecord.deleteMany({ where: { userId, key } });
    return response;
  }

  const text = await response.clone().text();
  await platformDb.idempotencyRecord.update({
    where: { userId_key: { userId, key } },
    data: { status: response.status, response: text, completedAt: new Date() },
  });
  // Lazy cleanup keeps the table small without a scheduled job.
  if (Math.random() < 0.02) {
    await platformDb.idempotencyRecord
      .deleteMany({ where: { createdAt: { lt: new Date(Date.now() - TTL_MS) } } })
      .catch(() => undefined);
  }
  return response;
}
