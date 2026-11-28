import type { Metadata } from "next";
import Link from "next/link";
import { Download, ExternalLink, FileText, ShieldCheck, Users } from "lucide-react";
import { requireStudent } from "@/lib/auth/guards";
import { SettingsNav } from "@/components/settings/settings-nav";

export const metadata: Metadata = { title: "About Konnekt" };

const version = "0.1.0 · Phase 0";

export default async function AboutPage() {
  const user = await requireStudent("/settings/about");
  return (
    <div>
      <SettingsNav />
      <div className="px-4 pt-5">
        <h1 className="text-h1 text-fg">About Konnekt</h1>
        <p className="mt-1 text-small text-fg-muted">Version {version}</p>

        <section className="mt-5 rounded-card border border-border bg-surface p-4">
          <h2 className="text-h3 text-fg">Your data</h2>
          <p className="mt-1 text-small text-fg-muted">
            Download everything Konnekt knows about you as JSON. Deletion is in Settings → Account.
          </p>
          <a
            href="/api/account/export"
            className="mt-3 inline-flex -my-1 min-h-11 items-center gap-2 rounded-button border border-border-strong bg-surface px-3 text-small font-semibold text-fg hover:bg-surface-2"
          >
            <Download aria-hidden="true" className="size-4" />
            Export my data (JSON)
          </a>
          <p className="mt-2 text-tiny text-fg-subtle">Signed in as {user.email}.</p>
        </section>

        <section className="mt-4 rounded-card border border-border bg-surface p-4">
          <h2 className="text-h3 text-fg">Legal</h2>
          <ul className="mt-2 divide-y divide-border">
            {[
              { href: "/legal/terms", label: "Terms of Service", icon: FileText },
              { href: "/legal/privacy", label: "Privacy Policy", icon: ShieldCheck },
              { href: "/legal/community-rules", label: "Community Rules", icon: Users },
            ].map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="flex items-center gap-2.5 py-2.5 text-small font-medium text-fg hover:text-accent-ink">
                  <item.icon aria-hidden="true" className="size-4 text-fg-subtle" />
                  {item.label}
                  <ExternalLink aria-hidden="true" className="ml-auto size-3.5 text-fg-subtle" />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-4 rounded-card border border-border bg-surface p-4">
          <h2 className="text-h3 text-fg">Support</h2>
          <p className="mt-1 text-small text-fg-muted">
            Email{" "}
            <a href="mailto:support@konnekt.ng" className="font-semibold text-accent-ink underline-offset-2 hover:underline">
              support@konnekt.ng
            </a>{" "}
            or speak to an admin at {user.university.name}.
          </p>
        </section>

        <p className="mt-5 text-center text-tiny leading-relaxed text-fg-subtle">
          Konnekt is built for Nigerian campuses: fast on slow data, private by default, and verified students only.
        </p>
      </div>
    </div>
  );
}
