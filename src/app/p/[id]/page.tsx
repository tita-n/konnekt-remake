import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, ExternalLink, Shield } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { accentCssVars } from "@/lib/domain/color";
import { getPostDetail, getPublicPreview } from "@/lib/services/posts";
import { loadSocialViewer } from "@/lib/services/social";
import { PostCard } from "@/components/pulse/post-card";
import { CommentSection } from "@/components/pulse/comments";
import { ButtonLink } from "@/components/ui/button";
import { LogoMark, UniversityShieldMark } from "@/components/brand/logo";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Post",
    robots: { index: false, follow: false },
    // Override the root layout's site-wide cards. A share preview must not
    // emit any Open Graph or Twitter metadata at all, not even the generic
    // site card, so a preview can never be attributed or counted.
    openGraph: null,
    twitter: null,
  };
}

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();

  if (session && (session.user.status === "VERIFIED" || session.user.status === "ALUMNI")) {
    const viewer = await loadSocialViewer(session.user);
    if (!viewer) notFound();
    const detail = await getPostDetail(viewer, id);
    if (!detail) notFound();
    const titleLabel = detail.post.type === "QUESTION" ? "Question" : "Post";
    return (
      <div
        style={accentCssVars(session.user.university.accentColor) as React.CSSProperties}
        className="min-h-dvh bg-bg pb-6"
      >
        <PageHeader backHref="/pulse" backLabel="Back to Pulse" title={titleLabel} />
        <main className="mx-auto w-full max-w-feed px-0 pt-2 sm:px-4">
          <PostCard post={detail.post} expanded compact />
          <CommentSection
            post={detail.post}
            initialComments={detail.comments}
            initialSort={detail.commentSort}
            viewer={{
              id: session.user.id,
              username: session.user.username,
              fullName: session.user.fullName,
              photoUrl: session.user.photoUrl,
            }}
          />
        </main>
      </div>
    );
  }

  const preview = await getPublicPreview(id);
  return <PublicPreview postId={id} preview={preview} />;
}

function PageHeader({ backHref, backLabel, title }: { backHref: string; backLabel: string; title: string }) {
  return (
    <header className="glass sticky top-0 z-40 border-x-0 border-t-0 border-b border-border/80">
      <div className="mx-auto flex h-14 max-w-feed items-center gap-2 px-2">
        <Link
          href={backHref}
          aria-label={backLabel}
          className="flex size-11 items-center justify-center rounded-full text-fg transition hover:bg-surface-2"
        >
          <ArrowLeft aria-hidden="true" className="size-6" />
        </Link>
        <h1 className="flex-1 text-center font-display text-h2 font-bold text-fg">{title}</h1>
        <span className="size-11" aria-hidden="true" />
      </div>
    </header>
  );
}

function PublicPreview({
  postId,
  preview,
}: {
  postId: string;
  preview: { kind: "preview"; firstLine: string } | { kind: "generic" };
}) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-bg px-5 pb-10 pt-5 text-fg">
      <header className="border-b border-border pb-4">
        <Link href="/" className="inline-flex items-center gap-2.5" aria-label="Konnekt home">
          <LogoMark className="size-9 text-accent" />
          <span className="font-display text-h1 font-extrabold tracking-tight text-fg">Konnekt</span>
        </Link>
      </header>

      <div className="mt-6 overflow-hidden rounded-card border border-border bg-surface p-4">
        {preview.kind === "preview" ? (
          <>
            <p className="select-none text-[1.0625rem] leading-relaxed text-fg blur-[4px]" aria-hidden="true">
              {preview.firstLine}
            </p>
          </>
        ) : (
          <div className="py-5 text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent-ink">
              <Shield aria-hidden="true" className="size-6" />
            </span>
            <p className="mt-2.5 text-body font-semibold text-fg">This post is only available inside Konnekt.</p>
            <p className="mt-1 text-small text-fg-muted">It isn&apos;t shared publicly.</p>
          </div>
        )}
      </div>

      <div className="mt-5 flex items-center gap-3.5 rounded-card bg-accent-soft px-4 py-3.5">
        <UniversityShieldMark className="size-9 shrink-0" />
        <span className="h-9 w-px shrink-0 bg-accent/25" aria-hidden="true" />
        <p className="text-small font-medium leading-snug text-accent-soft-fg">
          This post is shared with verified students on Konnekt.
        </p>
      </div>

      <div className="mt-6 space-y-3">
        {/* Neo-brutalist primary CTA allowed on Public Share Preview ONLY (Spec Section 5B & 7.O) */}
        <ButtonLink
          href={`/login?next=${encodeURIComponent(`/p/${postId}`)}`}
          fullWidth
          size="lg"
          className="rounded-full border-2 border-[#12141A] shadow-[4px_4px_0_#12141A] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_#12141A] dark:border-fg dark:shadow-[4px_4px_0_rgba(242,243,245,0.85)]"
          leftIcon={<ExternalLink aria-hidden="true" className="size-4" />}
        >
          Open in Konnekt
        </ButtonLink>
        <ButtonLink
          href="/install"
          variant="secondary"
          fullWidth
          size="lg"
          className="rounded-full"
          leftIcon={<Download aria-hidden="true" className="size-4" />}
        >
          Install the app
        </ButtonLink>
        <Link
          href={`/login?next=${encodeURIComponent(`/p/${postId}`)}`}
          className="flex min-h-11 items-center justify-center text-small font-semibold text-accent-ink underline underline-offset-4 hover:opacity-80"
        >
          Log in
        </Link>
      </div>

      <footer className="mt-auto flex items-center justify-center gap-4 border-t border-border pt-5 text-small text-fg-muted">
        <Link href="/legal/terms" className="inline-flex min-h-11 items-center hover:text-fg hover:underline">
          Terms
        </Link>
        <span aria-hidden="true">·</span>
        <Link href="/legal/privacy" className="inline-flex min-h-11 items-center hover:text-fg hover:underline">
          Privacy
        </Link>
      </footer>
    </main>
  );
}
