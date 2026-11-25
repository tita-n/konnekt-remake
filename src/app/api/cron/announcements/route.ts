import { createHash, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
// Cron infrastructure must enumerate universities before entering tenant scope.
// eslint-disable-next-line no-restricted-imports
import { platformDb } from "@/lib/db/platform";
import { tenantDb } from "@/lib/db/tenant";
import { publishDueAnnouncements } from "@/lib/services/announcements";

function secretMatches(provided: string | null): boolean {
  const expected = process.env.ANNOUNCEMENT_CRON_SECRET;
  if (!expected) return process.env.NODE_ENV !== "production";
  if (!provided) return false;
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

async function run(request: NextRequest) {
  const header = request.headers.get("authorization");
  const bearer = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
  const provided = bearer ?? new URL(request.url).searchParams.get("secret");
  if (!secretMatches(provided)) {
    return Response.json({ error: "Not authorised." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const universities = await platformDb.university.findMany({ select: { id: true } });
  let published = 0;
  for (const university of universities) {
    const result = await publishDueAnnouncements(tenantDb(university.id));
    published += result.published;
  }
  return Response.json({ published }, { headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: NextRequest) {
  return run(request);
}

export async function POST(request: NextRequest) {
  return run(request);
}
