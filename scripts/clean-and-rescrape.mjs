// scripts/clean-and-rescrape.mjs
// ────────────────────────────────────────────────────────────────────────────
// Cleans ALL scraped data from Firestore (org_opportunities + summary_cache),
// resets the 3-day scrape guard, triggers a fresh force-rescrape via the
// running Next.js dev server, then bulk-approves every automated opportunity
// and enforces the 20-per-category cap.
//
// Final result: exactly ≤20 approved opportunities per section in Explore.
//
// USAGE:
//   1. Make sure `npm run dev` is running in another terminal.
//   2. node scripts/clean-and-rescrape.mjs
//
// OPTIONS:
//   --clean-only     Delete Firestore data & reset guard, but don't rescrape.
//   --rescrape-only  Skip cleaning, just force a rescrape + approve + cap.
//   --approve-only   Skip clean & rescrape, just bulk-approve + enforce cap.
//   --dry-run        Show what would happen without writing anything.
//
// REQUIRES: scripts/serviceAccountKey.json (Firebase Admin service account)
// ────────────────────────────────────────────────────────────────────────────

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const CLEAN_ONLY    = process.argv.includes("--clean-only");
const RESCRAPE_ONLY = process.argv.includes("--rescrape-only");
const APPROVE_ONLY  = process.argv.includes("--approve-only");
const DRY_RUN       = process.argv.includes("--dry-run");
const BASE          = process.env.NEXT_API_URL || "http://localhost:3000";

// ── Firebase Admin Init ──────────────────────────────────────────────────────
let db;
try {
  const serviceAccount = JSON.parse(
    readFileSync(join(__dirname, "serviceAccountKey.json"), "utf-8")
  );
  initializeApp({ credential: cert(serviceAccount) });
  db = getFirestore();
  console.log("✅ Firebase Admin connected.");
} catch (err) {
  console.error("❌ Could not load serviceAccountKey.json:", err.message);
  console.log("   → Download it from Firebase Console > Project Settings > Service Accounts");
  process.exit(1);
}

// ── Step 1: Clean org_opportunities ─────────────────────────────────────────
async function cleanOpportunities() {
  console.log("\n🧹 Step 1 — Fetching all documents from 'org_opportunities'...");
  const snap = await db.collection("org_opportunities").get();

  if (snap.empty) {
    console.log("   ⚪ Collection is already empty — nothing to delete.");
    return 0;
  }

  console.log(`   Found ${snap.size} documents.`);

  if (DRY_RUN) {
    console.log("   [DRY RUN] Would delete all documents. Skipping.");
    return snap.size;
  }

  const CHUNK = 250;
  const docs = snap.docs;
  let deleted = 0;
  for (let i = 0; i < docs.length; i += CHUNK) {
    const batch = db.batch();
    const chunk = docs.slice(i, i + CHUNK);
    for (const doc of chunk) batch.delete(doc.ref);
    await batch.commit();
    deleted += chunk.length;
    console.log(`   🗑  Deleted ${deleted}/${snap.size}...`);
  }

  console.log(`   ✅ Deleted ${deleted} opportunities from Firestore.`);
  return deleted;
}

// ── Step 2: Clean summary_cache ───────────────────────────────────────────────
async function cleanSummaryCache() {
  console.log("\n🧹 Step 2 — Fetching all documents from 'summary_cache'...");
  const snap = await db.collection("summary_cache").get();

  if (snap.empty) {
    console.log("   ⚪ summary_cache is already empty.");
    return 0;
  }

  console.log(`   Found ${snap.size} cached summaries.`);

  if (DRY_RUN) {
    console.log("   [DRY RUN] Would delete all summaries. Skipping.");
    return snap.size;
  }

  const CHUNK = 250;
  const docs = snap.docs;
  let deleted = 0;
  for (let i = 0; i < docs.length; i += CHUNK) {
    const batch = db.batch();
    const chunk = docs.slice(i, i + CHUNK);
    for (const doc of chunk) batch.delete(doc.ref);
    await batch.commit();
    deleted += chunk.length;
  }

  console.log(`   ✅ Deleted ${deleted} cached summaries.`);
  return deleted;
}

// ── Step 3: Reset the 3-day scrape guard ────────────────────────────────────
async function resetScrapeGuard() {
  console.log("\n🔄 Step 3 — Resetting scrape state guard (nexora_meta/scrape_state)...");

  if (DRY_RUN) {
    console.log("   [DRY RUN] Would reset lastScrapedAt. Skipping.");
    return;
  }

  await db.collection("nexora_meta").doc("scrape_state").set(
    { lastScrapedAt: null, updatedAt: new Date().toISOString(), resetBy: "clean-and-rescrape.mjs" },
    { merge: true }
  );

  console.log("   ✅ Scrape guard reset. Next scrape will run unconditionally.");
}

