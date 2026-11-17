import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { findActiveUniversityBySlug } from "@/lib/services/universities";
import { getSignupDraft } from "@/lib/services/signup";
import { accentCssVars } from "@/lib/domain/color";
import { turnstileSiteKey } from "@/lib/security/turnstile";
import { AuthShell } from "@/components/auth/auth-shell";
import { AccountForm } from "@/components/auth/account-form";
import { Stepper } from "@/components/ui/navigation";

export const metadata: Metadata = { title: "Create your account" };

export default async function CreateAccountPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const university = await findActiveUniversityBySlug(slug);
  if (!university) notFound();

  const draft = await getSignupDraft();
  if (!draft || draft.universityId !== university.id) redirect(`/signup/${slug}`);
  if (draft.method === "STUDENT_EMAIL" && !draft.studentEmailVerifiedAt) {
    redirect(`/signup/${slug}/email`);
  }
  if (draft.method === "ID_CARD" && !draft.idImageRef) redirect(`/signup/${slug}/id`);
  if (draft.method === "VOUCH" && !draft.vouchId) redirect(`/signup/${slug}/vouch`);

  const lockedEmail = Boolean(draft.studentEmailVerifiedAt);

  return (
    <div style={accentCssVars(university.accentColor) as React.CSSProperties}>
      <div className="mb-6">
        <Stepper steps={["Verify", "Account", "Profile"]} current={1} />
      </div>
      <AuthShell
        title="Create your account"
        description={
          lockedEmail
            ? "Your student email is verified. Choose how your name appears on campus."
            : "One account per student. Your email is only used for security and updates."
        }
        backHref={`/signup/${slug}`}
        backLabel={university.name}
      >
        <AccountForm
          slug={slug}
          initialEmail={draft.studentEmail ?? draft.pendingEmail ?? ""}
          lockedEmail={lockedEmail}
          siteKey={turnstileSiteKey()}
          universityName={university.name}
          policyVersion={university.policyVersion}
        />
      </AuthShell>
    </div>
  );
}
