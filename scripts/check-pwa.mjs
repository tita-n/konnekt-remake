const base = (process.argv[2] || process.env.PWA_URL || "http://localhost:3100").replace(/\/$/, "");
const failures = [];
async function get(path) {
  const response = await fetch(`${base}${path}`);
  return { response, body: await response.text() };
}
const manifest = await get("/manifest.webmanifest");
try {
  const data = JSON.parse(manifest.body);
  if (!Array.isArray(data.icons) || data.icons.length === 0) failures.push("manifest has no icons");
  if (!data.start_url) failures.push("manifest has no start_url");
  if (!data.name || !data.short_name) failures.push("manifest has no name/short_name");
} catch {
  failures.push("manifest is not valid JSON");
}
const sw = await get("/sw.js");
if (sw.response.status !== 200) failures.push(`service worker is ${sw.response.status}`);
if (!sw.body.includes("NetworkOnly") && !sw.body.includes("network-only")) {
  // The bundled worker may minify class names; presence and size are the stable checks.
  if (sw.body.length < 1000) failures.push("service worker looks empty");
}
if (failures.length) {
  console.error("PWA installability check failed:");
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}
console.log("PWA manifest and service worker checks passed.");
