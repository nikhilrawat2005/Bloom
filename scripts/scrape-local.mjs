// Local-only scraper runner — no Vercel, no CRON_SECRET needed.
// Usage:
//   node scripts/scrape-local.mjs            -> full ingestion (scrape + AI + save to Firestore)
//   node scripts/scrape-local.mjs --preview  -> preview only (no DB write, just prints results)

const BASE = process.env.NEXT_API_URL || "http://localhost:3000";
const preview = process.argv.includes("--preview");
const source = process.argv.find((a) => a.startsWith("--source="))?.split("=")[1];

let url = `${BASE}/api/scrape`;
const params = new URLSearchParams();
if (preview) params.set("preview", "1");
if (source) params.set("source", source);
if ([...params].length) url += `?${params.toString()}`;

console.log(`[scrape-local] GET ${url}`);

try {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) {
    console.error(`[scrape-local] Failed (${res.status}):`, data);
    process.exit(1);
  }

  if (preview || source) {
    console.log(`\n=== Found ${data.count ?? data.opportunities?.length ?? 0} opportunities ===`);
    if (data.perSourceCounts) console.log("Per-source:", data.perSourceCounts);
    if (data.opportunities) {
      for (const o of data.opportunities.slice(0, 20)) {
        console.log(` - [${o.category}] ${o.title} | ${o.orgName || o.scraperName} | Apply: ${o.applyLink}`);
      }
    }
  } else {
    console.log("\n=== Ingestion summary ===");
    console.log(JSON.stringify(data.summary, null, 2));
  }
} catch (err) {
  console.error("[scrape-local] Error: Is Next.js running on", BASE, "?");
  console.error(err.message);
  console.log("\nHint: run  npm run dev   in one terminal, then  node scripts/scrape-local.mjs  in another.");
  process.exit(1);
}
