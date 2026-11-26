import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(path.join(process.cwd(), ".github/workflows/deploy.yml"), "utf8");

describe("staging deploy workflow", () => {
  it("installs dev dependencies even though validation runs in production mode", () => {
    expect(workflow).not.toMatch(/^\s{4}env:\n(?:\s{6}.*\n)*\s{6}NODE_ENV:\s*production/m);
    const installs = workflow.match(/npm ci[^\n]*/g) ?? [];
    expect(installs.length).toBeGreaterThan(0);
    expect(installs.every((line) => line.includes("--include=dev"))).toBe(true);
  });

  it("deploys the staging project's Production environment, never Preview", () => {
    expect(workflow).toContain("vercel deploy --prod");
    expect(workflow).not.toContain("--environment=preview");
    expect(workflow).not.toContain("options: [staging, production]");
  });

  it("builds remotely so sensitive Vercel variables are not pulled to a runner", () => {
    expect(workflow).not.toMatch(/npx vercel pull/);
    expect(workflow).not.toMatch(/npx vercel build/);
    expect(workflow).not.toContain("--prebuilt");
    expect(workflow).toContain("vercel deploy --prod --yes");
  });

  it("checks Vercel variable names without decrypting values", () => {
    expect(workflow).toContain("scripts/check-vercel-env.mjs --target=production");
    const checker = readFileSync(path.join(process.cwd(), "scripts/check-vercel-env.mjs"), "utf8");
    expect(checker).toContain('decrypt: "false"');
    expect(checker).not.toMatch(/console\.(log|error)\([^)]*(token|value)/i);
  });
});
