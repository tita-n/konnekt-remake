import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { findActiveUniversityBySlug } from "@/lib/services/universities";
import { accentCssVars } from "@/lib/domain/color";
import { AuthShell } from "@/components/auth/auth-shell";
import { StudentEmailForm } from "@/components/auth/student-email-form";
import { Stepper } from "@/components/ui/navigation";

export const metadata: Metadata = { title: "Verify with your student email" };

export default async function StudentEmailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const university = await findActiveUniversityBySlug(slug);
  if (!university) notFound();
  if (university.studentEmailDomains.length === 0) redirect(`/signup/${slug}`);

  return (
    <div style={accentCssVars(university.accentColor) as React.CSSProperties}>
      <div className="mb-6">
        <Stepper steps={["Verify", "Account", "Profile"]} current={0} />
      </div>
      <AuthShell
        title="Use your student email"
        description="This is the fastest way to prove you're a student. No document review, no waiting."
        backHref={`/signup/${slug}`}
        backLabel={university.name}
      >
        <StudentEmailForm slug={slug} shortName={university.shortName} domains={university.studentEmailDomains} />
      </AuthShell>
    </div>
  );
}
