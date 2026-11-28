import type { NextRequest } from "next/server";
import { createPost } from "@/lib/services/posts";
import { apiError, noStore, readJson, socialApi } from "@/lib/api/social";

export async function POST(request: NextRequest) {
  const context = await socialApi(request, { mutation: true });
  if ("response" in context) return context.response;
  try {
    const body = await readJson(request);
    const type = body.type;
    if (type !== "POST" && type !== "QUESTION" && type !== "POLL" && type !== "REPOST") {
      return noStore({ error: "Choose a post type." }, { status: 400 });
    }
    const media = Array.isArray(body.media)
      ? body.media.flatMap((item) => {
          if (!item || typeof item !== "object") return [];
          const row = item as Record<string, unknown>;
          if (typeof row.publicId !== "string") return [];
          return [
            {
              publicId: row.publicId,
              url: typeof row.url === "string" ? row.url : undefined,
              width: Number(row.width),
              height: Number(row.height),
              alt: typeof row.alt === "string" ? row.alt : undefined,
            },
          ];
        })
      : [];
    const result = await createPost({
      viewer: context.viewer,
      type,
      body: typeof body.body === "string" ? body.body : "",
      audienceId: typeof body.audienceId === "string" ? body.audienceId : "",
      questionTitle: typeof body.questionTitle === "string" ? body.questionTitle : undefined,
      topicTag: typeof body.topicTag === "string" ? body.topicTag : undefined,
      pollOptions: Array.isArray(body.pollOptions) ? body.pollOptions.filter((value): value is string => typeof value === "string") : [],
      pollDurationDays: typeof body.pollDurationDays === "number" ? body.pollDurationDays : undefined,
      repostOfId: typeof body.repostOfId === "string" ? body.repostOfId : undefined,
      communityId: typeof body.communityId === "string" && body.communityId ? body.communityId : undefined,
      media,
      idempotencyKey:
        request.headers.get("idempotency-key")?.slice(0, 120) ||
        (typeof body.idempotencyKey === "string" ? body.idempotencyKey.slice(0, 120) : undefined),
      draftClientDraftId:
        typeof body._draftClientDraftId === "string" ? body._draftClientDraftId.slice(0, 80) : undefined,
    });
    return noStore(result, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