// ── Step 4: Trigger force rescrape via Next.js API ──────────────────────────
async function triggerForceRescrape() {
  console.log(`\n🚀 Step 4 — Triggering force rescrape at ${BASE}/api/scrape?force=1 ...`);
  console.log("   This may take 1-3 minutes (scrapes all sources, syncs to Firestore).");

  const url = `${BASE}/api/scrape?force=1`;
  const CRON_SECRET = process.env.CRON_SECRET || "nexora-cron-secret-2025-cipher";
  const headers = { "Authorization": `Bearer ${CRON_SECRET}` };
  console.log("   Auth: Using CRON_SECRET.");

  let res, data;
  try {
    res = await fetch(url, { headers });
    data = await res.json();
  } catch (err) {
    console.error("\n❌ Could not reach Next.js server:", err.message);
    console.log("   → Make sure `npm run dev` is running, then re-run this script.\n");
    process.exit(1);
  }

  if (!res.ok) {
    console.error(`\n❌ Scrape API returned ${res.status}:`, JSON.stringify(data, null, 2));
    process.exit(1);
  }

  console.log("\n✅ Rescrape complete!");
  console.log(`   Scraped total:     ${data.scrapedCount ?? "?"}`);
  console.log(`   Live in Firestore: ${data.count ?? "?"} (approved only — bulk-approve runs next)`);

  if (data.perSourceCounts) {
    console.log("\n   🔍 Per-source scrape counts:");
    for (const [src, count] of Object.entries(data.perSourceCounts)) {
      const icon = count > 0 ? "✅" : "⚠️ ";
      console.log(`      ${icon} ${src.padEnd(32)} : ${count}`);
    }
  }
  if (data.errors?.length) {
    console.log("\n   ⚠️  Scrape source warnings:");
    for (const e of data.errors) console.log(`      - ${e}`);
  }
  if (data.syncResult) {
    const s = data.syncResult;
    console.log(`\n   Sync: newOrUpdated=${s.newOrUpdated} skippedExpired=${s.skippedExpired} prunedExpired=${s.prunedExpired}`);
    if (s.errors?.length) {
      console.log("   ❌ Sync errors (these cause data not to be written!):");
      for (const e of s.errors) console.log(`      - ${e}`);
    }
  }
  if (data.nextScrapeAt) {
    console.log(`\n   Next auto-scrape after: ${data.nextScrapeAt}`);
  }
}

// ── Step 5: Bulk-approve all pending automated opportunities ─────────────────
// The scrape route sets most scrapers to autoApprove:false (pending status).
// This step directly updates their status to "approved" so they show in Explore.
// Seeds (postedByUid="seed-admin") are skipped — they're pre-approved already.
async function bulkApproveAutomated() {
  console.log("\n✅ Step 5 — Bulk-approving all pending automated opportunities...");

  const snap = await db
    .collection("org_opportunities")
    .where("status", "==", "pending")
    .where("source", "==", "automated")
    .get();

  if (snap.empty) {
    console.log("   ⚪ No pending automated opportunities found (they may already be approved or the scrape failed).");
    // Fallback: check total count
    const allSnap = await db.collection("org_opportunities").get();
    console.log(`   ℹ️  Total docs in org_opportunities: ${allSnap.size}`);
    return 0;
  }

  console.log(`   Found ${snap.size} pending automated opportunities to approve.`);

  if (DRY_RUN) {
    console.log("   [DRY RUN] Would approve all. Skipping.");
    return snap.size;
  }

  const CHUNK = 250;
  const docs = snap.docs;
  let approved = 0;
  for (let i = 0; i < docs.length; i += CHUNK) {
    const chunk = docs.slice(i, i + CHUNK);
    const batch = db.batch();
    for (const d of chunk) {
      batch.update(d.ref, {
        status: "approved",
        bulkApprovedAt: new Date().toISOString(),
        bulkApprovedBy: "clean-and-rescrape.mjs",
      });
    }
    await batch.commit();
    approved += chunk.length;
    console.log(`   ✅ Approved ${approved}/${snap.size}...`);
  }

  console.log(`   ✅ Bulk-approved ${approved} opportunities — now live on Explore.`);
  return approved;
}

// ── Step 6: Enforce 20-per-category cap ─────────────────────────────────────
// Trim each category to the 20 items with the nearest deadline.
function parseDeadlineTs(deadline) {
  if (!deadline || typeof deadline !== "string") return Infinity;
  const lower = deadline.toLowerCase().trim();
  if (lower.includes("rolling") || lower.includes("ongoing") || lower.includes("tbd") ||
      lower.includes("check") || lower.includes("always open")) return Infinity;

  // ISO / year-first
  const iso = deadline.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (iso) {
    const d = new Date(+iso[1], +iso[2] - 1, +iso[3], 23, 59, 59, 999);
    if (!isNaN(d.getTime())) return d.getTime();
  }
  // Day-first
  const dmy = deadline.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\b/);
  if (dmy) {
    const d = new Date(+dmy[3], +dmy[2] - 1, +dmy[1], 23, 59, 59, 999);
    if (!isNaN(d.getTime())) return d.getTime();
  }
  const parsed = new Date(deadline);
  return isNaN(parsed.getTime()) ? Infinity : parsed.getTime();
}

