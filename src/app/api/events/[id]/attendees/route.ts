import type { NextRequest } from "next/server";
import { apiError, noStore, socialApi } from "@/lib/api/social";
import { listAttendees } from "@/lib/services/events";
import type { EventRsvpStatus } from "@/lib/domain/events";

const STATUSES: EventRsvpStatus[] = ["GOING", "INTERESTED", "WAITLISTED", "CANCELLED"];

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await socialApi(request);
  if ("response" in context) return context.response;
  try {
    const { id } = await params;
    const params2 = new URL(request.url).searchParams;
    const status = params2.get("status");
    return noStore(
      await listAttendees(context.viewer, id, {
        q: params2.get("q") ?? undefined,
        status: STATUSES.includes(status as EventRsvpStatus) ? (status as EventRsvpStatus) : "ALL",
      }),
    );
  } catch (error) {
    return apiError(error);
  }
}
