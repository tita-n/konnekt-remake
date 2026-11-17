import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { attemptsLast24h, MAX_RESUBMISSIONS_PER_24H } from "@/lib/services/verification";
import { listVouchers } from "@/lib/services/vouchers";
import { accentCssVars } from "@/lib/domain/color";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResubmitForms } from "@/components/student/resubmit-forms";
import { LogoMark } from "@/components/brand/logo";

export const metadata: Metadata = { title: "Try verification again" };

export default async function ResubmitPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/status/resubmit");
  const { user } = session;
  if (user.status === "SUSPENDED") redirect("/suspended");
  if (user.status === "DELETED_PENDING") redirect("/account/deleted");
  if (user.status === "PENDING") redirect("/status");
  if (user.status === "VERIFIED" || user.status === "ALUMNI") redirect("/pulse");

  const attempts = await attemptsLast24h(user.id, user.universityId);
  if (attempts >= MAX_RESUBMISSIONS_PER_24H) redirect("/status");

  const vouchers = user.university.vouchingEnabled ? await listVouchers(user.universityId) : [];

  return (
    <div style={accentCssVars(user.university.accentColor) as React.CSSProperties} className="min-h-dvh bg-bg">
      <header className="mx-auto w-full max-w-md px-5 pt-6">
        <LogoMark className="size-9 text-accent" />
      </header>
      <main id="main" className="mx-auto w-full max-w-md px-5 pb-12 pt-6">
        <AuthShell
          title="Try verification again"
          description={`You have ${MAX_RESUBMISSIONS_PER_24H - attempts} attempts left in the next 24 hours. A clearer document usually fixes it.`}
          backHref="/status"
          backLabel="Back to status"
        >
          <ResubmitForms
            idCardEnabled={user.university.idCardEnabled}
            vouchers={vouchers}
            matricPattern={user.university.matricPattern}
            defaultMatric={user.matricNumber ?? ""}
          />
        </AuthShell>
      </main>
    </div>
  );
}
