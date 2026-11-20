import type { Config } from "tailwindcss";

/**
 * All colours resolve to CSS variables defined in src/styles/tokens.css, so
 * light/dark and per-university accents switch without rebuilding classes.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        "surface-3": "var(--surface-3)",
        fg: "var(--fg)",
        "fg-muted": "var(--fg-muted)",
        "fg-subtle": "var(--fg-subtle)",
        border: "var(--border)",
        "border-strong": "var(--border-strong)",
        accent: {
          DEFAULT: "var(--accent)",
          hover: "var(--accent-hover)",
          ink: "var(--accent-ink)",
          fg: "var(--accent-fg)",
          soft: "var(--accent-soft)",
          "soft-fg": "var(--accent-soft-fg)",
        },
        verified: "var(--verified)",
        danger: "var(--danger)",
        "danger-btn": "var(--danger-btn)",
        "danger-fg": "var(--danger-fg)",
        "danger-soft": "var(--danger-soft)",
        success: "var(--success)",
        "success-solid": "var(--success-solid)",
        "success-fg": "var(--success-fg)",
        "success-soft": "var(--success-soft)",
        warning: "var(--warning)",
        "warning-soft": "var(--warning-soft)",
        highlight: "var(--highlight)",
        "highlight-fg": "var(--highlight-fg)",
        "highlight-soft": "var(--highlight-soft)",
        focus: "var(--focus)",
      },
      borderRadius: {
        button: "12px",
        card: "16px",
        dialog: "20px",
        sheet: "24px",
        input: "12px",
        chip: "999px",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        display: ["var(--font-jakarta)", "var(--font-inter)", "system-ui", "sans-serif"],
      },
      fontSize: {
        display: ["1.75rem", { lineHeight: "1.2", letterSpacing: "-0.02em", fontWeight: "700" }],
        h1: ["1.375rem", { lineHeight: "1.27", letterSpacing: "-0.015em", fontWeight: "700" }],
        h2: ["1.125rem", { lineHeight: "1.33", letterSpacing: "-0.01em", fontWeight: "600" }],
        h3: ["1rem", { lineHeight: "1.375", letterSpacing: "-0.005em", fontWeight: "600" }],
        body: ["1rem", { lineHeight: "1.5" }],
        small: ["0.875rem", { lineHeight: "1.43" }],
        tiny: ["0.75rem", { lineHeight: "1.33" }],
      },
      boxShadow: {
        raised: "0 1px 0 0 rgba(255,255,255,0.18) inset, 0 2px 0 0 rgba(0,0,0,0.18)",
        pressed: "0 1px 0 0 rgba(255,255,255,0.10) inset, 0 1px 2px 0 rgba(0,0,0,0.16)",
        card: "none",
        pill: "var(--shadow-pill)",
        create: "var(--shadow-create)",
        modal: "var(--shadow-modal)",
        floating: "0 24px 64px -20px rgba(18,20,26,0.28)",
      },
      transitionTimingFunction: {
        spring: "cubic-bezier(0.2, 0.9, 0.2, 1.15)",
        out: "cubic-bezier(0.2, 0.8, 0.2, 1)",
      },
      keyframes: {
        "sheet-in": { from: { transform: "translateY(100%)" }, to: { transform: "translateY(0)" } },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "toast-in": {
          from: { opacity: "0", transform: "translateY(8px) scale(0.98)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "pop-in": {
          from: { opacity: "0", transform: "scale(0.96)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "heart-pop": {
          "0%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.2)" },
          "100%": { transform: "scale(1)" },
        },
        "pill-in": {
          from: { opacity: "0", transform: "translateY(-8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: { from: { backgroundPosition: "200% 0" }, to: { backgroundPosition: "-200% 0" } },
        "fade-up": { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "translateY(0)" } },
      },
      animation: {
        "sheet-in": "sheet-in 220ms cubic-bezier(0.22,1,0.36,1)",
        "fade-in": "fade-in 180ms ease-out",
        "toast-in": "toast-in 200ms ease-out",
        "pop-in": "pop-in 160ms ease-out",
        "heart-pop": "heart-pop 220ms cubic-bezier(0.2,0.9,0.2,1.15)",
        "pill-in": "pill-in 200ms ease-out",
        shimmer: "shimmer 1.4s linear infinite",
        "fade-up": "fade-up 200ms cubic-bezier(0.2,0.8,0.2,1)",
      },
      maxWidth: { content: "72rem", prose: "42rem", feed: "40rem" },
    },
  },
  plugins: [],
};

export default config;
