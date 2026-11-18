import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, ExternalLink, ShieldCheck } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { accentCssVars } from "@/lib/domain/color";
import { getPostDetail, getPublicPreview } from "@/lib/services/posts";
import { loadSocialViewer } from "@/lib/services/social";
import { PostCard } from "@/components/pulse/post-card";
import { CommentSection } from "@/components/pulse/comments";
import { ButtonLink } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Post",
    robots: { index: false, follow: false },
    // Deliberately no Open Graph or Twitter card: a share preview must not
    // leak content, an author or a count.
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
    return (
      <div
        style={accentCssVars(session.user.university.accentColor) as React.CSSProperties}
        className="min-h-dvh bg-bg pb-4"
      >
        <PageHeader backHref="/pulse" backLabel="Back to Pulse" />
        <main className="mx-auto w-full max-w-2xl">
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

function PageHeader({ backHref, backLabel }: { backHref: string; backLabel: string }) {
  return (
    <header className="glass sticky top-0 z-40 border-b border-border">
      <div className="mx-auto flex h-14 max-w-2xl items-center gap-2 px-2">
        <Link href={backHref} aria-label={backLabel} className="flex size-11 items-center justify-center rounded-full hover:bg-surface-2">
          <ArrowLeft aria-hidden="true" className="size-5" />
        </Link>
        <p className="flex-1 text-center text-[0.9375rem] font-semibold text-fg">Post</p>
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
    <main className="mx-auto min-h-dvh w-full max-w-lg bg-surface px-5 pb-10 pt-6 text-fg">
      <Link href="/" className="inline-flex items-center gap-2" aria-label="Konnekt home">
        <span className="flex size-9 items-center justify-center rounded-[10px] bg-accent text-base font-bold text-accent-fg">K</span>
        <span className="font-display text-xl font-bold tracking-tight">Konnekt</span>
      </Link>

      <div className="mt-8 rounded-card border border-border bg-surface p-4 shadow-card">
        {preview.kind === "preview" ? (
          <>
            <p className="select-none text-body leading-relaxed text-fg blur-[6px]" aria-hidden="true">
              {preview.firstLine}
            </p>
            <p className="mt-1 text-tiny text-fg-subtle">Only the first line is shown outside the app.</p>
          </>
        ) : (
          <div className="py-4 text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent">
              <ShieldCheck aria-hidden="true" className="size-6" />
            </span>
            <p className="mt-2 text-body font-semibold text-fg">This post is only available inside Konnekt.</p>
            <p className="mt-1 text-small text-fg-muted">It isn&apos;t shared publicly.</p>
          </div>
        )}
      </div>

      <div className="mt-5 flex items-start gap-3 rounded-card bg-accent-soft px-4 py-3.5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-accent">
          <ShieldCheck aria-hidden="true" className="size-5" />
        </span>
        <p className="text-small leading-relaxed text-accent-soft-fg">
          This post is shared with verified students on Konnekt. Open the app to see it in context.
        </p>
      </div>

      <div className="mt-6 space-y-3">
        <ButtonLink href={`/login?next=${encodeURIComponent(`/p/${postId}`)}`} fullWidth size="lg" leftIcon={<ExternalLink aria-hidden="true" className="size-4" />}>
          Open in Konnekt
        </ButtonLink>
        <ButtonLink href="/install" variant="secondary" fullWidth size="lg" leftIcon={<Download aria-hidden="true" className="size-4" />}>
          Install the app
        </ButtonLink>
        <Link href={`/login?next=${encodeURIComponent(`/p/${postId}`)}`} className="block py-2 text-center text-small font-semibold text-accent underline-offset-2 hover:underline">
          Log in
        </Link>
      </div>

      <footer className="mt-10 flex items-center justify-center gap-4 border-t border-border pt-5 text-tiny text-fg-subtle">
        <Link href="/legal/terms" className="hover:underline">Terms</Link>
        <span aria-hidden="true">·</span>
        <Link href="/legal/privacy" className="hover:underline">Privacy</Link>
      </footer>
    </main>
  );
}
