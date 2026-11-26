import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function workflow(name: string): string {
  return readFileSync(path.join(process.cwd(), ".github/workflows", name), "utf8");
}

describe("staging-only workflows", () => {
  it("bootstrap refuses anything but staging and never deploys", () => {
    const source = workflow("staging-bootstrap.yml");
    expect(source).toContain("github.event.inputs.environment == 'staging'");
    expect(source).toContain("environment: staging");
    expect(source).toContain("Refuse anything except staging");
    expect(source).toContain("npm ci --include=dev");
    expect(source).not.toMatch(/--prod|vercel deploy|vercel build/);
  });

  it("scheduler and verification are bound to the staging environment", () => {
    for (const name of ["staging-announcements.yml", "staging-verify.yml"]) {
      const source = workflow(name);
      expect(source, name).toContain("environment: staging");
      expect(source, name).not.toMatch(/environment:\s*production|--prod/);
    }
    expect(workflow("staging-announcements.yml")).toContain('github.ref == \'refs/heads/main\'');
    expect(workflow("staging-verify.yml")).toContain("scripts/check-vercel-env.mjs --target=production");
  });
});
