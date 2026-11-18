import "server-only";
import { NextResponse } from "next/server";
import { assertCsrf, getSession } from "@/lib/auth/session";
import { SocialError } from "@/lib/posts/errors";
import { loadSocialViewer, type SocialViewer } from "@/lib/services/social";
import type { SessionUser } from "@/lib/auth/guards";

export function apiError(error: unknown): NextResponse {
  if (error instanceof SocialError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  console.error("[api] social error", error instanceof Error ? error.message : "unknown");
  return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
}

export async function socialApi(
  request: Request,
  options: { mutation?: boolean } = {},
): Promise<{ viewer: SocialViewer; user: SessionUser } | { response: NextResponse }> {
  const session = await getSession();
  if (!session) {
    return { response: NextResponse.json({ error: "Sign in to continue." }, { status: 401 }) };
  }
  if (options.mutation && !(await assertCsrf(request))) {
    return { response: NextResponse.json({ error: "Your session expired. Refresh and try again." }, { status: 403 }) };
  }
  const viewer = await loadSocialViewer(session.user);
  if (!viewer) {
    return { response: NextResponse.json({ error: "Finish setting up your profile first." }, { status: 403 }) };
  }
  return { viewer, user: session.user };
}

export function noStore<T>(body: T, init?: ResponseInit): NextResponse {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
