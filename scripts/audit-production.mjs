import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const allowlist = JSON.parse(readFileSync("security/advisory-allowlist.json", "utf8")).advisories ?? [];
const today = new Date();
today.setUTCHours(0, 0, 0, 0);

function advisoryIds(name, vulnerabilities, seen = new Set()) {
  if (seen.has(name)) return [];
  seen.add(name);
  const ids = new Set();
  const item = vulnerabilities[name];
  for (const via of item?.via ?? []) {
    if (typeof via === "string") {
      for (const id of advisoryIds(via, vulnerabilities, seen)) ids.add(id);
      continue;
    }
    const match = via.url?.match(/GHSA-[a-z0-9-]+/i);
    if (match) ids.add(match[0]);
  }
  return [...ids];
}

let report;
try {
  const output = execFileSync("npm", ["audit", "--omit=dev", "--json"], { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
  report = JSON.parse(output);
} catch (error) {
  report = JSON.parse(error.stdout || "{}");
}

const counts = report.metadata?.vulnerabilities ?? {};
console.log(`Production advisories: ${JSON.stringify(counts)}`);

const expired = [];
const rejected = [];
for (const entry of allowlist) {
  if (!entry.id || !Array.isArray(entry.packages) || !entry.justification || !entry.expires) {
    rejected.push(`Malformed allowlist entry: ${JSON.stringify(entry)}`);
    continue;
  }
  const expiry = new Date(`${entry.expires}T23:59:59Z`);
  const days = (expiry.getTime() - today.getTime()) / 86_400_000;
  if (Number.isNaN(expiry.getTime()) || days < 0) expired.push(`${entry.id} expired on ${entry.expires}`);
  if (days > 60) rejected.push(`${entry.id} expiry ${entry.expires} exceeds 60 days`);
}

const vulnerabilities = report.vulnerabilities ?? {};
for (const [name, item] of Object.entries(vulnerabilities)) {
  if (item.severity !== "high" && item.severity !== "critical") continue;
  const ids = advisoryIds(name, vulnerabilities);
  const accepted = ids.length > 0 && ids.every((id) =>
    allowlist.some((entry) => entry.id === id && entry.packages.includes(name)),
  );
  if (accepted) {
    console.log(`ALLOWED ${item.severity} ${name}: ${ids.join(", ")}`);
    continue;
  }
  rejected.push(`${item.severity.toUpperCase()} ${name} is not safely fixed or allowlisted${ids.length ? ` (${ids.join(", ")})` : ""}`);
}

if (expired.length) {
  console.error("Expired advisory allowlist entries:");
  for (const item of expired) console.error(`  ${item}`);
}
if (rejected.length) {
  console.error("Production advisory gate failed:");
  for (const item of rejected) console.error(`  ${item}`);
}
if (expired.length || rejected.length) process.exit(1);

console.log("Production advisory gate passed.");
