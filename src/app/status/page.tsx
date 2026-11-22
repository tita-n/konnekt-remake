import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, MailQuestion } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { landingPath } from "@/lib/auth/landing";
import { tenantDb } from "@/lib/db/tenant";
import { attemptsLast24h, MAX_RESUBMISSIONS_PER_24H } from "@/lib/services/verification";
import { DECISION_REASON_LABELS } from "@/lib/validation/schemas";
import { accentCssVars } from "@/lib/domain/color";
import { formatDate } from "@/lib/utils";
import { ButtonLink } from "@/components/ui/button";
import { signOutAction } from "@/app/actions/auth";
import { LogoMark } from "@/components/brand/logo";
import { ClayIllustration } from "@/components/ui/clay-illustrations";
import { RubberStamp } from "@/components/ui/rubber-stamp";
import { StatusAutoRefresh } from "@/components/student/status-auto-refresh";

export const metadata: Metadata = { title: "Your verification status" };

export default async function StatusPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/status");
  const { user } = session;

  if (user.status === "SUSPENDED") redirect("/suspended");
  if (user.status === "DELETED_PENDING") redirect("/account/deleted");
  if (
    (user.status === "VERIFIED" || user.status === "ALUMNI") &&
    user.departmentNodeId &&
    user.level &&
    user.onboardingCompletedAt
  ) {
    redirect(landingPath(user));
  }

  const db = tenantDb(user.universityId);
  const [latest, attempts] = await Promise.all([
    db.verificationRequest.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        method: true,
        status: true,
        createdAt: true,
        decidedAt: true,
        decisionReason: true,
        decisionNote: true,
      },
    }),
    attemptsLast24h(user.id, user.universityId),
  ]);

  const attemptsLeft = Math.max(0, MAX_RESUBMISSIONS_PER_24H - attempts);
  const style = accentCssVars(user.university.accentColor) as React.CSSProperties;
  const supportEmail = "support@konnekt.ng";

  return (
    <div style={style} className="min-h-dvh bg-bg">
      <header className="mx-auto flex w-full max-w-md items-center justify-between px-4 pt-6">
        <LogoMark className="size-9 text-accent" />
        <form action={signOutAction}>
          <button
            type="submit"
            className="min-h-11 rounded-button px-3 text-small font-semibold text-fg-muted transition hover:bg-surface-2 hover:text-fg"
          >
            Log out
          </button>
        </form>
      </header>

      <main id="main" className="mx-auto w-full max-w-md px-4 pb-12 pt-8">
        {user.status === "PENDING" ? (
          <section aria-labelledby="status-heading" className="text-center">
            <div className="flex justify-center">
              <ClayIllustration kind="hourglass" />
            </div>
            <h1 id="status-heading" className="mt-4 text-h1 text-fg">
              We&apos;re checking your details
            </h1>
            <p className="mt-2 text-body text-fg-muted">
              A reviewer at {user.university.name} is looking at your {latest?.method === "VOUCH" ? "vouch request" : "student ID"}.
              Most requests are decided within a day.
            </p>
            <div className="mt-3 flex items-center justify-center gap-1.5" aria-hidden="true">
              <span className="size-2 rounded-full bg-accent/50 motion-safe:animate-pulse" />
              <span className="size-2 rounded-full bg-accent/75 motion-safe:animate-pulse [animation-delay:250ms]" />
              <span className="size-2 rounded-full bg-accent motion-safe:animate-pulse [animation-delay:500ms]" />
            </div>
            <div className="mt-6 rounded-card border border-border bg-surface p-4 text-left">
              <dl className="space-y-2.5 text-small">
                <div className="flex justify-between gap-3">
                  <dt className="text-fg-subtle">Submitted</dt>
                  <dd className="font-medium text-fg">{latest ? formatDate(latest.createdAt, { timeStyle: undefined }) : "—"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-fg-subtle">Method</dt>
                  <dd className="font-medium text-fg">
                    {latest?.method === "VOUCH" ? "Vouch from a course rep" : "Student ID card"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-fg-subtle">University</dt>
                  <dd className="font-medium text-fg">{user.university.shortName}</dd>
                </div>
              </dl>
            </div>
            <p className="mt-4 text-small text-fg-muted">
              You can finish your profile while you wait — it makes your first day on campus smoother.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <ButtonLink href="/onboarding" size="lg" fullWidth>
                {user.departmentNodeId && user.level ? "Review my profile" : "Finish my profile"}
              </ButtonLink>
              <ButtonLink href="/status" variant="secondary" size="lg" fullWidth>
                Check again
              </ButtonLink>
            </div>
            <StatusAutoRefresh />
          </section>
        ) : user.status === "REJECTED" ? (
          <section aria-labelledby="status-heading" className="text-center">
            <div className="flex justify-center py-4">
              <RubberStamp status="REJECTED" />
            </div>
            <h1 id="status-heading" className="mt-3 text-h1 text-fg">
              We couldn&apos;t verify you yet
            </h1>
            {latest?.decisionReason ? (
              <div className="mt-5 rounded-card border border-border bg-surface p-4 text-left">
                <p className="text-small font-semibold text-fg">What to fix</p>
                <p className="mt-1 text-small font-medium text-danger">{DECISION_REASON_LABELS[latest.decisionReason]}</p>
                {latest.decisionNote ? <p className="mt-2 text-small text-fg-muted">{latest.decisionNote}</p> : null}
                <p className="mt-2 text-tiny text-fg-subtle">Decided {latest.decidedAt ? formatDate(latest.decidedAt) : "recently"}</p>
              </div>
            ) : null}
            <p className="mt-4 text-body text-fg-muted">
              You can try again with a clearer document. You have{" "}
              <span className="font-semibold text-fg">{attemptsLeft} of {MAX_RESUBMISSIONS_PER_24H}</span> attempts left in the
              next 24 hours.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              {attemptsLeft > 0 ? (
                <ButtonLink href="/status/resubmit" size="lg" fullWidth>
                  Resubmit verification
                </ButtonLink>
              ) : (
                <p className="rounded-card bg-warning-soft px-3.5 py-3 text-small text-warning">
                  You&apos;ve used today&apos;s attempts. Come back in 24 hours or contact support.
                </p>
              )}
              <a
                href={`mailto:${supportEmail}?subject=Verification%20help`}
                className="inline-flex h-12 items-center justify-center rounded-button border border-border-strong bg-surface text-[0.9375rem] font-semibold text-fg hover:bg-surface-2"
              >
                Contact support
              </a>
            </div>
          </section>
        ) : (
          <section aria-labelledby="status-heading" className="text-center">
            <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-accent-soft">
              <MailQuestion aria-hidden="true" className="size-7 text-accent-ink" />
            </span>
            <h1 id="status-heading" className="mt-5 text-h1 text-fg">
              One step left
            </h1>
            <p className="mt-2 text-body text-fg-muted">
              Verify your student status to unlock {user.university.shortName} on Konnekt.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <ButtonLink href="/status/resubmit" size="lg" fullWidth>
                Verify now
              </ButtonLink>
              <ButtonLink href="/onboarding" variant="secondary" size="lg" fullWidth>
                Finish my profile first
              </ButtonLink>
            </div>
            <p className="mt-4 flex items-center justify-center gap-1.5 text-small text-fg-subtle">
              <CheckCircle2 aria-hidden="true" className="size-4" />
              Your data stays inside {user.university.shortName}.
            </p>
          </section>
        )}

        <p className="mt-8 text-center text-tiny leading-relaxed text-fg-subtle">
          Something wrong?{" "}
          <Link href={`mailto:${supportEmail}`} className="font-semibold text-accent-ink underline-offset-2 hover:underline">
            Contact support
          </Link>
          . Signed in as {user.email}.
        </p>
      </main>
    </div>
  );
}
