import { NextResponse } from "next/server";
import { runAllScrapers } from "@/lib/ingestion/scrapers";
import {
  syncOpportunitiesToFirestore,
  getActiveOpportunitiesFromFirestore,
  pruneExpiredFromFirestore,
  enforceCategoryCaps,
} from "@/lib/firestoreSync";
import { requireCron } from "@/lib/serverAuth";
import { enforceRateLimit, LIMITS } from "@/lib/rateLimit";
import { summarizePendingOpportunities } from "@/lib/storage/batchSummarizer";
import { getAdminDb, hasAdminCredentials } from "@/lib/firebaseAdmin";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

// Self-scrape cadence: a real scrape (cron or manual force) happens at most
// once per 3 days. The cron fires on its own schedule, but the route skips
// itself when the window has not elapsed — and a manual force scrape resets
// the window, so the next auto scrape waits 3 days from the manual run.
const SCRAPE_INTERVAL_MS = 72 * 60 * 60 * 1000;

// Post-scrape summarization is bounded: every summary is a paid AI call inside
// a 300s function that just spent most of its budget scraping. The dedicated
// /api/summarize-all cron sweeps up anything this batch has no time for.
const AUTO_SUMMARIZE_LIMIT = 50;
// Stop starting new phases when fewer than this many seconds remain.
const TIME_GUARD_MS = 40_000;

const META_COLLECTION = "nexora_meta";
const SCRAPE_STATE_DOC = "scrape_state";

async function readLastScrapedAt(): Promise<string | null> {
  if (!hasAdminCredentials()) return null;
  try {
    const snap = await getAdminDb().collection(META_COLLECTION).doc(SCRAPE_STATE_DOC).get();
    const value = snap.data()?.lastScrapedAt;
    return typeof value === "string" ? value : null;
  } catch (err: any) {
    console.warn("[api/scrape] Failed to read scrape state:", err.message);
    return null;
  }
}

async function writeLastScrapedAt(iso: string): Promise<void> {
  if (!hasAdminCredentials()) return;
  try {
    await getAdminDb().collection(META_COLLECTION).doc(SCRAPE_STATE_DOC).set(
      { lastScrapedAt: iso, updatedAt: new Date().toISOString() },
      { merge: true }
    );
  } catch (err: any) {
    console.warn("[api/scrape] Failed to persist scrape state:", err.message);
  }
}

