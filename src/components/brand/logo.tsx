import { cn } from "@/lib/utils";

/**
 * Konnekt speech-K mark matching the designer mockups: rounded indigo square
 * speech bubble with crisp white K monogram.
 */
export function LogoMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={cn("size-10 shrink-0 text-accent", className)}
      fill="none"
    >
      <path
        d="M12 4h24a8 8 0 0 1 8 8v20a8 8 0 0 1-8 8H19.5L11 45.5V40h-.5A6.5 6.5 0 0 1 4 33.5V12a8 8 0 0 1 8-8Z"
        fill="currentColor"
      />
      <path
        d="M17.5 14v18M17.5 23.5l10-9.5M20.5 21.5L28.5 32"
        stroke="white"
        strokeWidth="3.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * University shield crest with open book motif, used in the top bar, Welcome,
 * Public share preview, Verified student card, and Admin sidebar.
 */
export function UniversityShieldMark({
  logoUrl,
  shortName,
  className,
}: {
  logoUrl?: string | null;
  shortName?: string;
  className?: string;
}) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={shortName ? `${shortName} logo` : ""}
        width={48}
        height={48}
        className={cn("size-7 shrink-0 rounded-lg object-contain", className)}
      />
    );
  }
  return (
    <svg
      viewBox="0 0 48 48"
      aria-hidden="true"
      className={cn("size-7 shrink-0 text-accent", className)}
      fill="none"
    >
      <path
        d="M24 4L8 10.5V23c0 10.4 6.8 18.6 16 21 9.2-2.4 16-10.6 16-21V10.5L24 4Z"
        fill="currentColor"
      />
      <path
        d="M24 17.5c-2.6-1.7-5.9-2-9.5-1.3v12.2c3.5-.7 6.8-.3 9.5 1.4 2.7-1.7 6-2.1 9.5-1.4V16.2c-3.6-.7-6.9-.4-9.5 1.3Z"
        fill="white"
        fillOpacity="0.96"
      />
      <path d="M24 17.5v12.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-display text-h2 font-bold tracking-[-0.02em] text-fg", className)}>
      Konnekt
    </span>
  );
}
