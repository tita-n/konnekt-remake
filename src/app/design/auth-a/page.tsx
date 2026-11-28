import { notFound } from "next/navigation";
import { AuthDirectionFrame } from "@/components/auth/directions/harness";

export const metadata = { title: "Friendly Campus · Konnekt" };

/**
 * Dev-only review route for auth direction Friendly Campus. Never reachable in
 * production, mirroring `/design` and `/design/preview/*`.
 */
export default async function AuthDirectionPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; theme?: string; u?: string; state?: string; brand?: string; chrome?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const query = await searchParams;
  // Every value below is a plain string fed into a fixed union of keys, and
  // each direction falls back to a safe default for anything it does not know.
  return (
    <AuthDirectionFrame
      direction="a"
      step={query.step}
      theme={query.theme}
      universityId={query.u}
      state={query.state}
      brand={query.brand}
      chrome={query.chrome !== "0"}
        />
  );
}
