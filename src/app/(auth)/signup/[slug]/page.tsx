import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CreditCard, Mail, ShieldCheck, Users } from "lucide-react";
import { findActiveUniversityBySlug } from "@/lib/services/universities";
import { accentCssVars } from "@/lib/domain/color";
import { AuthShell } from "@/components/auth/auth-shell";
import { UniversityShieldMark } from "@/components/brand/logo";
import { Stepper } from "@/components/ui/navigation";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const university = await findActiveUniversityBySlug(slug);
  return { title: university ? `Join ${university.name}` : "Join Konnekt" };
}

export default async function ChooseVerificationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const university = await findActiveUniversityBySlug(slug);
  if (!university) notFound();

  const voucherCount = university.vouchingEnabled
    ? await (await import("@/lib/services/vouchers")).countVouchers(university.id)
    : 0;

  const hasAnyMethod = university.studentEmailDomains.length > 0 || university.idCardEnabled || voucherCount > 0;
  const style = accentCssVars(university.accentColor) as React.CSSProperties;

  return (
    <div style={style}>
      <div className="mb-5 flex items-center gap-3 rounded-card border border-border bg-surface p-3.5">
        {university.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={university.logoUrl} alt="" width={44} height={44} className="size-11 rounded-[13px] object-cover" />
        ) : (
          <UniversityShieldMark className="size-11 shrink-0" />
        )}
        <div className="min-w-0">
          <p className="truncate text-[0.9375rem] font-semibold text-fg">{university.name}</p>
          <p className="text-small text-fg-subtle">
            {university.labels.college}s, {university.labels.faculty.toLowerCase()}s and {university.labels.department.toLowerCase()}s
          </p>
        </div>
      </div>

      <div className="mb-6">
        <Stepper steps={["Verify", "Account", "Profile"]} current={0} />
      </div>

      <AuthShell
        title="Prove you're a student"
        description="Pick whichever is easiest. Every option ends with a verified student account — nothing is public until you finish."
        backHref="/signup"
        backLabel="Change university"
      >
        {!hasAnyMethod ? (
          <div className="rounded-card border border-border bg-surface p-4">
            <p className="text-[0.9375rem] font-semibold text-fg">Verification isn&apos;t open yet</p>
            <p className="mt-1 text-small text-fg-muted">
              {university.name} has not finished setting up student verification. Try again soon.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {university.studentEmailDomains.length > 0 ? (
              <MethodCard
                href={`/signup/${university.slug}/email`}
                icon={<Mail aria-hidden="true" className="size-5" />}
                title="Use your student email"
                description={`We'll send a 6-digit code to your ${university.shortName} email. Fastest option.`}
                recommended
              />
            ) : null}

            {university.idCardEnabled ? (
              <MethodCard
                href={`/signup/${university.slug}/id`}
                icon={<CreditCard aria-hidden="true" className="size-5" />}
                title="Upload your student ID"
                description="Use your ID card or course registration slip. A reviewer checks it, usually within a day."
              />
            ) : null}

            {voucherCount > 0 ? (
              <MethodCard
                href={`/signup/${university.slug}/vouch`}
                icon={<Users aria-hidden="true" className="size-5" />}
                title="Get vouched for"
                description="Ask a course rep or reviewer who already knows you to confirm you're a student."
              />
            ) : null}
          </ul>
        )}

        {university.studentEmailDomains.length > 0 && university.idCardEnabled ? (
          <p className="mt-5 rounded-card bg-surface-2 px-3.5 py-3 text-small text-fg-muted">
            Can&apos;t get into your school email?{" "}
            <Link href={`/signup/${university.slug}/id`} className="font-semibold text-accent-ink underline-offset-2 hover:underline">
              Use your ID card instead
            </Link>
            .
          </p>
        ) : null}

        <p className="mt-6 flex items-start gap-2 text-tiny leading-relaxed text-fg-subtle">
          <ShieldCheck aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          ID photos are stored privately, shown only to this university&apos;s reviewers, and deleted automatically once a
          decision is made.
        </p>
      </AuthShell>
    </div>
  );
}

function MethodCard({
  href,
  icon,
  title,
  description,
  recommended = false,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  recommended?: boolean;
}) {
  return (
    <li>
      <Link
        href={href}
        className="group flex items-start gap-3.5 rounded-card border border-border bg-surface p-4 transition hover:border-border-strong hover:bg-surface-2/40"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-accent-soft text-accent-ink">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-[0.9375rem] font-semibold text-fg">{title}</span>
            {recommended ? (
              <span className="rounded-chip bg-accent px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wide text-accent-fg">
                Fastest
              </span>
            ) : null}
          </span>
          <span className="mt-0.5 block text-small text-fg-muted">{description}</span>
        </span>
      </Link>
    </li>
  );
}
