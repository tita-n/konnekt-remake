import { describe, expect, it } from "vitest";
import { sessionCookieOptions } from "@/lib/auth/cookie-options";

describe("session cookie flags", () => {
  it("is httpOnly, SameSite=Lax and Secure in production", () => {
    const options = sessionCookieOptions(3600, true);
    expect(options).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 3600,
    });
  });

  it("drops Secure only outside production", () => {
    expect(sessionCookieOptions(60, false)).toMatchObject({ httpOnly: true, secure: false, sameSite: "lax" });
  });
});
