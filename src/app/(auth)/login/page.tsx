import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { landingPath, safeNextPath } from "@/lib/auth/landing";
import { turnstileSiteKey } from "@/lib/security/turnstile";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { CheckCircle2 } from "lucide-react";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reset?: string }>;
}) {
  const session = await getSession();
  if (session) redirect(landingPath(session.user));
  const params = await searchParams;

  return (
    <AuthShell
      title="Welcome back"
      description="Log in to your campus space."
      backHref="/"
      backLabel="Home"
    >
      {params.reset === "1" ? (
        <div className="mb-4 flex items-start gap-2 rounded-card border border-success/30 bg-success-soft px-3.5 py-3 text-small text-success" role="status">
          <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          Your password was changed. Log in with your new password. All other devices were signed out.
        </div>
      ) : null}
      <LoginForm siteKey={turnstileSiteKey()} next={safeNextPath(params.next) ?? undefined} />
      <p className="mt-6 text-center text-small text-fg-muted">
        New to Konnekt?{" "}
        <Link href="/signup" className="font-semibold text-accent-ink underline-offset-2 hover:underline">
          Get started
        </Link>
      </p>
    </AuthShell>
  );
}
