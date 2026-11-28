import Link from "next/link";
import { ArrowLeft, ArrowRight, BadgeCheck, Camera, Clock, CreditCard, Mail, ShieldCheck, Users } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { PreviewToggle } from "./preview-toggle";
import { ClayIllustration } from "@/components/ui/clay-illustrations";
import { AuthFormScreen } from "./screens";
import { BrandSlot } from "./brand-slot";
import {
  BENEFITS,
  OnboardingInterestChips,
  OnboardingProfileFields,
  DEPARTMENT_CHOICES,
  INTERESTS,
  LEVELS,
  SIGNUP_STEPS,
  TIME_ESTIMATE,
} from "./index-shared";
import { StepState } from "./frame-parts";
import type { AuthStepId, DirectionUniversity } from "./index-shared";
import type { ScreenState } from "./frame-parts";

/**
 * DIRECTION A — Friendly Campus.
 * Warm, illustrated, conversational. A clay hero scene, soft accent-tint
 * panels, rounded shapes and step cards with icons. One accent, used as tint
 * rather than as large filled blocks, so the form stays the loudest thing.
 */

type Props = { step: AuthStepId; university: DirectionUniversity; branded: boolean; state: ScreenState };

const TITLES: Partial<Record<AuthStepId, { title: string; lede: React.ReactNode }>> = {
  welcome: {
    title: "Campus, minus the noise",
    lede: "A verified-only space for your university: your department, your people, your events.",
  },
  "find-university": { title: "Find your university", lede: "Konnekt is one app for many campuses. Pick your school to join its private space." },
  "verify-method": { title: "Prove you're a student", lede: "Pick whichever is easiest. Every option ends with a verified student account — nothing is public until you finish." },
  "email-code": { title: "Use your student email", lede: "This is the fastest way to prove you're a student. No document review, no waiting." },
  "id-upload": { title: "Upload your student ID", lede: "A real person at your university reviews it. Most requests are decided within a day." },
  vouch: { title: "Ask someone to vouch", lede: "Pick a course rep or reviewer listed by your university who can confirm you're a student." },
  "create-account": { title: "Create your account", lede: "One account per student. Your email is only used for security and updates." },
  "account-code": { title: "Check your email", lede: "Enter the 6-digit code we sent to finish creating your account." },
  "onboarding-profile": { title: "Where do you study?", lede: "This decides who sees your posts first. You can change it later in your profile." },
  "onboarding-interests": { title: "Make your profile yours", lede: "Pick at least 3. Your interests help people find you — and help us suggest communities." },
  login: { title: "Welcome back", lede: "Log in to your campus space." },
  forgot: { title: "Forgot your password?", lede: "We'll email you a link to choose a new one." },
  reset: { title: "Choose a new password", lede: "Use at least 10 characters with upper and lower case letters and a number." },
};

const BACK: Partial<Record<AuthStepId, { href: string; label: string }>> = {
  login: { href: "/", label: "Home" },
  forgot: { href: "/login", label: "Back to log in" },
  reset: { href: "/login", label: "Back to log in" },
  "find-university": { href: "/", label: "Home" },
};

