import { describe, expect, it } from "vitest";
import { assertSafeE2EDatabase } from "../../scripts/e2e-guard";

const DEV = "postgresql://postgres@127.0.0.1:55432/konnekt_dev";

describe("dedicated e2e database guard", () => {
  it("accepts a distinct local e2e database", () => {
    const url = "postgresql://postgres@127.0.0.1:55433/konnekt_e2e";
    expect(assertSafeE2EDatabase({ e2eUrl: url, devUrl: DEV })).toBe(url);
    expect(
      assertSafeE2EDatabase({ e2eUrl: "postgresql://postgres@127.0.0.1:55433/konnekt_test", devUrl: DEV }),
    ).toContain("konnekt_test");
  });

  it("refuses a missing URL, the dev database, or an unsafe database name", () => {
    expect(() => assertSafeE2EDatabase({ e2eUrl: undefined, devUrl: DEV })).toThrow(/E2E_DATABASE_URL is required/);
    expect(() =>
      assertSafeE2EDatabase({ e2eUrl: DEV, devUrl: DEV }),
    ).toThrow(/must be a different database/);
    expect(() =>
      assertSafeE2EDatabase({ e2eUrl: "postgresql://postgres@127.0.0.1:55433/nova", devUrl: DEV }),
    ).toThrow(/must end in _e2e or _test/);
  });

  it("refuses production-looking hosts and remote databases without an explicit opt-in", () => {
    expect(() =>
      assertSafeE2EDatabase({ e2eUrl: "postgresql://u:p@prod-db.example/konnekt_e2e", devUrl: DEV }),
    ).toThrow(/production database/);
    expect(() =>
      assertSafeE2EDatabase({ e2eUrl: "postgresql://u:p@ep-cool.neon.tech/konnekt_e2e", devUrl: DEV }),
    ).toThrow(/E2E_ALLOW_REMOTE/);
    expect(() =>
      assertSafeE2EDatabase({
        e2eUrl: "postgresql://u:p@ep-cool.neon.tech/konnekt_e2e",
        devUrl: DEV,
        allowRemote: true,
      }),
    ).not.toThrow();
  });
});
