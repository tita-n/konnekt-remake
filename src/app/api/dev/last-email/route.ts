import { NextResponse } from "next/server";
import { lastOutboxMessage } from "@/lib/email";

/**
 * Local/test-only email inspection endpoint. Automated e2e tests need the
 * 6-digit code that a real inbox would provide. Never available in production.
 */
export async function GET(request: Request): Promise<NextResponse> {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (process.env.E2E !== "1" && process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const email = new URL(request.url).searchParams.get("email") ?? undefined;
  const message = lastOutboxMessage(email);
  if (!message) return NextResponse.json({ found: false }, { status: 404 });
  return NextResponse.json({
    found: true,
    to: message.to,
    subject: message.subject,
    code: message.code ?? null,
    createdAt: message.createdAt,
  });
}
