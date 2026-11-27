import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Clock, CreditCard, Mail, ShieldCheck, Users } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { PreviewToggle } from "./preview-toggle";
import { AuthFormScreen } from "./screens";
import { BrandSlot } from "./brand-slot";
import { StepState } from "./frame-parts";
import { BENEFITS, OnboardingInterestChips, OnboardingProfileFields, SIGNUP_STEPS, TIME_ESTIMATE, stepGroup } from "./index-shared";
import type { AuthStepId, DirectionUniversity } from "./index-shared";
import type { ScreenState } from "./frame-parts";

/**
 * DIRECTION C — Clean Premium.
 * Calm and minimal: a quiet glass header, one line-art illustration, generous
 * space, a hairline step rule, and exactly one accent style per screen (the
 * primary action). Depth is a single `shadow-raised` on the form card, nothing
 * else. Copy is short and declarative; the product is asked to look trusted
 * rather than friendly.
 */

type Props = { step: AuthStepId; university: DirectionUniversity; branded: boolean; state: ScreenState };

const COPY: Record<AuthStepId, { title: string; lede: string }> = {
  welcome: {
    title: "Your university, quietly organized",
    lede: "One verified space for your department, your questions and campus notices. No public feed, no strangers.",
  },
  "find-university": { title: "Find your university", lede: "Choose your school to open its private space." },
  "verify-method": {
    title: "Prove you're a student",
    lede: "Pick whichever is easiest. Every option ends with a verified student account — nothing is public until you finish.",
  },
  "email-code": { title: "Use your student email", lede: "The fastest way in. No document review, no waiting." },
  "id-upload": { title: "Upload your student ID", lede: "A reviewer at your university checks it, usually within a day." },
  vouch: { title: "Ask someone to vouch", lede: "A course rep or reviewer listed by your university confirms you." },
  "create-account": { title: "Create your account", lede: "One account per student. Your email is only used for security and updates." },
  "account-code": { title: "Check your email", lede: "Enter the 6-digit code we sent to finish creating your account." },
  "onboarding-profile": { title: "Where you study", lede: "This decides what you see first. Changeable any time." },
  "onboarding-interests": { title: "Make your profile yours", lede: "Pick at least 3. Your interests help people find you — and help us suggest communities." },
  login: { title: "Welcome back", lede: "Log in to your campus space." },
  forgot: { title: "Forgot your password?", lede: "We'll email you a link to choose a new one." },
  reset: { title: "Choose a new password", lede: "At least 10 characters, upper and lower case, and a number." },
};

