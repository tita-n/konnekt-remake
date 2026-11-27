import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { platformDb } from "@/lib/db/platform";
import { withIdempotency } from "@/lib/api/idempotency";

const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
let userId = "";

beforeAll(async () => {
  const university = await platformDb.university.create({
    data: {
      name: `Idempotency ${suffix}`,
      shortName: "IDEM",
      slug: `idem-${suffix}`,
      status: "ACTIVE",
      studentEmailDomains: [`idem-${suffix}.edu.ng`],
    },
    select: { id: true },
  });
  const user = await platformDb.user.create({
    data: {
      universityId: university.id,
      email: `idem-${suffix}@idem-${suffix}.edu.ng`,
      username: `idem${suffix}`.slice(0, 20),
      fullName: "Idempotency Student",
      passwordHash: "x",
      status: "VERIFIED",
      emailVerified: true,
    },
    select: { id: true },
  });
  userId = user.id;
});

afterAll(async () => {
  await platformDb.idempotencyRecord.deleteMany({ where: { userId } });
  const user = await platformDb.user.findUnique({ where: { id: userId }, select: { universityId: true } });
  await platformDb.user.deleteMany({ where: { id: userId } });
  if (user) await platformDb.university.delete({ where: { id: user.universityId } }).catch(() => undefined);
  await platformDb.$disconnect();
});

function request(key: string): Request {
  return new Request("https://konnekt.test/api/thing", { method: "POST", headers: { "Idempotency-Key": key } });
}

describe("exactly-once mutation claims", () => {
  it("runs a concurrent duplicate once and replays the original result", async () => {
    let calls = 0;
    const handler = async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 50));
      return Response.json({ id: "created-once" }, { status: 201 });
    };

    const [first, second] = await Promise.all([
      withIdempotency(request("key-a"), userId, handler),
      withIdempotency(request("key-a"), userId, handler),
    ]);

    expect(calls).toBe(1);
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(await first.json()).toEqual({ id: "created-once" });
    expect(await second.json()).toEqual({ id: "created-once" });
  });

  it("scopes keys to one user", async () => {
    let calls = 0;
    const handler = async () => {
      calls += 1;
      return Response.json({ ok: true });
    };
    await withIdempotency(request("shared-key"), `${userId}-other`, handler);
    await withIdempotency(request("shared-key"), userId, handler);
    expect(calls).toBe(2);
    await platformDb.idempotencyRecord.deleteMany({ where: { key: "shared-key" } });
  });

  it("releases a failed claim so a retry runs", async () => {
    let calls = 0;
    const failing = async () => {
      calls += 1;
      return Response.json({ error: "boom" }, { status: 500 });
    };
    await withIdempotency(request("key-b"), userId, failing);
    await withIdempotency(request("key-b"), userId, failing);
    expect(calls).toBe(2);
  });
});
