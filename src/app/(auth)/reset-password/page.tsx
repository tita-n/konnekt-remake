import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const params = await searchParams;
  const token = params.token ?? "";

  if (!token) {
    return (
      <AuthShell title="Reset link missing" description="This page needs the link we emailed you." backHref="/forgot-password" backLabel="Request a new link">
        <Link
          href="/forgot-password"
          className="inline-flex h-11 items-center rounded-button bg-accent px-4 text-[0.9375rem] font-semibold text-accent-fg"
        >
          Request a reset link
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Choose a new password"
      description="Use at least 10 characters with upper and lower case letters and a number."
      backHref="/login"
      backLabel="Back to log in"
    >
      <ResetPasswordForm token={token} />
    </AuthShell>
  );
}
