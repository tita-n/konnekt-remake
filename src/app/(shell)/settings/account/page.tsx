import type { Metadata } from "next";
import { requireStudent } from "@/lib/auth/guards";
import { getSession, listSessions } from "@/lib/auth/session";
import { timeAgo } from "@/lib/utils";
import { SettingsNav } from "@/components/settings/settings-nav";
import { AccountSettings } from "@/components/settings/account-settings";
import { Button } from "@/components/ui/button";
import { signOutEverywhereAction } from "@/app/actions/auth";
import { revokeSessionAction } from "./actions";

export const metadata: Metadata = { title: "Account settings" };

function deviceLabel(userAgent: string | null): string {
  if (!userAgent) return "Unknown device";
  if (/iphone|ipad/i.test(userAgent)) return "iPhone or iPad";
  if (/android/i.test(userAgent)) return "Android device";
  if (/windows/i.test(userAgent)) return "Windows computer";
  if (/macintosh|mac os/i.test(userAgent)) return "Mac";
  if (/linux/i.test(userAgent)) return "Linux computer";
  return "Browser";
}

export default async function AccountSettingsPage() {
  const user = await requireStudent("/settings/account");
  const current = await getSession();
  const sessions = await listSessions(user.id);

  return (
    <div>
      <SettingsNav />
      <div className="px-4 pt-5">
        <h1 className="text-h1 text-fg">Account</h1>
        <p className="mt-1 text-small text-fg-muted">Security, devices and the exit door.</p>

        <div className="mt-5">
          <AccountSettings email={user.email} username={user.username} emailVerified />
        </div>

        <section className="mt-5 rounded-card border border-border bg-surface p-4">
          <h2 className="text-h3 text-fg">Where you&apos;re signed in</h2>
          <ul className="mt-3 divide-y divide-border">
            {sessions.map((session) => {
              const isCurrent = current?.session.id === session.id;
              return (
                <li key={session.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-small font-medium text-fg">
                      {deviceLabel(session.userAgent)}
                      {isCurrent ? <span className="ml-2 text-tiny font-semibold text-accent">This device</span> : null}
                    </p>
                    <p className="text-tiny text-fg-subtle">
                      Active {timeAgo(session.lastSeenAt)} · expires {timeAgo(session.expiresAt).replace(" ago", "")}
                    </p>
                  </div>
                  {isCurrent ? null : (
                    <form action={revokeSessionAction}>
                      <input type="hidden" name="sessionId" value={session.id} />
                      <Button type="submit" variant="ghost" size="sm">
                        Sign out
                      </Button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
          <form action={signOutEverywhereAction} className="mt-3">
            <Button type="submit" variant="secondary" size="sm">
              Log out of all devices
            </Button>
          </form>
        </section>
      </div>
    </div>
  );
}
