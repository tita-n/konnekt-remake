import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
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

  it("runs the bootstrap CLI and refuses a non-staging invocation before touching services", () => {
    const env: NodeJS.ProcessEnv = { ...process.env };
    delete env.DEPLOY_ENVIRONMENT;
    const result = spawnSync(process.execPath, ["--import", "tsx", "scripts/staging-bootstrap.ts"], {
      cwd: process.cwd(),
      env,
      encoding: "utf8",
      timeout: 20_000,
    });
    expect(result.status).not.toBe(0);
    expect(`${result.stdout ?? ""}${result.stderr ?? ""}`).toContain("DEPLOY_ENVIRONMENT");
  });

  it("fails the deploy when runtime and migration databases disagree", () => {
    expect(workflow("deploy.yml")).toContain("scripts/check-staging-db.mjs");
  });

  it("smokes the public staging domain instead of a protected deployment URL", () => {
    const deploy = workflow("deploy.yml");
    expect(deploy).toContain("SMOKE_BASE_URL: ${{ secrets.APP_URL }}");
    expect(deploy).not.toContain("SMOKE_BASE_URL: ${{ needs.deploy.outputs.url }}");
  });

  it("pins browser jobs to the Playwright-supported Ubuntu release", () => {
    expect(workflow("deploy.yml")).toContain("runs-on: ubuntu-24.04");
    expect(workflow("staging-verify.yml").match(/runs-on: ubuntu-24\.04/g)?.length).toBe(3);
  });
});
