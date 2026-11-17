import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, type = "text", ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        "h-11 w-full rounded-input border border-border bg-surface px-3.5 text-[0.9375rem] text-fg placeholder:text-fg-subtle transition-colors focus:border-accent disabled:cursor-not-allowed disabled:bg-surface-2",
        className,
      )}
      {...props}
    />
  );
});
