import type { NextRequest } from "next/server";
import { apiError, noStore, socialApi } from "@/lib/api/social";
import { isAnnouncementCategory } from "@/lib/domain/announcements";
import { listOfficialFeed } from "@/lib/services/announcements";

export async function GET(request: NextRequest) {
  const context = await socialApi(request);
  if ("response" in context) return context.response;
  try {
    const params = new URL(request.url).searchParams;
    const category = params.get("category");
    return noStore(
      await listOfficialFeed(context.viewer, {
        category: isAnnouncementCategory(category) ? category : null,
        unreadOnly: params.get("unread") === "1",
        cursor: params.get("cursor"),
      }),
    );
  } catch (error) {
    return apiError(error);
  }
}
