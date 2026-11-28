import { cn } from "@/lib/utils";

/**
 * Button class recipes live outside the client component so server components
 * can use `buttonStyles` for links without importing client code.
 */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive" | "create";
export type ButtonSize = "sm" | "md" | "lg";

export const buttonBase =
  "relative inline-flex select-none items-center justify-center gap-2 font-semibold transition-[transform,background-color,border-color,color,box-shadow,filter] duration-150 ease-out disabled:pointer-events-none disabled:opacity-45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus active:scale-[0.98]";

export const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-fg hover:bg-accent-hover active:brightness-90",
  secondary: "border border-accent text-accent-ink bg-surface hover:bg-accent-soft",
  ghost: "bg-transparent text-fg hover:bg-surface-2",
  destructive: "bg-danger-btn text-danger-fg hover:brightness-95 active:brightness-90",
  // Skeuomorphic treatment reserved for the raised Create trigger.
  create: "bg-accent text-accent-fg shadow-create active:translate-y-[2px] active:shadow-none",
};

/**
 * 44px is the floor for every size, including `sm`: density in toolbars and admin
 * rows comes from padding and type scale, not from a shorter box. The CI audit
 * reports any interactive box under 44×44, so this is the whole app's fix rather
 * than per-page `min-h-11` patches.
 */
export const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-11 min-h-11 rounded-button px-3 text-small",
  md: "h-11 min-h-11 rounded-button px-4 text-[0.9375rem]",
  lg: "h-12 min-h-12 rounded-button px-5 text-[0.9375rem]",
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
