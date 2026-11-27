import { describe, expect, it } from "vitest";
import { hostOf, nearestRank, regionSegment } from "@/lib/perf/region";
import { GET } from "@/app/api/diagnostics/region/route";

describe("region diagnostics", () => {
  it("reports a region segment and never the hostname", () => {
    expect(regionSegment("ep-cool-name-pooler.us-east-2.aws.neon.tech")).toBe("us-east-2");
    expect(regionSegment("eu-west-1.aws.neon.tech")).toBe("eu-west-1");
    expect(regionSegment("konnekt-remake.vercel.app")).toBeNull();
    expect(hostOf("https://secret-host.example.test/path")).toBe("secret-host.example.test");
    expect(hostOf("not a url")).toBeNull();
  });

  it("computes a nearest-rank percentile", () => {
    expect(nearestRank([5, 1, 3, 2, 4], 50)).toBe(3);
    expect(nearestRank([], 50)).toBe(0);
  });

  it("is indistinguishable from a missing route without the secret", async () => {
    const response = await GET(
      new Request("https://konnekt.test/api/diagnostics/region", {
        headers: { "x-perf-trace": "wrong" },
      }),
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not found" });
  });
});
