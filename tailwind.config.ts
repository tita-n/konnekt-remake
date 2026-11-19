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
          fg: "var(--accent-fg)",
          soft: "var(--accent-soft)",
          "soft-fg": "var(--accent-soft-fg)",
        },
        danger: "var(--danger)",
        "danger-fg": "var(--danger-fg)",
        "danger-soft": "var(--danger-soft)",
        success: "var(--success)",
        "success-soft": "var(--success-soft)",
        warning: "var(--warning)",
        "warning-soft": "var(--warning-soft)",
        highlight: "var(--highlight)",
        "highlight-soft": "var(--highlight-soft)",
        focus: "var(--focus)",
      },
      borderRadius: {
        button: "12px",
        card: "16px",
        sheet: "24px",
        input: "12px",
        chip: "999px",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        display: ["var(--font-jakarta)", "var(--font-inter)", "system-ui", "sans-serif"],
      },
      fontSize: {
        display: ["2rem", { lineHeight: "1.1", letterSpacing: "-0.03em", fontWeight: "700" }],
        h1: ["1.375rem", { lineHeight: "1.25", letterSpacing: "-0.02em", fontWeight: "700" }],
        h2: ["1.125rem", { lineHeight: "1.3", letterSpacing: "-0.012em", fontWeight: "700" }],
        h3: ["1rem", { lineHeight: "1.4", letterSpacing: "-0.005em", fontWeight: "600" }],
        body: ["1rem", { lineHeight: "1.5" }],
        small: ["0.875rem", { lineHeight: "1.45" }],
        tiny: ["0.75rem", { lineHeight: "1.35" }],
      },
      boxShadow: {
        raised: "0 1px 0 0 rgba(255,255,255,0.18) inset, 0 2px 0 0 rgba(0,0,0,0.18)",
        pressed: "0 1px 0 0 rgba(255,255,255,0.10) inset, 0 1px 2px 0 rgba(0,0,0,0.16)",
        card: "none",
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
        shimmer: { from: { backgroundPosition: "200% 0" }, to: { backgroundPosition: "-200% 0" } },
        "fade-up": { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "translateY(0)" } },
      },
      animation: {
        "sheet-in": "sheet-in 280ms cubic-bezier(0.2,0.9,0.2,1.15)",
        "fade-in": "fade-in 180ms ease-out",
        "toast-in": "toast-in 220ms cubic-bezier(0.2,0.9,0.2,1.15)",
        "pop-in": "pop-in 160ms ease-out",
        shimmer: "shimmer 1.6s linear infinite",
        "fade-up": "fade-up 240ms cubic-bezier(0.2,0.8,0.2,1)",
      },
      maxWidth: { content: "72rem", prose: "42rem" },
    },
  },
  plugins: [],
};

export default config;
