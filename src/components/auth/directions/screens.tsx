import { AccountForm } from "@/components/auth/account-form";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { IdCardForm } from "@/components/auth/id-card-form";
import { LoginForm } from "@/components/auth/login-form";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { SignupCodeForm } from "@/components/auth/signup-code-form";
import { StudentEmailForm } from "@/components/auth/student-email-form";
import { UniversityPicker } from "@/components/auth/university-picker";
import { EmptyState } from "@/components/ui/feedback";
import { ButtonLink } from "@/components/ui/button";
import { VouchForm } from "@/components/auth/vouch-form";
import { UNIVERSITIES, VOUCHERS, matricExample } from "../../../../fixtures/auth-directions";
import type { AuthStepId } from "./steps";
import type { DirectionUniversity } from "../../../../fixtures/auth-directions";

/**
 * Every direction renders the *real* form components, so field names, order,
 * hints, autocomplete, labels and states stay exactly as they are in the live
 * flow. Nothing here adds a field or a submission path; `siteKey=""` keeps
 * Turnstile in its real "not configured" state, which renders nothing.
 */
export function AuthFormScreen({ step, university }: { step: AuthStepId; university: DirectionUniversity }) {
  switch (step) {
    case "find-university":
      return <UniversityPicker universities={UNIVERSITIES} />;
    case "email-code":
      return (
        <StudentEmailForm
          slug={university.slug}
          shortName={university.shortName}
          domains={university.studentEmailDomains}
        />
      );
    case "id-upload":
      if (!university.idCardEnabled) return <MethodClosed university={university} kind="ID review" />;
      return (
        <IdCardForm
          slug={university.slug}
          matricPattern={university.matricPattern}
          matricExample={matricExample(university.matricPattern)}
        />
      );
    case "vouch":
      if (!university.vouchingEnabled) return <MethodClosed university={university} kind="vouching" />;
      return (
        <VouchForm slug={university.slug} vouchers={VOUCHERS} matricExample={matricExample(university.matricPattern)} />
      );
    case "create-account":
      return (
        <AccountForm
          slug={university.slug}
          initialEmail={university.studentEmailDomains[0] ? `student@${university.studentEmailDomains[0]}` : ""}
          lockedEmail={university.studentEmailDomains.length > 0}
          siteKey=""
          universityName={university.name}
          policyVersion={university.policyVersion}
        />
      );
    case "account-code":
      return <SignupCodeForm />;
    case "login":
      return <LoginForm siteKey="" />;
    case "forgot":
      return <ForgotPasswordForm siteKey="" />;
    case "reset":
      return <ResetPasswordForm token="design-preview-token" />;
    default:
      return null;
  }
}

/** True when `AuthFormScreen` is what this step shows (so frames add no copy of their own). */
export const FORM_STEPS: AuthStepId[] = [
  "find-university",
  "email-code",
  "id-upload",
  "vouch",
  "create-account",
  "account-code",
  "login",
  "forgot",
  "reset",
];

/**
 * When the campus record turns a verification route off, the direction shows a
 * closed state with a way back in — the same shape the live flow uses, driven
 * by `idCardEnabled` / `vouchingEnabled` rather than by the design.
 */
function MethodClosed({ university, kind }: { university: DirectionUniversity; kind: string }) {
  return (
    <EmptyState
      compact
      illustration="unavailable"
      title={`${kind} isn't open at ${university.shortName}`}
      description="Your university decides how students get verified. The route that is enabled for you is still one tap away."
      action={
        <ButtonLink href={`/signup/${university.slug}/email`} size="md" variant="primary" className="min-h-11">
          Use your student email
        </ButtonLink>
      }
    />
  );
}
