export function sessionCookieOptions(maxAgeSeconds: number, production: boolean) {
  return {
    httpOnly: true,
    secure: production,
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}