export function DirectionC({ step, university, branded, state }: Props) {
  const copy = COPY[step];
  const back = branded ? { href: "/signup", label: `Change university` } : step === "login" || step === "forgot" || step === "reset" ? { href: "/", label: "Home" } : null;
  const showAside = step === "welcome" || step === "login" || step === "find-university";

  return (
    <div className="min-h-dvh bg-bg">
      <header className="glass sticky top-0 z-30 border-b border-border">
        <div className="mx-auto flex min-h-14 w-full max-w-[84rem] items-center justify-between px-4 sm:px-6 lg:px-10">
          <BrandSlot university={branded ? university : null} size="sm" />
          {step === "welcome" ? (
            <ButtonLink href="/login" variant="ghost" size="sm" className="min-h-11">
              Log in
            </ButtonLink>
          ) : stepGroup(step) === "entry" ? null : (
            <span className="inline-flex items-center gap-1.5 text-tiny font-medium text-fg-subtle max-sm:hidden">
              <Clock aria-hidden="true" className="size-3.5" />
              {TIME_ESTIMATE}
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-[84rem] px-4 pb-14 pt-8 sm:px-6 sm:pt-12 lg:px-10">
        <div className={`grid grid-cols-[minmax(0,1fr)] items-center gap-10 lg:gap-16 ${showAside ? "lg:grid-cols-[minmax(0,1fr)_27rem] xl:grid-cols-[minmax(0,1fr)_30rem]" : "justify-center"}`}>
          {showAside ? (
            <section className="hidden lg:block lg:self-center" aria-label="What Konnekt is for you">
              <p className="text-tiny font-semibold uppercase tracking-[0.2em] text-accent-ink">Konnekt</p>
              <h1 className="mt-3 max-w-[19ch] font-display text-[clamp(2.125rem,1.2rem+2.6vw,3.25rem)] font-bold leading-[1.06] tracking-[-0.03em] text-fg">
                {copy.title}
              </h1>
              <p className="mt-4 max-w-[42ch] text-body leading-relaxed text-fg-muted">{copy.lede}</p>
              <ul className="mt-8 max-w-[34ch] divide-y divide-border border-y border-border">
                {Object.values(BENEFITS).map((line) => (
                  <li key={line} className="flex items-start gap-3 py-3 text-small text-fg">
                    <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-accent-ink" strokeWidth={2.5} />
                    {line}
                  </li>
                ))}
              </ul>
              <ArcMark className="mt-8 w-full max-w-[15rem] text-accent" />
            </section>
          ) : null}

          <section className={`w-full min-w-0 ${showAside ? "" : "mx-auto max-w-[30rem]"} lg:py-4`}>
            {/* Mobile headline for the three screens that have an aside column. */}
            {showAside ? (
              <div className="mb-6 lg:hidden">
                <h1 className="font-display text-[clamp(1.6rem,1.15rem+2.4vw,2.125rem)] font-bold leading-[1.1] tracking-[-0.02em] text-fg">
                  {copy.title}
                </h1>
                <p className="mt-2 max-w-[44ch] text-body text-fg-muted">{copy.lede}</p>
                {step === "welcome" ? (
                  <ul className="mt-5 space-y-1.5 border-t border-border pt-1 text-small text-fg">
                    {Object.values(BENEFITS).map((line) => (
                      <li key={line} className="flex items-start gap-3 border-b border-border py-2.5 last:border-b-0">
                        <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-accent-ink" strokeWidth={2.5} />
                        {line}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            {branded ? <HairlineStepper current={step === "create-account" || step === "account-code" ? 1 : step.startsWith("onboarding") ? 2 : 0} labels={SIGNUP_STEPS} /> : null}

            <div className="rounded-card border border-border bg-surface p-5 shadow-raised sm:p-7">
              {!showAside ? (
                <>
                  <h1 className="font-display text-[1.375rem] font-bold leading-snug tracking-[-0.015em] text-fg">{copy.title}</h1>
                  <p className="mt-1.5 max-w-[44ch] text-small leading-relaxed text-fg-muted">{copy.lede}</p>
                </>
              ) : (
                <h2 className="sr-only">{copy.title}</h2>
              )}

              {back ? (
                <Link
                  href={back.href}
                  className="mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-button text-small font-semibold text-fg-muted transition-colors hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  <ArrowLeft aria-hidden="true" className="size-4" />
                  {back.label}
                </Link>
              ) : null}

              <div className={showAside && !back ? "mt-5" : "mt-5"}>
                {state !== "ok" ? (
                  <div className="space-y-4">
                    <StepState state={state} tone="panel" retryHref={`?step=${step}&state=ok`} />
                    {state === "loading" ? null : <PremiumBody step={step} university={university} />}
                  </div>
                ) : (
                  <PremiumBody step={step} university={university} />
                )}
              </div>
            </div>

            {branded ? null : (
              <p className="mt-4 flex items-start gap-2 px-1 text-tiny leading-relaxed text-fg-subtle">
                <ShieldCheck aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                <span>Only verified students of your university can see your posts. Nothing is shared outside the campus.</span>
              </p>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function PremiumBody({ step, university }: { step: AuthStepId; university: DirectionUniversity }) {
  if (step === "welcome") {
    return (
      <div className="space-y-5">
        <div className="space-y-2.5">
          <ButtonLink href="/signup" size="lg" fullWidth rightIcon={<ArrowRight aria-hidden="true" className="size-4" />}>
            Get started
          </ButtonLink>
          <Link
            href="/login"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-button text-small font-semibold text-fg-muted underline-offset-4 transition-colors hover:text-fg hover:underline"
          >
            I already have an account
          </Link>
        </div>
        <ol className="border-t border-border pt-4 text-small text-fg-muted">
          {[
            ["Find your university", "Name or short name, then the campus opens."],
            ["Get verified", "Student email, ID photo or a vouch."],
            ["Add your department", "Two choices, and your Pulse is yours."],
          ].map(([title, note], index) => (
            <li key={title} className="flex items-start gap-3 pb-3 last:pb-0">
              <span className="nums mt-0.5 font-display text-[0.8125rem] font-bold text-accent-ink">{index + 1}</span>
              <span className="min-w-0">
                <span className="block font-semibold text-fg">{title}</span>
                {note}
              </span>
            </li>
          ))}
        </ol>
      </div>
    );
  }
  if (step === "verify-method") return <PremiumMethods university={university} />;
  if (step === "onboarding-profile") return <OnboardingProfileFields />;
  if (step === "onboarding-interests") return <OnboardingInterestChips picked={["Books", "Design", "Church"]} limit={12} />;
  return <AuthFormScreen step={step} university={university} />;
}

function PremiumMethods({ university }: { university: DirectionUniversity }) {
  const rows = [
    university.studentEmailDomains.length > 0 && {
      href: `/signup/${university.slug}/email`,
      icon: <Mail aria-hidden="true" className="size-[18px]" />,
      title: "Use your student email",
      description: `We'll send a 6-digit code to your ${university.shortName} email. Fastest option.`,
    },
    university.idCardEnabled && {
      href: `/signup/${university.slug}/id`,
      icon: <CreditCard aria-hidden="true" className="size-[18px]" />,
      title: "Upload your student ID",
      description: "Use your ID card or course registration slip. A reviewer checks it, usually within a day.",
    },
    university.vouchingEnabled && {
      href: `/signup/${university.slug}/vouch`,
      icon: <Users aria-hidden="true" className="size-[18px]" />,
      title: "Get vouched for",
      description: "Ask a course rep or reviewer who already knows you to confirm you're a student.",
    },
  ].filter(Boolean) as Array<{ href: string; icon: React.ReactNode; title: string; description: string }>;

  return (
    <ul className="divide-y divide-border border-y border-border">
      {rows.map((row) => (
        <li key={row.href}>
          <Link
            href={row.href}
            className="group flex min-h-[76px] items-center gap-4 py-3.5 transition-colors hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
          >
            <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border text-accent-ink transition-colors group-hover:border-accent">
              {row.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[0.9375rem] font-semibold text-fg">{row.title}</span>
              <span className="mt-0.5 block max-w-[40ch] text-tiny leading-relaxed text-fg-muted">{row.description}</span>
            </span>
            <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-fg-subtle transition-transform motion-safe:group-hover:translate-x-0.5" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** The step indicator: a hairline rule with three stops, no pills, no fill. */
function HairlineStepper({ current, labels }: { current: number; labels: readonly string[] }) {
  return (
    <nav aria-label="Sign-up progress" className="mb-4">
      <ol className="flex items-center gap-2">
        {labels.map((label, index) => (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span className="flex items-center gap-1.5 whitespace-nowrap">
              <span
                aria-hidden="true"
                className={`size-1.5 rounded-full ${index === current ? "bg-accent" : index < current ? "bg-accent-soft" : "bg-surface-3"}`}
              />
              <span className={`text-[0.6875rem] font-semibold uppercase tracking-[0.1em] ${index === current ? "text-fg" : "text-fg-subtle"}`} aria-current={index === current ? "step" : undefined}>
                {label}
              </span>
            </span>
            {index < labels.length - 1 ? <span aria-hidden="true" className="h-px flex-1 bg-border" /> : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** One restrained line-art mark: three arches over a baseline, drawn as SVG. */
function ArcMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 320 96" className={className} fill="none" role="img" aria-label="Konnekt campus arches illustration">
      <path d="M4 92h312" stroke="currentColor" strokeOpacity="0.28" strokeWidth="1.5" />
      {[0, 1, 2].map((index) => (
        <path
          key={index}
          d={`M${28 + index * 104} 92V54a36 36 0 0 1 72 0v38`}
          stroke="currentColor"
          strokeOpacity={index === 1 ? "0.9" : "0.45"}
          strokeWidth={index === 1 ? "2.5" : "1.75"}
          strokeLinecap="round"
        />
      ))}
      <circle cx="160" cy="30" r="6" fill="currentColor" fillOpacity="0.7" />
      <path d="M120 92V72h80v20" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.5" />
    </svg>
  );
}
