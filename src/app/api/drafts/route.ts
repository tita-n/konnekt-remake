import type { NextRequest } from "next/server";
import { listDrafts, saveDraft } from "@/lib/services/posts";
import { apiError, noStore, readJson, socialApi } from "@/lib/api/social";
import type { DraftView } from "@/lib/posts/types";

const DRAFT_TYPES = new Set(["POST", "QUESTION", "POLL"]);

export async function GET(request: NextRequest) {
  const context = await socialApi(request);
  if ("response" in context) return context.response;
  try {
    return noStore({ drafts: await listDrafts(context.viewer) });
  } catch (error) {
    return apiError(error);
  }
}

async function handleSave(request: NextRequest, legacyPost: boolean) {
  const context = await socialApi(request, { mutation: true });
  if ("response" in context) return context.response;
  try {
    const body = await readJson(request);
    if (typeof body.type !== "string" || !DRAFT_TYPES.has(body.type)) {
      return noStore({ error: "Choose a draft type." }, { status: 400 });
    }
    const payload = body.payload && typeof body.payload === "object" ? (body.payload as DraftView["payload"]) : {};
    const audience = body.audience && typeof body.audience === "object" ? (body.audience as DraftView["audience"]) : {};
    const clientDraftId =
      typeof body.clientDraftId === "string"
        ? body.clientDraftId
        : typeof body.id === "string"
          ? body.id
          : crypto.randomUUID();
    const draft = await saveDraft(context.viewer, {
      clientDraftId,
      type: body.type as "POST" | "QUESTION" | "POLL",
      contextKey: typeof body.contextKey === "string" ? body.contextKey : undefined,
      version: typeof body.version === "number" ? body.version : undefined,
      clientUpdatedAt: typeof body.clientUpdatedAt === "string" ? body.clientUpdatedAt : undefined,
      payload,
      audience,
    });
    return noStore(draft, { status: legacyPost ? 201 : 200 });
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: NextRequest) {
  return handleSave(request, false);
}

/** Kept for older clients; behaves like the versioned PUT. */
export async function POST(request: NextRequest) {
  return handleSave(request, true);
}
