import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BadgeCheck, ShieldCheck, Smartphone } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { ButtonLink } from "@/components/ui/button";
import { UniversityShieldMark } from "@/components/brand/logo";
import { ClayIllustration } from "@/components/ui/clay-illustrations";

export const metadata = { title: "Your university, socially connected" };

function landingFor(status: string, onboarded: boolean) {
  if (status === "SUSPENDED") return "/suspended";
  if (status === "DELETED_PENDING") return "/account/deleted";
  if (status === "VERIFIED" || status === "ALUMNI") return onboarded ? "/pulse" : "/onboarding";
  return "/status";
}

export default async function WelcomePage() {
  const session = await getSession();
  if (session) {
    redirect(landingFor(session.user.status, Boolean(session.user.departmentNodeId && session.user.level)));
  }

  return (
    <main id="main" className="flex min-h-dvh flex-col bg-bg">
      <div className="relative overflow-hidden">
        {/* Subtle top accent-tint gradient wash (Spec Section 7.A) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-gradient-to-b from-accent-soft via-accent-soft/45 to-transparent"
        />

        <div className="relative mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 pb-8 pt-6 sm:px-8">
          <div className="flex flex-1 flex-col items-center justify-center py-4 text-center md:grid md:grid-cols-[1.05fr_0.95fr] md:items-center md:gap-12 md:text-left">
            <div className="flex max-w-lg flex-col items-center md:items-start">
              <UniversityShieldMark className="size-[72px] text-accent" />
              <h1 className="mt-5 font-display text-[1.75rem] leading-[2.125rem] font-bold tracking-[-0.02em] text-fg sm:text-[2.5rem] sm:leading-[1.12]">
                Your university, socially connected.
              </h1>
              <p className="mt-3 max-w-md text-body text-fg-muted">
                Verified students only. Meet your department, ask questions safely, and follow campus life without noise.
              </p>

              <div className="mt-5 md:hidden">
                <ClayIllustration kind="welcomeHero" className="h-44 w-56" />
              </div>

              {/* Neo-brutalist primary button allowed on Welcome ONLY (Spec Section 5B & 7.A) */}
              <div className="mt-6 flex w-full max-w-sm flex-col gap-3">
                <ButtonLink
                  href="/signup"
                  size="lg"
                  fullWidth
                  rightIcon={<ArrowRight aria-hidden="true" className="size-4" />}
                  className="border-2 border-[#12141A] shadow-[4px_4px_0_#12141A] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_#12141A] dark:border-fg dark:shadow-[4px_4px_0_rgba(242,243,245,0.85)]"
                >
                  Get started
                </ButtonLink>
                <ButtonLink href="/login" variant="secondary" size="lg" fullWidth>
                  I already have an account
                </ButtonLink>
              </div>

              <ul className="mt-7 space-y-2.5 text-left">
                {[
                  { icon: BadgeCheck, text: "Every account belongs to a verified student on campus." },
                  { icon: ShieldCheck, text: "ID photos are reviewed privately and deleted right after." },
                  { icon: Smartphone, text: "Built fast and light for Nigerian campus connections." },
                ].map((item) => (
                  <li key={item.text} className="flex items-start gap-2.5 text-small text-fg-muted">
                    <item.icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-accent-ink" />
                    <span>{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="hidden md:flex md:flex-col md:items-center md:justify-center">
              <div className="w-full max-w-sm rounded-card border border-border bg-surface p-6 text-center">
                <ClayIllustration kind="welcomeHero" className="mx-auto h-52 w-64" />
                <div className="mt-4 rounded-button bg-surface-2 p-3.5 text-left">
                  <p className="font-display text-h3 font-semibold text-fg">Nova University</p>
                  <p className="mt-0.5 text-small text-fg-muted">4 colleges · 7 departments · verified campus space</p>
                </div>
              </div>
            </div>
          </div>

          <footer className="mt-auto flex flex-col items-center justify-between gap-2 border-t border-border pt-5 text-tiny text-fg-muted sm:flex-row">
            <p>© {new Date().getFullYear()} Konnekt. Made for Nigerian campuses.</p>
            <nav aria-label="Legal" className="flex flex-wrap items-center gap-4">
              <Link href="/legal/terms" className="inline-flex min-h-11 items-center hover:text-fg hover:underline">
                Terms
              </Link>
              <Link href="/legal/privacy" className="inline-flex min-h-11 items-center hover:text-fg hover:underline">
                Privacy
              </Link>
              <Link href="/legal/community-rules" className="inline-flex min-h-11 items-center hover:text-fg hover:underline">
                Community Rules
              </Link>
            </nav>
          </footer>
        </div>
      </div>
    </main>
  );
}
