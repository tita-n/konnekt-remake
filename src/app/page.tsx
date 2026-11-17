import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BadgeCheck, ShieldCheck, Smartphone } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { ButtonLink } from "@/components/ui/button";
import { LogoMark, Wordmark } from "@/components/brand/logo";

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
    <main id="main" className="flex min-h-dvh flex-col">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-5 pb-8 pt-6 sm:px-8">
        <header className="flex items-center justify-between">
          <LogoMark className="size-10 text-accent" title="Konnekt" />
          <Wordmark className="hidden sm:block" />
          <Link
            href="/login"
            className="rounded-button px-3 py-2 text-small font-semibold text-fg-muted transition hover:bg-surface-2 hover:text-fg sm:hidden"
          >
            Log in
          </Link>
        </header>

        <div className="flex flex-1 flex-col justify-center py-10 md:grid md:grid-cols-[1.05fr_0.95fr] md:items-center md:gap-16 md:py-16">
          <div className="max-w-xl">
            <p className="inline-flex items-center gap-2 rounded-chip border border-border bg-surface px-3 py-1.5 text-small font-semibold text-fg-muted">
              <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
              Verified students only
            </p>
            <h1 className="mt-5 font-display text-[2.5rem] font-extrabold leading-[1.06] tracking-[-0.035em] text-fg sm:text-6xl">
              Your university,
              <br />
              socially connected<span className="text-accent">.</span>
            </h1>
            <p className="mt-4 max-w-md text-[1.0625rem] leading-relaxed text-fg-muted">
              Find your campus, prove you are a student, and meet the people in your department and level — without the
              noise of a public timeline.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/signup" size="lg" rightIcon={<ArrowRight aria-hidden="true" className="size-4" />}>
                Get started
              </ButtonLink>
              <ButtonLink href="/login" variant="secondary" size="lg">
                I already have an account
              </ButtonLink>
            </div>

            <ul className="mt-8 space-y-3">
              {[
                { icon: BadgeCheck, text: "Every account is a verified student of its university." },
                { icon: ShieldCheck, text: "Your ID is seen only by reviewers, then deleted." },
                { icon: Smartphone, text: "Built for your phone and your data plan." },
              ].map((item) => (
                <li key={item.text} className="flex items-start gap-2.5 text-small text-fg-muted">
                  <item.icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-accent" />
                  {item.text}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-10 md:mt-0">
            <div className="relative mx-auto max-w-sm">
              <div className="absolute -inset-3 -z-10 rounded-[28px] bg-accent-soft" aria-hidden="true" />
              <div className="rounded-[26px] border border-border bg-surface p-5 shadow-card">
                <div className="flex items-center gap-3 border-b border-border pb-4">
                  <span className="flex size-11 items-center justify-center rounded-[12px] bg-accent text-small font-bold text-accent-fg">
                    UN
                  </span>
                  <div>
                    <p className="text-[0.9375rem] font-semibold text-fg">Demo University</p>
                    <p className="text-small text-fg-subtle">2 colleges · 6 faculties</p>
                  </div>
                </div>
                <dl className="mt-4 space-y-3">
                  {[
                    ["Your space", "One campus, no cross-talk"],
                    ["Your people", "Department and level first"],
                    ["Your privacy", "You choose what is visible"],
                  ].map(([term, detail]) => (
                    <div key={term} className="flex items-start justify-between gap-4">
                      <dt className="text-small font-semibold text-fg">{term}</dt>
                      <dd className="text-right text-small text-fg-muted">{detail}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-5 rounded-card bg-surface-2 p-3 text-small text-fg-muted">
                  <span className="font-semibold text-fg">Preview.</span> Konnekt opens your campus once your student status
                  is confirmed.
                </div>
              </div>
            </div>
          </div>
        </div>

        <footer className="mt-auto border-t border-border pt-5">
          <div className="flex flex-col gap-3 text-small text-fg-subtle sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} Konnekt. Made for Nigerian campuses.</p>
            <nav aria-label="Legal" className="flex flex-wrap gap-x-4 gap-y-1">
              <Link href="/legal/terms" className="hover:text-fg hover:underline">
                Terms
              </Link>
              <Link href="/legal/privacy" className="hover:text-fg hover:underline">
                Privacy
              </Link>
              <Link href="/legal/community-rules" className="hover:text-fg hover:underline">
                Community Rules
              </Link>
            </nav>
          </div>
        </footer>
      </div>
    </main>
  );
}
