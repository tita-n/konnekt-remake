import { cn } from "@/lib/utils";

/**
 * Konnekt mark: two arcs joining around a node — connection between people,
 * not a generic chat bubble. Renders in currentColor so it works on accent
 * surfaces and in both themes.
 */
export function LogoMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={cn("size-10", className)}
      fill="none"
    >
      <rect width="48" height="48" rx="14" fill="currentColor" />
      <path
        d="M15 34V16.5M15 25.5l10.5-9M15 25.5L26 34"
        stroke="white"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="33.5" cy="17" r="4.25" stroke="white" strokeWidth="3.4" />
      <circle cx="33.5" cy="34" r="3" fill="white" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-display text-h2 font-extrabold tracking-[-0.03em]", className)}>
      konnekt<span className="text-accent">.</span>
    </span>
  );
}