// GET /api/scrape?preview=1  -> PUBLIC, read-only. Serve the active dataset from Firestore.
// GET /api/scrape?force=1    -> CRON ONLY. Run scrapers, upsert deduplicated, prune expired.
// GET /api/scrape?source=x   -> CRON ONLY. Scrape a single source and upsert it.
// Any combination of preview + source/force is rejected: `preview` must never grant a write.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const preview = url.searchParams.get("preview") === "1";
  const force = url.searchParams.get("force") === "1";
  const source = url.searchParams.get("source");

  const wantsWrite = Boolean(force || source);
  if (preview && wantsWrite) {
    return NextResponse.json(
      { error: "preview=1 is read-only and cannot be combined with force=1 or source=" },
      { status: 400 }
    );
  }

  // `requireCron` fails closed in production when CRON_SECRET is missing/blank.
  // The default branch (no preview flag) can also trigger the scrapers, so it is gated too.
  if (wantsWrite || !preview) {
    const auth = await requireCron(request);
    if (!auth.ok) return auth.response;
  } else {
    // Rate-limit ONLY the public read-only preview path. The cron/write paths
    // are authenticated above; applying the shared preview bucket to them let
    // public preview traffic exhaust the limit and 429 the cron itself.
    const limited = enforceRateLimit(request, LIMITS.scrapePreview);
    if (!limited.ok) return limited.response;
  }

  try {
    // Single-source test/preview
    if (source) {
      const map: Record<string, () => Promise<any>> = {
        devpost: async () => (await import("@/lib/ingestion/scrapers/devpost")).scrapeDevpost(),
        unstop: async () => (await import("@/lib/ingestion/scrapers/unstop")).scrapeUnstop(),
        internshala: async () => (await import("@/lib/ingestion/scrapers/internshala")).scrapeInternshala(),
        jobs: async () => (await import("@/lib/ingestion/scrapers/jobsApi")).scrapeJobsApis(),
        scholarships: async () => {
          const m = await import("@/lib/ingestion/scrapers/scholarships");
          const [a, b] = await Promise.all([m.scrapeScholarshipRss(), m.scrapeScholarshipHtml()]);
          return [...a, ...b];
        },
        conferences: async () => (await import("@/lib/ingestion/scrapers/conferences")).scrapeConferences(),
        fellowships: async () => (await import("@/lib/ingestion/scrapers/fellowships")).scrapeFellowships(),
        generic: async () => (await import("@/lib/ingestion/scrapers/generic")).scrapeGenericPages(),
      };
      const key = source.toLowerCase();
      // Object.hasOwn, not `map[key]` — otherwise ?source=constructor resolves to Object.
      if (!Object.hasOwn(map, key)) {
        return NextResponse.json({ error: `Unknown source: ${source}` }, { status: 400 });
      }
      const scraped = await map[key]();

      // Upsert these directly to Firestore so they persist without duplicates
      const syncResult = await syncOpportunitiesToFirestore(scraped);
      return NextResponse.json({
        success: true,
        source,
        count: scraped.length,
        syncResult,
        opportunities: scraped,
      });
    }

    const t0 = Date.now();

    // 1. 3-day self-scrape guard. The cron path (no force) only re-scrapes
    // when the window has elapsed; a manual force=1 always runs and resets
    // the window, so the next auto scrape waits a full 3 days from now.
    const lastScrapedAt = await readLastScrapedAt();
    const lastTs = lastScrapedAt ? Date.parse(lastScrapedAt) : 0;
    const ageMs = lastTs ? Date.now() - lastTs : Number.POSITIVE_INFINITY;
    if (!force && lastTs && ageMs < SCRAPE_INTERVAL_MS) {
      const existing = await getActiveOpportunitiesFromFirestore();
      try {
        const prune = await pruneExpiredFromFirestore();
        if (prune.prunedCount > 0) {
          console.log(`[api/scrape] pruned ${prune.prunedCount} expired opportunities`);
        }
      } catch (err: any) {
        console.warn("[api/scrape] prune error:", err.message);
      }
      return NextResponse.json({
        success: true,
        source: "firestore",
        cached: true,
        skipped: true,
        reason: "Inside the 3-day self-scrape window; skipping. Use force=1 to re-scrape now.",
        lastScrapedAt,
        nextScrapeAt: new Date(lastTs + SCRAPE_INTERVAL_MS).toISOString(),
        count: existing.length,
        durationMs: Date.now() - t0,
        opportunities: existing,
      });
    }

    // 2. Run scrapers & sync to Firestore (force, window elapsed, or empty store)
    console.log("[api/scrape] Running scrapers to sync into Firestore...");
    const scrapeResult = await runAllScrapers();

    // Sync scraped opportunities to Firestore (No Duplicates + Auto Expiry Filter)
    const syncResult = await syncOpportunitiesToFirestore(scrapeResult.opportunities);

    // 2b. Cap each category so the catalogue stays bounded (expired items and
    // their summaries were already removed inside sync/prune).
    let capResult: Awaited<ReturnType<typeof enforceCategoryCaps>>;
    try {
      capResult = await enforceCategoryCaps(20);
    } catch (capErr: any) {
      console.warn("[api/scrape] category cap error:", capErr.message);
      capResult = { deletedCount: 0, perCategory: {}, errors: [capErr.message] };
    }

    // 2c. Record the scrape so the 3-day guard counts manual runs too.
    const scrapedAtIso = new Date().toISOString();
    await writeLastScrapedAt(scrapedAtIso);

    // 2d. Auto-summarize new/missing opportunities — no manual command needed.
    // Bounded and time-budgeted: whatever does not fit is swept up by the
    // /api/summarize-all cron.
    let summarizeStats: unknown = null;
    const remainingMs = 300_000 - (Date.now() - t0);
    if (remainingMs > TIME_GUARD_MS) {
      try {
        summarizeStats = await summarizePendingOpportunities({ limit: AUTO_SUMMARIZE_LIMIT });
      } catch (sumErr: any) {
        console.warn("[api/scrape] post-scrape summarization failed:", sumErr.message);
        summarizeStats = { failed: true, error: sumErr.message };
      }
    } else {
      summarizeStats = { skipped: true, reason: "Not enough function time left; /api/summarize-all cron will cover it." };
    }

    // Read back final active dataset from Firestore
    const finalOpps = await getActiveOpportunitiesFromFirestore();

    return NextResponse.json({
      success: true,
      source: "live-scraped-to-firestore",
      cached: false,
      durationMs: Date.now() - t0,
      count: finalOpps.length,
      scrapedCount: scrapeResult.opportunities.length,
      syncResult,
      categoryCaps: { deletedCount: capResult.deletedCount, perCategory: capResult.perCategory },
      autoSummarized: summarizeStats,
      nextScrapeAt: new Date(Date.parse(scrapedAtIso) + SCRAPE_INTERVAL_MS).toISOString(),
      perSourceCounts: scrapeResult.perSourceCounts,
      errors: scrapeResult.errors,
      opportunities: finalOpps,
    });
  } catch (err: any) {
    console.error("[Scrape] Fatal:", err);
    return NextResponse.json({ error: err.message || "Scrape failed" }, { status: 500 });
  }
}
