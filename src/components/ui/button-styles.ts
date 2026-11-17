import { cn } from "@/lib/utils";

/**
 * Button class recipes live outside the client component so server components
 * can use `buttonStyles` for links without importing client code.
 */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive" | "create";
export type ButtonSize = "sm" | "md" | "lg";

export const buttonBase =
  "relative inline-flex select-none items-center justify-center gap-2 font-semibold transition-[transform,background-color,border-color,color,box-shadow] duration-200 ease-spring disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus active:scale-[0.985]";

export const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-fg hover:brightness-[0.96]",
  secondary: "border border-border-strong bg-surface text-fg hover:bg-surface-2",
  ghost: "bg-transparent text-fg hover:bg-surface-2",
  destructive: "bg-danger text-danger-fg hover:brightness-[0.96]",
  // The only skeuomorphic treatment in the system: slightly raised, pressable.
  create: "bg-accent text-accent-fg shadow-[0_2px_0_0_var(--accent-shadow,_rgba(0,0,0,0.28))] active:translate-y-[2px] active:shadow-none",
};

export const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-9 rounded-button px-3 text-small",
  md: "h-11 rounded-button px-4 text-[0.9375rem]",
  lg: "h-12 rounded-button px-5 text-[0.9375rem]",
};

export interface ButtonStyleOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
}

export function buttonStyles({ variant = "primary", size = "md", fullWidth, className }: ButtonStyleOptions = {}) {
  return cn(buttonBase, buttonVariants[variant], buttonSizes[size], fullWidth && "w-full", className);
}
