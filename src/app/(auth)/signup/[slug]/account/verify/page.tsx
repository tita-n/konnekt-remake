import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { findActiveUniversityBySlug } from "@/lib/services/universities";
import { getSignupDraft } from "@/lib/services/signup";
import { accentCssVars } from "@/lib/domain/color";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignupCodeForm } from "@/components/auth/signup-code-form";
import { Stepper } from "@/components/ui/navigation";
import { maskEmail } from "@/lib/utils";

export const metadata: Metadata = { title: "Confirm your email" };

export default async function VerifyAccountPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const university = await findActiveUniversityBySlug(slug);
  if (!university) notFound();

  const draft = await getSignupDraft();
  if (!draft || draft.universityId !== university.id || !draft.pendingEmail) {
    redirect(`/signup/${slug}/account`);
  }

  return (
    <div style={accentCssVars(university.accentColor) as React.CSSProperties}>
      <div className="mb-6">
        <Stepper steps={["Verify", "Account", "Profile"]} current={1} />
      </div>
      <AuthShell
        title="Check your email"
        description={
          <>
            We sent a 6-digit code to <span className="font-semibold text-fg">{maskEmail(draft.pendingEmail)}</span>. Enter it
            to finish creating your account.
          </>
        }
        backHref={`/signup/${slug}/account`}
        backLabel="Change details"
      >
        <SignupCodeForm />
        <p className="mt-6 text-center text-small text-fg-muted">
          Wrong email?{" "}
          <Link href={`/signup/${slug}/account`} className="font-semibold text-accent-ink underline-offset-2 hover:underline">
            Go back and edit it
          </Link>
        </p>
      </AuthShell>
    </div>
  );
}
