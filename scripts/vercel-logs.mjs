/**
 * Print a bounded, redacted slice of a staging deployment's Vercel logs.
 * Used only after a smoke failure. Never prints environment values.
 */
const idOrUrl = process.argv[2];
if (!idOrUrl) {
  console.error("Usage: node scripts/vercel-logs.mjs <deployment-id-or-url>");
  process.exit(1);
}
const token = process.env.VERCEL_TOKEN;
const teamId = process.env.VERCEL_ORG_ID;
if (!token) {
  console.error("VERCEL_TOKEN is not available.");
  process.exit(1);
}
const auth = { Authorization: `Bearer ${token}` };
const team = teamId ? `teamId=${encodeURIComponent(teamId)}` : "";

function redact(text) {
  return String(text)
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "[redacted database url]")
    .replace(/re_[A-Za-z0-9_-]{8,}/g, "[redacted key]")
    .replace(/https:\/\/res\.cloudinary\.com\/\S+/g, "[redacted storage url]")
    .replace(/https:\/\/api\.cloudinary\.com\/\S+/g, "[redacted storage url]")
    .replace(/token=[A-Za-z0-9._~-]+/g, "token=[redacted]")
    .slice(0, 900);
}

const deploymentResponse = await fetch(
  `https://api.vercel.com/v13/deployments/${encodeURIComponent(idOrUrl)}${team ? `?${team}` : ""}`,
  { headers: auth },
);
const deployment = await deploymentResponse.json().catch(() => ({}));
if (!deploymentResponse.ok || !deployment?.id) {
  console.error(`Could not resolve the deployment (HTTP ${deploymentResponse.status}).`);
  process.exit(0);
}
const eventsResponse = await fetch(
  `https://api.vercel.com/v3/deployments/${deployment.id}/events?limit=100&direction=backward${team ? `&${team}` : ""}`,
  { headers: auth },
);
const events = await eventsResponse.json().catch(() => []);
if (!eventsResponse.ok) {
  console.error(`Could not read deployment events (HTTP ${eventsResponse.status}).`);
  process.exit(0);
}
const rows = (Array.isArray(events) ? events : [])
  .map((event) => ({ type: event?.type ?? "", text: redact(event?.text ?? event?.payload?.text ?? "") }))
  .filter((event) => /error|exception|failed|prisma|p\/\[id\]|route/i.test(event.text))
  .slice(-40);
if (rows.length === 0) {
  console.log("No matching runtime log lines were returned.");
} else {
  for (const row of rows) console.log(`${row.type}: ${row.text}`);
}
