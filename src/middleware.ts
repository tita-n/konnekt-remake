import { NextResponse, type NextRequest } from "next/server";

/**
 * Strict CSP with a per-request nonce. Next injects the nonce into its own
 * bootstrap scripts when it sees the CSP header. Styles use inline allowances
 * for React style attributes; there are no inline event handlers anywhere.
 */
function buildCsp(nonce: string, isDev: boolean): string {
  const turnstile = "https://challenges.cloudflare.com";
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${turnstile}${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://res.cloudinary.com",
    "font-src 'self' data:",
    `connect-src 'self' ${turnstile} https://api.cloudinary.com${isDev ? " ws: wss:" : ""}`,
    `frame-src ${turnstile}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ];
  if (isDev) directives.pop();
  return directives.join("; ");
}

export function middleware(request: NextRequest) {
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const isDev = process.env.NODE_ENV !== "production";

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", buildCsp(nonce, isDev));

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", buildCsp(nonce, isDev));
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(self), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  );
  if (!isDev) {
    response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
    response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  }
  return response;
}

export const config = {
  matcher: [
    // Everything except static assets and the service worker bundles.
    "/((?!_next/static|_next/image|favicon.ico|icons/|sw.js|swe-worker|manifest.webmanifest|offline).*)",
  ],
};
