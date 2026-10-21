// Node-only startup wiring. This module is imported exclusively from
// instrumentation.ts behind a `process.env.NEXT_RUNTIME === "nodejs"` guard so
// webpack drops it from the edge/client compilation entirely (Next replaces
// NEXT_RUNTIME with a literal at parse time, so the guarded import is
// dead-code-eliminated). Without this split the edge compile of
// instrumentation.ts statically bundles node:crypto / fs / firebase-admin and
// every route fails to compile.
export async function registerNode(): Promise<void> {
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  // node-cron timers only run in local/dev. On Vercel serverless the instance
  // freezes after the response, so in-process crons never tick reliably there —
  // production scheduling lives in vercel.json (ingest 3am, scrape?force=1 4am,
  // summarize-all every 6h). Do NOT remove this gate to "enable" prod crons;
  // use vercel.json instead.
  if (process.env.NODE_ENV !== "production" || process.env.ENABLE_LOCAL_CRON === "1") {
    try {
      const cron = await import("node-cron");
      // Scrape every 2 days at 09:00; override via SCRAPE_CRON env
      const SCRAPE_CRON = process.env.SCRAPE_CRON || "0 9 */2 * *";
      // Expiry check every 12 hours; override via EXPIRY_CRON env
      const EXPIRY_CRON = process.env.EXPIRY_CRON || "0 */12 * * *";
      // Background AI summary pre-compute; override via SUMMARY_CRON env
      const SUMMARY_CRON = process.env.SUMMARY_CRON || "0 */6 * * *";

      cron.schedule(SCRAPE_CRON, async () => {
        console.log(`[firestore-cron] 2-day auto-scrape triggered (${new Date().toISOString()})`);
        try {
          const { runAllScrapers } = await import("@/lib/ingestion/scrapers");
          const { syncOpportunitiesToFirestore } = await import("@/lib/firestoreSync");
          const scrapeResult = await runAllScrapers();
          const syncResult = await syncOpportunitiesToFirestore(scrapeResult.opportunities);
          console.log(`[firestore-cron] Scrape sync done: ${syncResult.newOrUpdated} active items synced to Firestore (no duplicates, expired pruned)`);
          // Kick off background summary pre-compute so popups are instant
          try {
            const { summarizePendingOpportunities } = await import("@/lib/storage/batchSummarizer");
            const s = await summarizePendingOpportunities({ limit: 25 });
            console.log(`[summary-bg] After-scrape pre-compute: ${s.saved} summarized, ${s.cachedSkipped} already cached, ${s.failed} failed`);
          } catch (se: any) {
            console.warn("[summary-bg] Post-scrape summarizer skipped:", se.message);
          }
        } catch (e: any) {
          console.error("[firestore-cron] Scrape sync failed:", e.message);
        }
      });
      console.log(`[firestore-cron] Scheduled Firestore scrape every 2 days: "${SCRAPE_CRON}"`);

      cron.schedule(EXPIRY_CRON, async () => {
        console.log(`[firestore-cron] 12h Firestore expiry check triggered (${new Date().toISOString()})`);
        try {
          const { pruneExpiredFromFirestore } = await import("@/lib/firestoreSync");
          const { prunedCount } = await pruneExpiredFromFirestore();
          console.log(`[firestore-cron] Expiry check complete: ${prunedCount} expired opportunities pruned from Firestore`);
        } catch (e: any) {
          console.error("[firestore-cron] Expiry check failed:", e.message);
        }
      });
      console.log(`[firestore-cron] Scheduled Firestore expiry check every 12h: "${EXPIRY_CRON}"`);

      cron.schedule(SUMMARY_CRON, async () => {
        console.log(`[summary-bg] 6h summary pre-compute triggered (${new Date().toISOString()})`);
        try {
          const { summarizePendingOpportunities } = await import("@/lib/storage/batchSummarizer");
          const s = await summarizePendingOpportunities({ limit: 30 });
          console.log(`[summary-bg] Pre-compute done: ${s.saved} newly summarized, ${s.cachedSkipped} already cached, ${s.failed} failed, stored total ${s.totalStored}, summarized now ${s.totalSummarized}`);
        } catch (e: any) {
          console.error("[summary-bg] Pre-compute failed:", e.message);
        }
      });
      console.log(`[summary-bg] Scheduled summary pre-compute every 6h: "${SUMMARY_CRON}"`);

      // Startup: if Firestore collection is empty, trigger initial scrape & sync
      if (process.env.SCRAPE_ON_STARTUP !== "0") {
        setTimeout(async () => {
          try {
            const { getActiveOpportunitiesFromFirestore, syncOpportunitiesToFirestore, pruneExpiredFromFirestore } = await import("@/lib/firestoreSync");
            const existing = await getActiveOpportunitiesFromFirestore();
            if (existing.length === 0) {
              console.log("[firestore-cron] Firestore empty → Running initial scrape and syncing to Firestore (15s after boot)...");
              const { runAllScrapers } = await import("@/lib/ingestion/scrapers");
              const scrapeResult = await runAllScrapers();
              const syncResult = await syncOpportunitiesToFirestore(scrapeResult.opportunities);
              console.log(`[firestore-cron] Initial sync to Firestore complete: ${syncResult.newOrUpdated} added/updated, ${syncResult.skippedExpired} expired skipped`);
            } else {
              console.log(`[firestore-cron] Firestore has ${existing.length} active opportunities → running expiry cleanup...`);
              const pruneRes = await pruneExpiredFromFirestore();
              console.log(`[firestore-cron] Startup expiry cleanup: ${pruneRes.prunedCount} expired pruned`);
            }
          } catch (e: any) {
            console.warn("[firestore-cron] Startup check failed:", e.message);
          }
        }, 12000);
      }

      // Background AI summary pre-compute on boot (fire-and-forget, capped):
      // pre-summarizes stored opportunities so explore popups open instantly.
      if (process.env.SUMMARIZE_ON_STARTUP !== "0") {
        setTimeout(async () => {
          try {
            const { summarizePendingOpportunities } = await import("@/lib/storage/batchSummarizer");
            const stats = await summarizePendingOpportunities({ limit: 15 });
            console.log(`[summary-bg] Startup pre-compute: ${stats.saved} summarized, ${stats.cachedSkipped} cached, ${stats.failed} failed, summary cache now ${stats.totalSummarized}/${stats.totalStored}`);
          } catch (e: any) {
            console.warn("[summary-bg] Startup summarizer skipped:", e.message);
          }
        }, 25000);
      }
    } catch (e) {
      // Also fires when a SCRAPE_CRON/EXPIRY_CRON/SUMMARY_CRON expression is
      // invalid — log the real error so bad env values aren't misdiagnosed.
      console.warn("[firestore-cron] Failed to schedule local crons (node-cron unavailable or invalid cron expression):", e);
    }
  }
}
