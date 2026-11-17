import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { findActiveUniversityBySlug } from "@/lib/services/universities";
import { accentCssVars } from "@/lib/domain/color";
import { AuthShell } from "@/components/auth/auth-shell";
import { IdCardForm } from "@/components/auth/id-card-form";
import { Stepper } from "@/components/ui/navigation";

export const metadata: Metadata = { title: "Verify with your student ID" };

export default async function IdCardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const university = await findActiveUniversityBySlug(slug);
  if (!university) notFound();
  if (!university.idCardEnabled) redirect(`/signup/${slug}`);

  return (
    <div style={accentCssVars(university.accentColor) as React.CSSProperties}>
      <div className="mb-6">
        <Stepper steps={["Verify", "Account", "Profile"]} current={0} />
      </div>
      <AuthShell
        title="Upload your student ID"
        description="A real person at your university reviews it. Most requests are decided within a day."
        backHref={`/signup/${slug}`}
        backLabel={university.name}
      >
        <IdCardForm
          slug={slug}
          matricPattern={university.matricPattern}
          matricExample={matricExample(university.matricPattern)}
        />
      </AuthShell>
    </div>
  );
}

function matricExample(pattern: string): string {
  if (pattern.includes("[A-Z]") && pattern.includes("\\d{4}")) return "CSC/2022/1041";
  if (pattern.includes("\\d{2}/\\d{4}")) return "20/1234/001";
  return "190404021";
}
