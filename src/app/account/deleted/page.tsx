import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CalendarClock, ShieldCheck } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { landingPath } from "@/lib/auth/landing";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/app/actions/auth";
import { cancelDeletionAction } from "@/app/account/actions";

export const metadata: Metadata = { title: "Account pending deletion" };

export default async function DeletedPendingPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const { user } = session;
  if (user.status !== "DELETED_PENDING") redirect(landingPath(user));

  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center px-5 py-12">
      <div className="w-full max-w-md">
        <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-warning-soft">
          <CalendarClock aria-hidden="true" className="size-7 text-warning" />
        </span>
        <h1 className="mt-5 text-center text-h1 text-fg">Your account is scheduled for deletion</h1>
        <p className="mt-2 text-center text-body text-fg-muted">
          Nothing has been deleted yet. You have until{" "}
          <span className="font-semibold text-fg">
            {user.purgeAfter ? formatDate(user.purgeAfter) : "30 days from your request"}
          </span>{" "}
          to change your mind.
        </p>

        <div className="mt-6 rounded-card border border-border bg-surface p-4">
          <h2 className="text-h3 text-fg">What happens next</h2>
          <ul className="mt-2 space-y-2 text-small text-fg-muted">
            <li>You are signed out everywhere and cannot log in.</li>
            <li>If you do nothing, your profile, photo and personal details are permanently deleted on that date.</li>
            <li>Verification decision records are kept without your ID image, for safety and audit.</li>
          </ul>
        </div>

        <div className="mt-6 flex flex-col gap-2">
          <form action={cancelDeletionAction}>
            <Button type="submit" size="lg" fullWidth leftIcon={<ShieldCheck aria-hidden="true" className="size-4" />}>
              Keep my account
            </Button>
          </form>
          <form action={signOutAction}>
            <Button type="submit" variant="secondary" size="lg" fullWidth>
              Log out
            </Button>
          </form>
        </div>
        <p className="mt-4 text-center text-small text-fg-muted">
          Need help? Email{" "}
          <a href="mailto:support@konnekt.ng" className="font-semibold text-accent-ink underline-offset-2 hover:underline">
            support@konnekt.ng
          </a>{" "}
          with your username, @{user.username}.
        </p>
      </div>
    </main>
  );
}
