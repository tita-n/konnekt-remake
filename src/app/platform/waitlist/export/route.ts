import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isPlatformAdmin } from "@/lib/auth/guards";
import { waitlistCsv } from "@/lib/services/platform";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const current = await getSession();
  if (!current) return NextResponse.json({ error: "Log in first." }, { status: 401 });
  if (!isPlatformAdmin(current.user)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const admin = current.user;
  const csv = await waitlistCsv();
  await writeAudit({
    actorId: admin.id,
    universityId: null,
    action: "platform.waitlist_exported",
    targetType: "WaitlistEntry",
    metadata: { rows: csv.split("\n").length - 1 },
  }).catch(() => undefined);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="konnekt-waitlist-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
