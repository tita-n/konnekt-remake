import { spawn } from "node:child_process";
import path from "node:path";
import { guardFromEnvironment } from "./e2e-guard";

/**
 * Playwright's web server. The only database URL this process (and every Next
 * worker it starts) receives is the guarded E2E_DATABASE_URL.
 */
const e2eUrl = guardFromEnvironment();
const port = process.env.E2E_PORT ?? "3101";
const nextBin = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");

const child = spawn(process.execPath, [nextBin, "dev", "-p", port], {
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: "development",
    E2E: "1",
    // Next dev restarts itself at 80% of the V8 heap limit. The full suite is
    // long enough to cross the default limit, so give the test server headroom
    // and keep one process for deterministic navigation timing.
    NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --max-old-space-size=6144`.trim(),
    DATABASE_URL: e2eUrl,
    // Keep scripts that inspect the dedicated DB explicit, never the demo URL.
    DEV_DATABASE_URL: process.env.DEV_DATABASE_URL,
  },
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => child.kill(signal));
}
child.on("exit", (code) => process.exit(code ?? 1));