async function enforceCapOf20() {
  const MAX_PER_CAT = 20;
  console.log(`\n📊 Step 6 — Enforcing ${MAX_PER_CAT}-per-category cap on approved opportunities...`);

  const snap = await db
    .collection("org_opportunities")
    .where("status", "==", "approved")
    .get();

  console.log(`   Total approved docs: ${snap.size}`);

  // Group by category
  const byCategory = new Map();
  snap.forEach((d) => {
    const data = d.data();
    const cat = (typeof data.category === "string" && data.category.trim()) ? data.category : "Other";
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    const updatedTs = typeof data.updatedAt === "string" ? Date.parse(data.updatedAt) || 0 : 0;
    byCategory.get(cat).push({ id: d.id, ts: parseDeadlineTs(data.deadline), updated: updatedTs });
  });

  const overflow = [];
  const perCategory = {};
  for (const [cat, items] of byCategory) {
    // Sort: nearest deadline first; ties → freshest scrape
    items.sort((a, b) => a.ts - b.ts || b.updated - a.updated);
    perCategory[cat] = Math.min(items.length, MAX_PER_CAT);
    if (items.length > MAX_PER_CAT) {
      overflow.push(...items.slice(MAX_PER_CAT).map((i) => i.id));
    }
  }

  console.log("\n   📊 Per-category breakdown:");
  for (const [cat, count] of Object.entries(perCategory)) {
    const total = byCategory.get(cat)?.length ?? count;
    const trimmed = total > MAX_PER_CAT ? ` (trimmed from ${total})` : "";
    console.log(`      ${cat.padEnd(20)} : ${count}${trimmed}`);
  }

  if (overflow.length === 0) {
    console.log("\n   ✅ All categories are within the 20-item cap — nothing to trim.");
    return 0;
  }

  if (DRY_RUN) {
    console.log(`\n   [DRY RUN] Would delete ${overflow.length} overflow docs. Skipping.`);
    return overflow.length;
  }

  // Delete overflow in batches
  const CHUNK = 250;
  let deleted = 0;
  for (let i = 0; i < overflow.length; i += CHUNK) {
    const chunk = overflow.slice(i, i + CHUNK);
    const batch = db.batch();
    for (const id of chunk) batch.delete(db.collection("org_opportunities").doc(id));
    await batch.commit();
    deleted += chunk.length;
  }

  console.log(`\n   ✅ Removed ${deleted} overflow docs. Each section now has ≤${MAX_PER_CAT} opportunities.`);
  return deleted;
}

// ── Step 7: Final summary ────────────────────────────────────────────────────
async function printFinalSummary() {
  console.log("\n📋 Step 7 — Final Firestore summary...");
  const snap = await db
    .collection("org_opportunities")
    .where("status", "==", "approved")
    .get();

  const byCategory = {};
  snap.forEach((d) => {
    const cat = d.data().category || "Other";
    byCategory[cat] = (byCategory[cat] || 0) + 1;
  });

  console.log(`\n   Total approved & live: ${snap.size}`);
  console.log("   Per section:");
  for (const [cat, count] of Object.entries(byCategory)) {
    const bar = "█".repeat(Math.min(count, 20)) + (count < 20 ? "░".repeat(20 - count) : "");
    console.log(`      ${cat.padEnd(20)} [${bar}] ${count}`);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("══════════════════════════════════════════════════════════════");
  console.log("  NEXORA — Clean & Rescrape (20 opportunities per section)");
  console.log("══════════════════════════════════════════════════════════════");

  if (DRY_RUN) console.log("\n[DRY RUN MODE — no writes will happen]\n");

  if (!RESCRAPE_ONLY && !APPROVE_ONLY) {
    await cleanOpportunities();
    await cleanSummaryCache();
    await resetScrapeGuard();
  }

  if (!CLEAN_ONLY && !APPROVE_ONLY) {
    await triggerForceRescrape();
  }

  if (!CLEAN_ONLY) {
    await bulkApproveAutomated();
    await enforceCapOf20();
    await printFinalSummary();
  }

  console.log("\n🎉 Done! Open http://localhost:3000/explore to see 20 cards per section.\n");
}

main().catch((err) => {
  console.error("\n❌ Fatal error:", err.message);
  console.error(err.stack);
  process.exit(1);
});