export function DirectionA({ step, university, branded, state }: Props) {
  const copy = TITLES[step] ?? TITLES.welcome!;
  const back = branded ? { href: "/signup", label: `Change ${university.shortName}` } : BACK[step];
  const hero = step === "welcome";
  const showIllustration = step === "welcome" || step === "login" || step === "find-university";

  return (
    <div className="min-h-dvh bg-bg">
      <div className="mx-auto flex min-h-dvh w-full max-w-[36rem] flex-col px-4 sm:px-6 lg:max-w-6xl lg:px-12">
        <header className="flex items-center justify-between py-5">
          <BrandSlot university={branded ? university : null} size={hero ? "md" : "sm"} />
          <span className="inline-flex items-center gap-1.5 rounded-chip bg-surface-2 px-2.5 py-1 text-tiny font-semibold text-fg-muted max-sm:hidden">
            <Clock aria-hidden="true" className="size-3.5" />
            {TIME_ESTIMATE}
          </span>
        </header>

        <div className="grid flex-1 grid-cols-[minmax(0,1fr)] items-start gap-6 pb-10 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)] lg:items-center lg:gap-14 lg:py-6">
          {/* Left: the welcome message. Stays above the fold on phones, becomes a panel on desktop. */}
          <section
            aria-label="What Konnekt is for you"
            className={`min-w-0 rounded-[28px] bg-accent-soft p-5 sm:p-6 ${hero ? "" : "lg:p-8"}`}
          >
            {showIllustration ? (
              <ClayIllustration kind="welcomeHero" className="mx-auto h-40 w-full max-w-[13rem] sm:h-44 sm:max-w-[15rem] lg:mx-0" />
            ) : null}
            <h1 className="mt-4 font-display text-[clamp(1.6rem,1.1rem+2vw,2.25rem)] font-bold leading-[1.14] tracking-[-0.02em] text-fg">
              {copy.title}
            </h1>
            <p className="mt-2 max-w-[38ch] text-body text-fg-muted">{copy.lede}</p>

            {hero ? <BenefitRow /> : null}

            {!hero && branded ? (
              <p className="mt-4 flex items-start gap-2 text-left text-small leading-relaxed text-accent-soft-fg">
                <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                <span>
                  {university.shortName} decides how students get verified. Nothing here is public, and you can leave and come
                  back — the flow keeps its place.
                </span>
              </p>
            ) : null}

          </section>

          {/* Right: the real form, mirrored field for field. */}
          <section className="w-full min-w-0">
            {branded ? <StepRail current={SIGNUP_STEPS.indexOf(step === "create-account" || step === "account-code" ? "Account" : step.startsWith("onboarding") ? "Profile" : "Verify")} labels={SIGNUP_STEPS} /> : null}

            {back ? (
              <Link
                href={back.href}
                className="mb-3 inline-flex min-h-11 items-center gap-1.5 rounded-button text-small font-semibold text-fg-muted transition-colors hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                <ArrowLeft aria-hidden="true" className="size-4" />
                {back.label}
              </Link>
            ) : null}

            <div className="rounded-card border border-border bg-surface p-4 shadow-raised sm:p-5">
              <StepBody step={step} university={university} state={state} />
            </div>

            {branded ? null : (
              <p className="mt-3 flex items-start gap-2 px-1 text-tiny leading-relaxed text-fg-subtle">
                <ShieldCheck aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-accent-ink" />
                <span>
                  Only verified students of {university.shortName} can see what you post. ID photos are reviewed privately and
                  deleted after the decision.
                </span>
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function BenefitRow() {
  const items = [
    { icon: BadgeCheck, text: BENEFITS.verified },
    { icon: Users, text: BENEFITS.together },
    { icon: Mail, text: BENEFITS.official },
  ];
  return (
    <ul className="mt-4 space-y-2 text-left">
      {items.map((item) => (
        <li key={item.text} className="flex items-start gap-2.5 rounded-button bg-surface px-3 py-2 text-small text-fg">
          <item.icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-accent-ink" />
          <span>{item.text}</span>
        </li>
      ))}
    </ul>
  );
}

function StepRail({ current, labels }: { current: number; labels: readonly string[] }) {
  return (
    <ol className="mb-4 flex items-center gap-2" aria-label="Sign-up progress">
      {labels.map((label, index) => (
        <li key={label} className="flex flex-1 items-center gap-2">
          <span
            className={`inline-flex h-6 items-center gap-1.5 rounded-chip px-2 text-tiny font-bold ${
              index === current ? "bg-accent text-accent-fg" : index < current ? "bg-accent-soft text-accent-soft-fg" : "bg-surface-2 text-fg-subtle"
            }`}
            aria-current={index === current ? "step" : undefined}
          >
            <span className="nums">{index + 1}</span>
            {label}
          </span>
          {index < labels.length - 1 ? (
            <span aria-hidden="true" className={`h-[3px] flex-1 rounded-full ${index < current ? "bg-accent" : "bg-surface-3"}`} />
          ) : null}
        </li>
      ))}
    </ol>
  );
}

/** Steps whose UI lives inside a page rather than a shared component are mirrored here. */
function StepBody({ step, university, state }: { step: AuthStepId; university: DirectionUniversity; state: ScreenState }) {
  if (state !== "ok") {
    return (
      <div className="space-y-4">
        <StepState state={state} tone="soft" retryHref={`?step=${step}&state=ok`} />
        {state === "loading" ? null : <AuthFormScreen step={step} university={university} />}
      </div>
    );
  }
  if (step === "welcome" || step === "onboarding-profile" || step === "onboarding-interests" || step === "verify-method") {
    if (step === "welcome") {
      return (
        <div className="space-y-4">
          <div className="flex flex-col gap-2.5">
            <ButtonLink href="/signup" size="lg" fullWidth rightIcon={<ArrowRight aria-hidden="true" className="size-4" />}>
              Get started
            </ButtonLink>
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center justify-center rounded-button text-small font-semibold text-fg-muted underline-offset-4 transition-colors hover:text-fg hover:underline"
            >
              I already have an account
            </Link>
          </div>
          <div className="rounded-card bg-surface-2 p-4">
            <p className="text-small font-semibold text-fg">You&apos;ll be in your campus space in a few taps</p>
            <ol className="mt-2 space-y-1.5 text-small text-fg-muted">
              <li>1. Pick your university</li>
              <li>2. Verify you&apos;re a student</li>
              <li>3. Add your department and interests</li>
            </ol>
          </div>
          <div className="rounded-card border border-border bg-surface p-4">
            <p className="text-small font-semibold text-fg">Three ways to prove you&apos;re a student</p>
            <ul className="mt-2 space-y-2 text-small text-fg-muted">
              <li className="flex items-start gap-2">
                <Mail aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-accent-ink" />
                <span>A one-time code to your student email.</span>
              </li>
              <li className="flex items-start gap-2">
                <Camera aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-accent-ink" />
                <span>A photo of your ID card, reviewed and then deleted.</span>
              </li>
              <li className="flex items-start gap-2">
                <Users aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-accent-ink" />
                <span>A vouch from someone your university already trusts.</span>
              </li>
            </ul>
            <p className="mt-2.5 text-tiny text-fg-subtle">Your university decides which of these it offers.</p>
          </div>
        </div>
      );
    }
    if (step === "verify-method") return <MethodCards university={university} />;
    return step === "onboarding-profile" ? <ProfileStep /> : <InterestsStep />;
  }
  return <AuthFormScreen step={step} university={university} />;
}

function MethodCards({ university }: { university: DirectionUniversity }) {
  const cards = [
    university.studentEmailDomains.length > 0
      ? {
          href: `/signup/${university.slug}/email`,
          icon: <Mail aria-hidden="true" className="size-5" />,
          title: "Use your student email",
          description: `We'll send a 6-digit code to your ${university.shortName} email. Fastest option.`,
          recommended: true,
        }
      : null,
    university.idCardEnabled
      ? {
          href: `/signup/${university.slug}/id`,
          icon: <CreditCard aria-hidden="true" className="size-5" />,
          title: "Upload your student ID",
          description: "Use your ID card or course registration slip. A reviewer checks it, usually within a day.",
          recommended: false,
        }
      : null,
    university.vouchingEnabled
      ? {
          href: `/signup/${university.slug}/vouch`,
          icon: <Users aria-hidden="true" className="size-5" />,
          title: "Get vouched for",
          description: "Ask a course rep or reviewer who already knows you to confirm you're a student.",
          recommended: false,
        }
      : null,
  ].filter(Boolean) as Array<{ href: string; icon: React.ReactNode; title: string; description: string; recommended: boolean }>;

  return (
    <ul className="space-y-2.5">
      {cards.map((card) => (
        <li key={card.title}>
          <Link
            href={card.href}
            className={`flex min-h-[76px] items-start gap-3 rounded-card border p-3.5 transition-colors hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
              card.recommended ? "border-accent bg-accent-soft" : "border-border bg-surface"
            }`}
          >
            <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-surface text-accent-ink">
              {card.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-[0.9375rem] font-semibold text-fg">{card.title}</span>
                {card.recommended ? (
                  <span className="rounded-chip bg-accent px-1.5 py-0.5 text-[0.625rem] font-bold uppercase tracking-[0.04em] text-accent-fg">
                    Fastest
                  </span>
                ) : null}
              </span>
              <span className="mt-0.5 block text-small leading-snug text-fg-muted">{card.description}</span>
            </span>
          </Link>
        </li>
      ))}
      <li className="rounded-card bg-surface-2 px-3.5 py-3 text-small text-fg-muted">
        Can&apos;t get into your school email?{" "}
        <Link href={`/signup/${university.slug}/id`} className="font-semibold text-accent-ink underline-offset-2 hover:underline">
          Use your ID card instead
        </Link>
        .
      </li>
    </ul>
  );
}

function ProfileStep() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="flex size-14 shrink-0 items-center justify-center rounded-full border border-dashed border-border-strong text-fg-subtle">
          <Camera className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="text-small font-semibold text-fg">Add a photo</p>
          <p className="text-tiny text-fg-subtle">Optional. Your initials work fine too.</p>
        </div>
      </div>
      <OnboardingProfileFields />
    </div>
  );
}

function InterestsStep() {
  return <OnboardingInterestChips picked={["Coding", "Afrobeats", "Design"]} limit={18} note="You can add more later from your profile." />;
}

