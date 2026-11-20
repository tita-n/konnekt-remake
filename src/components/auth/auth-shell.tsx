import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function AuthShell({
  title,
  description,
  children,
  backHref,
  backLabel = "Back",
  eyebrow,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  backHref?: string;
  backLabel?: string;
  eyebrow?: string;
}) {
  return (
    <div className="animate-fade-up">
      {backHref ? (
        <Link
          href={backHref}
          className="mb-5 inline-flex items-center gap-1.5 rounded-button text-small font-semibold text-fg-muted transition hover:text-fg"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          {backLabel}
        </Link>
      ) : null}
      {eyebrow ? <p className="mb-1.5 text-tiny font-bold uppercase tracking-[0.12em] text-accent-ink">{eyebrow}</p> : null}
      <h1 className="text-h1 text-fg">{title}</h1>
      {description ? <div className="mt-2 text-body text-fg-muted">{description}</div> : null}
      <div className="mt-6">{children}</div>
    </div>
  );
}

export function FormMessage({ error, message }: { error?: string | null; message?: string | null }) {
  if (!error && !message) return null;
  return (
    <div
      role={error ? "alert" : "status"}
      className={
        error
          ? "rounded-card border border-danger/40 bg-danger-soft px-3.5 py-3 text-small font-medium text-danger"
          : "rounded-card border border-success/30 bg-success-soft px-3.5 py-3 text-small font-medium text-success"
      }
    >
      {error ?? message}
    </div>
  );
}
