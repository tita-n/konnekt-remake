/**
 * The screens every auth direction must cover. `group` drives the step
 * indicator (Verify → Account → Profile) exactly as the live flow does.
 */
export type AuthDirection = "a" | "b" | "c";

export type AuthStepId =
  | "welcome"
  | "find-university"
  | "verify-method"
  | "email-code"
  | "id-upload"
  | "vouch"
  | "create-account"
  | "account-code"
  | "onboarding-profile"
  | "onboarding-interests"
  | "login"
  | "forgot"
  | "reset";

export type AuthStep = {
  id: AuthStepId;
  label: string;
  /** Which part of the real flow this belongs to. */
  group: "entry" | "verify" | "account" | "profile";
  /** True when a university has been chosen, so the brand slot shows it. */
  branded: boolean;
};

export const AUTH_STEPS: AuthStep[] = [
  { id: "welcome", label: "Welcome", group: "entry", branded: false },
  { id: "find-university", label: "Find your university", group: "entry", branded: false },
  { id: "verify-method", label: "Verify: choose a method", group: "verify", branded: true },
  { id: "email-code", label: "Verify: student email", group: "verify", branded: true },
  { id: "id-upload", label: "Verify: ID card upload", group: "verify", branded: true },
  { id: "vouch", label: "Verify: vouching", group: "verify", branded: true },
  { id: "create-account", label: "Create account", group: "account", branded: true },
  { id: "account-code", label: "Confirm email code", group: "account", branded: true },
  { id: "onboarding-profile", label: "Onboarding 1: profile", group: "profile", branded: true },
  { id: "onboarding-interests", label: "Onboarding 2: interests", group: "profile", branded: true },
  { id: "login", label: "Log in", group: "entry", branded: false },
  { id: "forgot", label: "Forgot password", group: "entry", branded: false },
  { id: "reset", label: "Reset password", group: "entry", branded: false },
];

export const SIGNUP_STEPS = ["Verify", "Account", "Profile"] as const;

export function stepIndex(step: AuthStepId): number {
  const found = AUTH_STEPS.findIndex((entry) => entry.id === step);
  return found < 0 ? 0 : found;
}

export function stepLabel(step: AuthStepId): string {
  return AUTH_STEPS.find((entry) => entry.id === step)?.label ?? "Welcome";
}

/** Which part of the funnel a screen belongs to — used for eyebrow labels. */
export function stepGroup(step: AuthStepId): AuthStep["group"] {
  return AUTH_STEPS.find((entry) => entry.id === step)?.group ?? "entry";
}

/** Position of the current screen inside the sign-up funnel, for the step rail. */
export function signupStage(step: AuthStepId): number {
  if (step === "onboarding-profile" || step === "onboarding-interests") return 2;
  if (step === "create-account" || step === "account-code") return 1;
  return 0;
}
