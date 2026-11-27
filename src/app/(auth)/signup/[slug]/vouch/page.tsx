import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { findActiveUniversityBySlug } from "@/lib/services/universities";
import { listVouchers } from "@/lib/services/vouchers";
import { accentCssVars } from "@/lib/domain/color";
import { AuthShell } from "@/components/auth/auth-shell";
import { VouchForm } from "@/components/auth/vouch-form";
import { Stepper } from "@/components/ui/navigation";

export const metadata: Metadata = { title: "Get vouched for" };

export default async function VouchPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const university = await findActiveUniversityBySlug(slug);
  if (!university) notFound();
  if (!university.vouchingEnabled) redirect(`/signup/${slug}`);

  const vouchers = await listVouchers(university.id);

  if (vouchers.length === 0) {
    return (
      <div style={accentCssVars(university.accentColor) as React.CSSProperties}>
        <div className="mb-6">
          <Stepper steps={["Verify", "Account", "Profile"]} current={0} />
        </div>
        <AuthShell
          title="No vouchers listed yet"
          description={`${university.name} allows vouching, but has not listed a course rep or reviewer. Ask your department, or verify another way.`}
          backHref={`/signup/${slug}`}
          backLabel={university.name}
        >
          <p className="rounded-card border border-border bg-surface-2 px-3.5 py-3 text-small text-fg-muted">
            Vouching opens as soon as a reviewer or official is listed. Your student email or ID card works now.
          </p>
        </AuthShell>
      </div>
    );
  }

  return (
    <div style={accentCssVars(university.accentColor) as React.CSSProperties}>
      <div className="mb-6">
        <Stepper steps={["Verify", "Account", "Profile"]} current={0} />
      </div>
      <AuthShell
        title="Ask someone to vouch"
        description="Pick a course rep or reviewer listed by your university who can confirm you're a student."
        backHref={`/signup/${slug}`}
        backLabel={university.name}
      >
        <VouchForm slug={slug} vouchers={vouchers} matricExample="CSC/2022/1041" />
      </AuthShell>
    </div>
  );
}
