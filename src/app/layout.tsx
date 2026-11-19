import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { AppearanceProvider } from "@/components/providers/appearance-provider";
import { ToastProvider } from "@/components/providers/toast-provider";
import { OfflineBanner, PwaProvider } from "@/components/pwa/pwa-provider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  fallback: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
  adjustFontFallback: true,
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
  weight: ["600", "700", "800"],
  fallback: ["system-ui", "-apple-system", "Segoe UI", "sans-serif"],
  adjustFontFallback: true,
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: {
    default: "Konnekt — Your university, socially connected.",
    template: "%s · Konnekt",
  },
  description:
    "Konnekt is the verified-students-only social network for Nigerian universities. Join your campus space, meet your department and stay connected.",
  applicationName: "Konnekt",
  manifest: "/manifest.webmanifest",
  formatDetection: { telephone: false, address: false, email: false },
  openGraph: {
    type: "website",
    siteName: "Konnekt",
    title: "Konnekt — Your university, socially connected.",
    description: "Verified students, one campus at a time.",
  },
  twitter: { card: "summary_large_image" },
  appleWebApp: {
    capable: true,
    title: "Konnekt",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0f0d" },
  ],
  colorScheme: "light dark",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Reading the CSP nonce makes rendering request-bound, which is required for
  // nonce-based strict CSP. Static HTML would embed a stale nonce.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="en-NG" className={`${inter.variable} ${jakarta.variable}`} suppressHydrationWarning>
      <head>
        {/* Must run before first paint to avoid a light/dark flash; it is a
            cached 400-byte static file, not an inline script. */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="/theme-init.js" nonce={nonce} suppressHydrationWarning />
      </head>
      <body>
        <AppearanceProvider>
          <ToastProvider>
            <PwaProvider />
            <a href="#main" className="skip-link">
              Skip to content
            </a>
            <OfflineBanner />
            {children}
          </ToastProvider>
        </AppearanceProvider>
      </body>
    </html>
  );
}
