import { cn } from "@/lib/utils";

/**
 * Skeuomorphic rubber-stamp badge (Spec Section 5B).
 * Rotated, double-bordered, uppercase with subtle ink grain texture — used ONLY
 * on verification result screens and the admin verification detail panel.
 */
export function RubberStamp({
  status,
  className,
}: {
  status: "APPROVED" | "PENDING" | "REJECTED";
  className?: string;
}) {
  const tone =
    status === "APPROVED"
      ? "border-success text-success bg-success-soft/50"
      : status === "REJECTED"
        ? "border-danger text-danger bg-danger-soft/50"
        : "border-warning text-warning bg-warning-soft/50";

  return (
    <div
      className={cn(
        "relative inline-flex -rotate-6 select-none items-center justify-center rounded-[10px] border-[2.5px] px-4 py-1.5 font-display text-h3 font-extrabold uppercase tracking-[0.16em] opacity-90",
        tone,
        className,
      )}
      role="status"
      aria-label={`Verification status: ${status.toLowerCase()}`}
    >
      <span className="pointer-events-none absolute inset-[3px] rounded-[6px] border border-current opacity-55" aria-hidden="true" />
      <span className="relative">{status}</span>
    </div>
  );
}
