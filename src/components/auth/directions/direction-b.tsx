import Link from "next/link";
import { ArrowLeft, ArrowRight, BadgeCheck, IdCard, Mail, Radio, Users } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Avatar } from "@/components/ui/display";
import { AuthFormScreen } from "./screens";
import { BrandSlot } from "./brand-slot";
import { StepState } from "./frame-parts";
import { BENEFITS, OnboardingInterestChips, OnboardingProfileFields, SIGNUP_STEPS, TIME_ESTIMATE, stepGroup } from "./index-shared";
import type { AuthStep, AuthStepId, DirectionUniversity } from "./index-shared";
import type { ScreenState } from "./frame-parts";

/**
 * DIRECTION B — Bold Youth.
 * Confident and typographic: a saturated accent block that carries the
 * promise, one neo-brutalist primary action (allowed here, on Welcome), a
 * cluster of illustrated students, and card hover lifts. Colour does the
 * shouting, the form stays plain so nothing competes with it.
 */

type Props = { step: AuthStepId; university: DirectionUniversity; branded: boolean; state: ScreenState };

const STAGE_LABEL: Record<AuthStep["group"], string> = {
  entry: "Get started",
  verify: "Verification",
  account: "Your account",
  profile: "Your profile",
};

const HEADLINE: Partial<Record<AuthStepId, string>> = {
  welcome: "Your campus, in one place.",
  "find-university": "Where do you study?",
  "verify-method": "Show you're real.",
  "email-code": "Fastest route in.",
  "id-upload": "One photo, then you're in.",
  vouch: "Bring someone who knows you.",
  "create-account": "Make it yours.",
  "account-code": "Six digits.",
  "onboarding-profile": "Find your people.",
  "onboarding-interests": "Say what you're into.",
  login: "Welcome back.",
  forgot: "We'll sort it.",
  reset: "Pick a new one.",
};

const SUB: Partial<Record<AuthStepId, string>> = {
  welcome: "Verified students only. No outsiders, no noise, no public feed.",
  "find-university": "Pick your school and its private space opens up.",
  "verify-method": "Three ways in. Whichever is easiest ends the same way: verified.",
  login: "Log in and carry on.",
  forgot: "One email, one link, one new password.",
};

