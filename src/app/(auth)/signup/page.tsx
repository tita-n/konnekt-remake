import type { Metadata } from "next";
import { listActiveUniversities } from "@/lib/services/universities";
import { AuthShell } from "@/components/auth/auth-shell";
import { UniversityPicker } from "@/components/auth/university-picker";

export const metadata: Metadata = { title: "Find your university" };

export default async function SignupPage() {
  const universities = await listActiveUniversities();

  return (
    <AuthShell
      title="Find your university"
      description={
        <>
          Konnekt is one app for many campuses. Pick your school to join its private space.
        </>
      }
      backHref="/"
      backLabel="Home"
    >
      <UniversityPicker universities={universities} />
      <p className="mt-8 text-center text-small text-fg-muted">
        Already have an account?{" "}
        <a href="/login" className="font-semibold text-accent underline-offset-2 hover:underline">
          Log in
        </a>
      </p>
    </AuthShell>
  );
}
