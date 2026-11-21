import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const KEY_ROUTES = ["/", "/pulse", "/p/[id]", "/signup/[slug]", "/compose", "/admin/verification"];
const update = process.argv.includes("--update");

function parseSize(value, unit) {
  return unit === "B" ? Number(value) / 1024 : Number(value);
}

function parseBuild(output) {
  const routes = {};
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^\s*[├└┌│]?\s*[○ƒλ●]\s+(\S+)\s+(?:[\d.]+\s*(?:kB|B)\s+)?([\d.]+)\s*(kB|B)\s*$/);
    if (!match) continue;
    routes[match[1]] = Number(parseSize(match[2], match[3]).toFixed(1));
  }
  const shared = output.match(/\+\s+First Load JS shared by all\s+([\d.]+)\s*kB/);
  const middleware = output.match(/[ƒλ]\s+Middleware\s+([\d.]+)\s*kB/);
  if (!shared || !middleware) {
    throw new Error("Could not find shared JS or middleware size in the Next build output.");
  }
  return {
    sharedJsKb: Number(shared[1]),
    middlewareKb: Number(middleware[1]),
    routes,
  };
}

const result = spawnSync("npm", ["run", "build"], { encoding: "utf8", maxBuffer: 50 * 1024 * 1024 });
const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
process.stdout.write(output);
if (result.status !== 0) process.exit(result.status ?? 1);

const current = parseBuild(output);
const missing = KEY_ROUTES.filter((route) => current.routes[route] === undefined);
if (missing.length) {
  console.error(`Budget parser did not find key routes: ${missing.join(", ")}`);
  process.exit(1);
}

mkdirSync("perf", { recursive: true });
writeFileSync("perf/current.json", `${JSON.stringify(current, null, 2)}\n`);

if (update) {
  const prior = JSON.parse(readFileSync("perf/baseline.json", "utf8"));
  writeFileSync(
    "perf/baseline.json",
    `${JSON.stringify({ ...prior, capturedAt: new Date().toISOString().slice(0, 10), build: current }, null, 2)}\n`,
  );
  console.log(`Updated perf/baseline.json from this build.`);
  process.exit(0);
}

const baseline = JSON.parse(readFileSync("perf/baseline.json", "utf8")).build;
const tolerance = 0.1;
const failures = [];
for (const route of KEY_ROUTES) {
  const allowed = baseline.routes[route] * (1 + tolerance);
  if (current.routes[route] > allowed) {
    failures.push(`/${route === "/" ? "" : route.slice(1)} ${current.routes[route]} kB exceeds ${allowed.toFixed(1)} kB (baseline ${baseline.routes[route]} kB +10%)`);
  }
}
for (const [label, before, now] of [
  ["shared JS", baseline.sharedJsKb, current.sharedJsKb],
  ["middleware", baseline.middlewareKb, current.middlewareKb],
]) {
  if (now > before * (1 + tolerance)) failures.push(`${label} ${now} kB exceeds ${before} kB +10%`);
}
if (failures.length) {
  console.error("Performance budget failed:");
  for (const failure of failures) console.error(`  ${failure}`);
  console.error("If the growth is intentional, update perf/baseline.json in this PR and explain why.");
  process.exit(1);
}
console.log("Performance budget passed (key routes, shared JS and middleware within +10% of perf/baseline.json).");
