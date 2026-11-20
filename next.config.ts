import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  // The dev server serves uncompiled workers; production builds the worker.
  disable: process.env.NODE_ENV === "development",
  register: false,
  // Never cache HTML or RSC payloads on navigation; the user-specific feed is
  // kept in a per-account IndexedDB store and cleared on logout.
  cacheOnNavigation: false,
  reloadOnOnline: true,
  additionalPrecacheEntries: [{ url: "/offline", revision: null }],
});

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  devIndicators: false,
  outputFileTracingRoot: __dirname,
  poweredByHeader: false,
  experimental: {
    serverActions: {
      // ID card uploads are compressed client-side; this is a safety ceiling.
      bodySizeLimit: "8mb",
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
          },
        ],
      },
    ];
  },
};

export default withSerwist(nextConfig);
