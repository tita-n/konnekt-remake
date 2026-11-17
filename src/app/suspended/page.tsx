import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AlertTriangle, Mail } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { landingPath } from "@/lib/auth/landing";
import { tenantDb } from "@/lib/db/tenant";
import { signOutAction } from "@/app/actions/auth";

export const metadata: Metadata = { title: "Account suspended" };

export default async function SuspendedPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const { user } = session;
  if (user.status !== "SUSPENDED") redirect(landingPath(user));

  const lastSuspension = await tenantDb(user.universityId).auditLog.findFirst({
    where: { targetType: "User", targetId: user.id, action: "student.suspended" },
    orderBy: { createdAt: "desc" },
    select: { metadata: true, createdAt: true },
  });
  const reason =
    lastSuspension?.metadata && typeof lastSuspension.metadata === "object" && "reason" in lastSuspension.metadata
      ? String((lastSuspension.metadata as Record<string, unknown>).reason ?? "")
      : "";

  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center px-5 py-12">
      <div className="w-full max-w-md text-center">
        <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-danger-soft">
          <AlertTriangle aria-hidden="true" className="size-7 text-danger" />
        </span>
        <h1 className="mt-5 text-h1 text-fg">Your account is suspended</h1>
        <p className="mt-2 text-body text-fg-muted">
          You can&apos;t use {user.university.shortName} on Konnekt right now. This is usually about a community rule or a
          verification concern.
        </p>
        {reason ? (
          <div className="mt-5 rounded-card border border-border bg-surface p-4 text-left">
            <p className="text-small font-semibold text-fg">Reason recorded</p>
            <p className="mt-1 text-small text-fg-muted">{reason}</p>
          </div>
        ) : null}
        <p className="mt-5 text-small text-fg-muted">
          Contact your university admin or our support team to ask for a review. Include your username, @{user.username}.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <a
            href={`mailto:support@konnekt.ng?subject=Suspension%20review&body=Username%3A%20%40${encodeURIComponent(user.username)}`}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-button bg-accent text-[0.9375rem] font-semibold text-accent-fg"
          >
            <Mail aria-hidden="true" className="size-4" />
            Contact support
          </a>
          <form action={signOutAction}>
            <button type="submit" className="h-11 w-full rounded-button text-small font-semibold text-fg-muted hover:text-fg">
              Log out
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