export function DirectionB({ step, university, branded, state }: Props) {
  const headline = HEADLINE[step] ?? HEADLINE.welcome!;
  const sub = SUB[step];
  const big = step === "welcome";
  const back = branded ? { href: "/signup", label: "Other university" } : null;

  return (
    <div className="min-h-dvh bg-bg">
      <div className="mx-auto grid min-h-dvh w-full grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1.04fr)_minmax(0,0.96fr)] lg:gap-x-16 xl:max-w-[84rem]">
        {/* The accent block. Full-bleed on phones, a full-height half on desktop. */}
        <section className="min-w-0 bg-accent px-4 pb-9 pt-5 text-accent-fg sm:px-6 lg:flex lg:min-h-dvh lg:flex-col lg:px-12 lg:py-10">
          <header className="flex items-center justify-between">
            <span className="inline-flex min-h-11 items-center">
              <BrandSlot university={branded ? university : null} size="sm" onAccent />
            </span>
            {big ? (
              <Link
                href="/login"
                className="inline-flex min-h-11 items-center rounded-button border border-accent-fg px-3 text-small font-semibold text-accent-fg transition-colors hover:bg-surface hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                Log in
              </Link>
            ) : null}
          </header>

          <div className="mt-8 lg:my-auto lg:mt-0">
            <p className="text-tiny font-bold uppercase tracking-[0.16em] text-accent-fg">
              {STAGE_LABEL[stepGroup(step)]}
            </p>
            <h1 className="mt-2 max-w-[15ch] font-display text-[clamp(2rem,1.1rem+4.2vw,3.25rem)] font-bold leading-[1.02] tracking-[-0.03em] text-accent-fg">
              {headline}
            </h1>
            {sub ? <p className="mt-3 max-w-[34ch] text-[1.0625rem] leading-snug text-accent-fg">{sub}</p> : null}

            {big ? (
              <>
                <ul className="mt-6 space-y-1.5 text-small font-medium text-accent-fg">
                  {[
                    { icon: BadgeCheck, text: BENEFITS.verified },
                    { icon: Users, text: BENEFITS.together },
                    { icon: Radio, text: BENEFITS.official },
                  ].map((item) => (
                    <li key={item.text} className="flex items-start gap-2">
                      <item.icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                      <span>{item.text}</span>
                    </li>
                  ))}
                </ul>
                <AvatarCluster />
                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <ButtonLink
                    href="/signup"
                    size="lg"
                    variant="secondary"
                    className="neo-brutal min-h-12 bg-surface text-fg"
                    rightIcon={<ArrowRight aria-hidden="true" className="size-4" />}
                  >
                    Get started
                  </ButtonLink>
                  <span className="inline-flex items-center gap-1.5 text-tiny font-semibold text-accent-fg">
                    <ClockDot />
                    {TIME_ESTIMATE}
                  </span>
                </div>
              </>
            ) : null}
          </div>

        </section>

        {/* The form column. */}
        <section className="flex min-w-0 flex-col justify-center px-4 pb-12 pt-8 sm:px-6 lg:py-14 lg:pr-12">
          <div className="w-full min-w-0 max-w-[30rem] lg:ml-auto">
            {branded ? <BoldStepper current={step === "create-account" || step === "account-code" ? 1 : step.startsWith("onboarding") ? 2 : 0} labels={SIGNUP_STEPS} /> : null}

            {back ? (
              <Link
                href={back.href}
                className="mb-2 inline-flex min-h-11 items-center gap-1.5 rounded-button text-small font-semibold text-fg-muted transition-colors hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                <ArrowLeft aria-hidden="true" className="size-4" />
                {back.label}
              </Link>
            ) : null}

            <h2 className="text-h2 font-bold text-fg">{STEP_TITLE[step] ?? "Get started"}</h2>
            {STEP_LEDE[step] ? <p className="mt-1 max-w-[46ch] text-small leading-relaxed text-fg-muted">{STEP_LEDE[step]}</p> : null}

            <div className="mt-5">
              {state !== "ok" ? (
                <div className="space-y-4">
                  <StepState state={state} tone="soft" retryHref={`?step=${step}&state=ok`} />
                  {state === "loading" ? null : <AuthFormScreen step={step} university={university} />}
                </div>
              ) : step === "welcome" ? (
                <WelcomeAssurance />
              ) : step === "verify-method" ? (
                <BoldMethods university={university} />
              ) : step === "onboarding-profile" ? (
                <OnboardingProfileFields />
              ) : step === "onboarding-interests" ? (
                <OnboardingInterestChips picked={["Coding", "Afrobeats", "Debate"]} />
              ) : (
                <AuthFormScreen step={step} university={university} />
              )}
            </div>

            <p className="mt-4 flex items-start gap-2 text-tiny leading-relaxed text-fg-subtle">
              <BadgeCheck aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-accent-ink" />
              <span>{trustLine(step, branded ? university.shortName : null)}</span>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

const STEP_TITLE: Partial<Record<AuthStepId, string>> = {
  welcome: "Pick how you want to prove it",
  "find-university": "Find your university",
  "verify-method": "Prove you're a student",
  "email-code": "Use your student email",
  "id-upload": "Upload your student ID",
  vouch: "Ask someone to vouch",
  "create-account": "Create your account",
  "account-code": "Check your email",
  "onboarding-profile": "Where do you study?",
  "onboarding-interests": "Make your profile yours",
  login: "Welcome back",
  forgot: "Forgot your password?",
  reset: "Choose a new password",
};

const STEP_LEDE: Partial<Record<AuthStepId, string>> = {
  welcome: "Pick your university, verify once, and your department shows up.",
  "find-university": "Konnekt is one app for many campuses. Pick your school to join its private space.",
  "verify-method": "Pick whichever is easiest. Every option ends with a verified student account — nothing is public until you finish.",
  "email-code": "This is the fastest way to prove you're a student. No document review, no waiting.",
  "id-upload": "A real person at your university reviews it. Most requests are decided within a day.",
  vouch: "Pick a course rep or reviewer listed by your university who can confirm you're a student.",
  "create-account": "One account per student. Your email is only used for security and updates.",
  "account-code": "Enter the 6-digit code we sent to finish creating your account.",
  "onboarding-profile": "This decides who sees your posts first. You can change it later in your profile.",
  "onboarding-interests": "Pick at least 3. Your interests help people find you — and help us suggest communities.",
  login: "Log in to your campus space.",
  forgot: "We'll email you a link to choose a new one.",
  reset: "Use at least 10 characters with upper and lower case letters and a number.",
};

/** One privacy promise per screen, phrased for what the step actually asks for. */
function trustLine(step: AuthStepId, shortName: string | null): string {
  const who = shortName ?? "your university";
  if (stepGroup(step) === "verify") {
    return shortName
      ? `${shortName} reviewers only — nothing you upload is posted, and the photo is deleted once a decision is made.`
      : "Reviewers at your university only. ID photos are deleted once a decision is made.";
  }
  return `Only verified students of ${who} can see what you post.`;
}

function ClockDot() {
  return <span aria-hidden="true" className="inline-block size-1.5 rounded-full bg-accent-fg" />;
}

function AvatarCluster() {
  const names = ["Ngozi", "Ibrahim", "Aisha", "Tunde", "Chinedu"];
  return (
    <div className="mt-7 flex items-center gap-3">
      <span className="flex -space-x-2.5" aria-hidden="true">
        {names.map((name) => (
          <Avatar key={name} name={name} size="xs" className="ring-2 ring-accent" />
        ))}
      </span>
      <p className="text-tiny font-semibold leading-snug text-accent-fg">
        Every account is checked against your university before it can post
      </p>
    </div>
  );
}

function BoldStepper({ current, labels }: { current: number; labels: readonly string[] }) {
  return (
    <ol className="mb-4 flex items-stretch gap-1.5" aria-label="Sign-up progress">
      {labels.map((label, index) => (
        <li key={label} className="flex-1">
          <div className={`h-1.5 w-full rounded-full ${index <= current ? "bg-accent" : "bg-surface-3"}`} aria-hidden="true" />
          <p className={`mt-1.5 text-[0.6875rem] font-bold uppercase tracking-[0.08em] ${index === current ? "text-accent-ink" : "text-fg-subtle"}`} aria-current={index === current ? "step" : undefined}>
            <span className="nums">{index + 1}</span> {label}
          </p>
        </li>
      ))}
    </ol>
  );
}

function WelcomeAssurance() {
  return (
    <div className="space-y-2.5">
      {[
        { icon: Mail, title: "Student email", note: "A code to your school address. Instant." },
        { icon: IdCard, title: "ID photo", note: "A reviewer checks it, then it's deleted." },
        { icon: Users, title: "A vouch", note: "A course rep confirms you, if your school allows it." },
      ].map((row) => (
        <p key={row.title} className="flex items-start gap-3 rounded-card border border-border bg-surface p-3.5 motion-safe:transition-transform motion-safe:hover:-translate-y-0.5">
          <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-accent-soft text-accent-ink">
            <row.icon className="size-[18px]" />
          </span>
          <span className="min-w-0">
            <span className="block text-small font-bold text-fg">{row.title}</span>
            <span className="block text-tiny text-fg-muted">{row.note}</span>
          </span>
        </p>
      ))}
    </div>
  );
}

function BoldMethods({ university }: { university: DirectionUniversity }) {
  const rows = [
    university.studentEmailDomains.length > 0 && {
      href: `/signup/${university.slug}/email`,
      icon: <Mail aria-hidden="true" className="size-5" />,
      title: "Use your student email",
      description: `We'll send a 6-digit code to your ${university.shortName} email. Fastest option.`,
    },
    university.idCardEnabled && {
      href: `/signup/${university.slug}/id`,
      icon: <IdCard aria-hidden="true" className="size-5" />,
      title: "Upload your student ID",
      description: "Use your ID card or course registration slip. A reviewer checks it, usually within a day.",
    },
    university.vouchingEnabled && {
      href: `/signup/${university.slug}/vouch`,
      icon: <Users aria-hidden="true" className="size-5" />,
      title: "Get vouched for",
      description: "Ask a course rep or reviewer who already knows you to confirm you're a student.",
    },
  ].filter(Boolean) as Array<{ href: string; icon: React.ReactNode; title: string; description: string }>;

  return (
    <ul className="space-y-2.5">
      {rows.map((row, index) => (
        <li key={row.href}>
          <Link
            href={row.href}
            className="flex min-h-[72px] items-center gap-3 rounded-card border-2 border-border bg-surface p-3.5 transition-colors hover:border-accent hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            <span aria-hidden="true" className="nums font-display text-h2 font-bold text-accent-ink">
              {index + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[0.9375rem] font-bold text-fg">{row.title}</span>
              <span className="mt-0.5 block text-tiny leading-snug text-fg-muted">{row.description}</span>
            </span>
            {row.icon}
          </Link>
        </li>
      ))}
    </ul>
  );
}
