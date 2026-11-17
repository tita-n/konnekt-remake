import type { Metadata } from "next";
import { turnstileSiteKey } from "@/lib/security/turnstile";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Forgot your password?"
      description="We'll email you a link to choose a new one."
      backHref="/login"
      backLabel="Back to log in"
    >
      <ForgotPasswordForm siteKey={turnstileSiteKey()} />
    </AuthShell>
  );
}
