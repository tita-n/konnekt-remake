import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { platformDb } from "@/lib/db/platform";
import { getSession } from "@/lib/auth/session";
import { sha256 } from "@/lib/crypto";
import { AcceptInviteForm } from "@/components/admin/accept-invite-form";
import { buttonStyles } from "@/components/ui/button-styles";

export const metadata: Metadata = { title: "Staff invitation", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await platformDb.roleInvite.findUnique({
    where: { tokenHash: sha256(token) },
    select: {
      email: true,
      role: true,
      expiresAt: true,
      acceptedAt: true,
      university: { select: { name: true, accentColor: true } },
    },
  });
  const session = await getSession();
  const next = `/invite/${token}`;

  const shell = (children: React.ReactNode) => (
    <main id="main" className="flex min-h-dvh items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-5 flex items-center gap-2 text-fg">
          <span className="flex size-11 items-center justify-center rounded-[10px] bg-accent text-accent-fg">
            <ShieldCheck aria-hidden="true" className="size-5" />
          </span>
          <span className="text-h3 font-bold">Konnekt staff</span>
        </div>
        <div className="rounded-card border border-border bg-surface p-5 shadow-card">{children}</div>
      </div>
    </main>
  );

  if (!invite) {
    return shell(
      <>
        <h1 className="text-h2 text-fg">This link is not valid</h1>
        <p className="mt-2 text-small text-fg-muted">
          Ask the admin who invited you to send a new invitation. Invitations are single use.
        </p>
        <Link href="/login" className={buttonStyles({ fullWidth: true, className: "mt-4" })}>
          Go to sign in
        </Link>
      </>,
    );
  }

  if (invite.acceptedAt) {
    return shell(
      <>
        <h1 className="text-h2 text-fg">Already accepted</h1>
        <p className="mt-2 text-small text-fg-muted">This invitation has already been used. Sign in to open your console.</p>
        <Link href="/admin" className={buttonStyles({ fullWidth: true, className: "mt-4" })}>
          Open console
        </Link>
      </>,
    );
  }

  if (invite.expiresAt < new Date()) {
    return shell(
      <>
        <h1 className="text-h2 text-fg">Invitation expired</h1>
        <p className="mt-2 text-small text-fg-muted">This invitation is older than 7 days. Ask for a fresh one.</p>
        <Link href="/login" className={buttonStyles({ fullWidth: true, className: "mt-4" })}>
          Go to sign in
        </Link>
      </>,
    );
  }

  const roleLabel = invite.role.replaceAll("_", " ").toLowerCase();
  const universityName = invite.university?.name ?? "the platform";

  if (!session) {
    return shell(
      <>
        <h1 className="text-h2 text-fg">You&apos;re invited</h1>
        <p className="mt-2 text-small text-fg-muted">
          Join <strong className="text-fg">{universityName}</strong> as {roleLabel}. Sign in (or create an account) with{" "}
          <strong className="text-fg">{invite.email}</strong> to accept.
        </p>
        <Link href={`/login?next=${encodeURIComponent(next)}`} className={buttonStyles({ fullWidth: true, className: "mt-4" })}>
          Sign in to accept
        </Link>
        <Link href={`/signup?next=${encodeURIComponent(next)}`} className={buttonStyles({ variant: "secondary", fullWidth: true, className: "mt-2" })}>
          Create an account
        </Link>
      </>,
    );
  }

  if (session.user.email.toLowerCase() !== invite.email.toLowerCase()) {
    return shell(
      <>
        <h1 className="text-h2 text-fg">Wrong account</h1>
        <p className="mt-2 text-small text-fg-muted">
          This invitation was sent to <strong className="text-fg">{invite.email}</strong>, but you are signed in as{" "}
          <strong className="text-fg">{session.user.email}</strong>. Sign in with the invited address to continue.
        </p>
        <Link href={`/login?next=${encodeURIComponent(next)}`} className={buttonStyles({ fullWidth: true, className: "mt-4" })}>
          Switch account
        </Link>
      </>,
    );
  }

  return shell(
    <>
      <h1 className="text-h2 text-fg">Accept your role</h1>
      <p className="mt-2 text-small text-fg-muted">
        You&apos;ll get <strong className="text-fg">{roleLabel}</strong> access at {universityName}. You can accept once.
      </p>
      <div className="mt-4">
        <AcceptInviteForm token={token} />
      </div>
    </>,
  );
}
