#!/usr/bin/env node
// Rebuild a campaign's generated state (page cache, search snapshot,
// repository manifest) from canonical page source, via the running app.
//
// Usage:
//   node scripts/repair-campaign.mjs --campaign 4 --token crepo_xxx [--base http://127.0.0.1:3000] [--sync]
//
// --token   an API token minted from the dashboard (MCP access tokens)
// --sync    also flush unsynced local edits to Git before repairing

const args = process.argv.slice(2);
function flag(name, fallback = "") {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] || "" : fallback;
}

const campaign = flag("campaign");
const token = flag("token") || process.env.CAMPAIGNREPO_TOKEN || "";
const base = (flag("base", process.env.CAMPAIGNREPO_URL || "http://127.0.0.1:3000")).replace(/\/$/, "");
const doSync = args.includes("--sync");

if (!campaign || !token) {
  console.error("Usage: node scripts/repair-campaign.mjs --campaign <id> --token <api-token> [--base <url>] [--sync]");
  process.exit(2);
}

async function call(path, method = "POST") {
  const res = await fetch(`${base}${path}`, { method, headers: { Authorization: `Bearer ${token}` } });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

if (doSync) {
  const sync = await call(`/api/campaigns/${campaign}/sync`);
  if (sync.body.error) console.error(`Sync: FAILED — ${sync.body.error} (local edits kept)`);
  else console.log(`Sync: committed ${sync.body.committed ?? 0} page(s)${sync.body.conflicts?.length ? `, ${sync.body.conflicts.length} conflict(s) need resolution` : ""}`);
}

const { status, body } = await call(`/api/campaigns/${campaign}/repair`);
if (!body.steps) {
  console.error(`Repair failed to run (HTTP ${status}):`, body.error || body);
  process.exit(1);
}
for (const step of body.steps) {
  console.log(`${step.ok ? "OK " : "FAIL"} ${step.step}: ${step.detail}${step.error && !step.ok ? ` (${step.error})` : ""}`);
}
console.log(
  `Counts: ${body.counts.pageFiles} page files, ${body.counts.cacheRows} cache rows, ${body.counts.manifestPages} manifest pages, ${body.counts.searchDocs} search docs`
);
if (body.emptySourceSlugs?.length) console.log(`Empty source pages (reported, not filled): ${body.emptySourceSlugs.join(", ")}`);
process.exit(body.ok ? 0 : 1);
