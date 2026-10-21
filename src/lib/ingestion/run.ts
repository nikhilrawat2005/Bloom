import { getAdminDb } from "@/lib/firebaseAdmin";
import { fetchTrustedSources, fetchScrapedSources, RawListing } from "./sources";
import { normalizeToOpportunities } from "./normalize";
import { generateOpportunityDocId } from "@/lib/firestoreSync";
import { runAllScrapers } from "./scrapers";
import type { ScrapedOpportunity } from "./scrapers/types";

export interface IngestionSummary {
  startedAt: string;
  finishedAt: string;
  runId: string;
  sourcesProcessed: number;
  opportunitiesExtracted: number;
  newlyAdded: number;
  skippedDuplicates: number;
  autoApproved: number;
  pendingReview: number;
  errors: string[];
  perSourceCounts?: Record<string, number>;
  perSource?: Record<string, SourceOutcome>;
}

export interface SourceOutcome {
  fetched: number;
  written: number;
  skippedExpired: number;
  failed: number;
}

type PersistOutcome = "created" | "unchanged" | "updated";

interface PersistResult {
  outcome: PersistOutcome;
  status: string;
}

/** Fields that, when unchanged, mean a re-run has nothing new to say. */
const COMPARED_FIELDS = [
  "title",
  "orgName",
  "deadline",
  "description",
  "applyLink",
  "eligibility",
  "country",
  "category",
  "field",
] as const;

/**
 * Writes one opportunity under its deterministic document ID.
 *
 * This replaces the old `isDuplicate(title, orgName)` check-then-`.add()` pair,
 * which had two independent defects:
 *
 *  1. It used a *different* key from `/api/scrape` (which hashes the URL), so the
 *     same listing written by the two paths could never be recognised as the same
 *     document. Duplicates were permanent.
 *  2. `.catch(() => false)` made every Firestore outage read as "not a duplicate",
 *     so an outage turned into a mass insert of random-ID copies.
 *
 * Keying the write on a deterministic ID makes dedupe atomic in the only sense
 * that matters: two concurrent runs collide on the same document instead of
 * creating two. A failed write now fails closed, because there is nothing to
 * "decide" — the document simply is not updated.
 */
async function persistOpportunityById(
  db: FirebaseFirestore.Firestore,
  opp: {
    title: string;
    orgName: string;
    description: string;
    eligibility: string;
    deadline: string;
    country: string;
    category: string;
    field: string;
    applyLink: string;
    requiredDocuments: string[];
  },
  meta: { sourceType: "trusted-feed" | "scraped"; sourceUrl: string; autoApprove: boolean }
): Promise<PersistResult> {
  const docId = generateOpportunityDocId({
    title: opp.title,
    applyLink: opp.applyLink,
    sourceUrl: meta.sourceUrl,
    orgName: opp.orgName,
  });
  const ref = db.collection("org_opportunities").doc(docId);

  // Read-before-write is only used to avoid pointless writes and to preserve a
  // human moderator's decision. Correctness does not depend on it: the ID is
  // deterministic, so even a fully racy read still cannot create a duplicate.
  let existing: FirebaseFirestore.DocumentData | undefined;
  try {
    existing = (await ref.get()).data();
  } catch (err: any) {
    // Fail closed. Proceeding blind risks resurrecting a listing an admin
    // rejected, which is far worse than skipping this run's refresh.
    console.error(`[Ingestion] Pre-write read failed for ${docId}, skipping:`, err.message);
    throw err;
  }

  if (existing) {
    const priorStatus = typeof existing.status === "string" ? existing.status : "";
    const contentSame =
      COMPARED_FIELDS.every((f) => existing![f] === opp[f]) &&
      // Arrays: reference equality would always report a change.
      JSON.stringify(existing!.requiredDocuments ?? []) === JSON.stringify(opp.requiredDocuments ?? []);
    if (contentSame) {
      return { outcome: "unchanged", status: priorStatus || "approved" };
    }

    const patch: FirebaseFirestore.DocumentData = {
      orgName: opp.orgName,
      title: opp.title,
      description: opp.description,
      eligibility: opp.eligibility,
      deadline: opp.deadline,
      country: opp.country,
      category: opp.category,
      field: opp.field,
      applyLink: opp.applyLink,
      requiredDocuments: opp.requiredDocuments,
      sourceType: meta.sourceType,
      sourceUrl: meta.sourceUrl,
      ingestedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    // Only write a status when the document never had one. Previously this
    // ran whenever priorStatus wasn't pending/rejected, so a content change
    // on an autoApprove:false source demoted an admin-approved document back
    // to "pending" and silently revoked the approval. Status now changes only
    // at creation or via the admin panel.
    if (!priorStatus) {
      patch.status = meta.autoApprove ? "approved" : "pending";
    }
    await ref.set(patch, { merge: true });
    return { outcome: "updated", status: patch.status ?? priorStatus };
  }

  const status = meta.autoApprove ? "approved" : "pending";
  const now = new Date().toISOString();
  await ref.set({
    postedByUid: "automated-ingestion",
    orgName: opp.orgName,
    title: opp.title,
    description: opp.description,
    eligibility: opp.eligibility,
    deadline: opp.deadline,
    country: opp.country,
    category: opp.category,
    field: opp.field,
    applyLink: opp.applyLink,
    requiredDocuments: opp.requiredDocuments,
    status,
    applicationCount: 0,
    viewCount: 0,
    source: "automated",
    sourceType: meta.sourceType,
    sourceUrl: meta.sourceUrl,
    ingestedAt: now,
    createdAt: now,
  });
  return { outcome: "created", status };
}

export async function runIngestion(): Promise<IngestionSummary> {
  const startedAt = new Date().toISOString();
  // Unique per run so two overlapping cron invocations can be told apart in the
  // ingestion_logs collection. Previously every log row was indistinguishable.
  const runId = `${startedAt}-${Math.random().toString(36).slice(2, 8)}`;
  const errors: string[] = [];
  let opportunitiesExtracted = 0;
  let newlyAdded = 0;
  let skippedDuplicates = 0;
  let autoApproved = 0;
  let pendingReview = 0;
  const perSourceCounts: Record<string, number> = {};
  const perSource: Record<string, SourceOutcome> = {};

  const sourceOutcome = (name: string): SourceOutcome => {
    if (!perSource[name]) perSource[name] = { fetched: 0, written: 0, skippedExpired: 0, failed: 0 };
    return perSource[name];
  };

  // ── Phase 1: Run new platform-specific scrapers (cheerio + free APIs) ──
  // These return structured ScrapedOpportunity[] directly — no AI needed.
  let directOpps: ScrapedOpportunity[] = [];
  let scraperRawListings: RawListing[] = [];
  try {
    const scrapeResult = await runAllScrapers();
    directOpps = scrapeResult.opportunities;
    scraperRawListings = scrapeResult.rawListings;
    errors.push(...scrapeResult.errors);
    Object.assign(perSourceCounts, scrapeResult.perSourceCounts);
    console.log(`[Ingestion] New scrapers: ${directOpps.length} direct opps + ${scraperRawListings.length} raw listings`);
  } catch (err: any) {
    errors.push(`New scrapers failed: ${err.message}`);
  }

  // ── Phase 2: Legacy trusted + scraped sources (RSS / HTML → AI) ───────
  const trusted = await fetchTrustedSources().catch((err) => {
    errors.push(`Trusted sources fetch failed: ${err.message}`);
    return [] as RawListing[];
  });
  const scraped = await fetchScrapedSources().catch((err) => {
    errors.push(`Scraped sources fetch failed: ${err.message}`);
    return [] as RawListing[];
  });

  // Merge legacy + scraper raw listings for AI normalization — cap 400
  const MAX_RAW_LISTINGS_PER_RUN = 400;
  const allRawListings: RawListing[] = [...trusted, ...scraped, ...scraperRawListings].slice(0, MAX_RAW_LISTINGS_PER_RUN);
  const db = getAdminDb();

  // ── Phase 2a: Persist direct opportunities (no AI call needed) ─────────
  for (const opp of directOpps) {
    const outcome = sourceOutcome(opp.scraperName || opp.sourceUrl || "direct");
    outcome.fetched++;
    try {
      const result = await persistOpportunityById(db, opp, {
        sourceType: opp.sourceType,
        sourceUrl: opp.sourceUrl,
        autoApprove: opp.autoApprove,
      });
      if (result.outcome === "created") {
        opportunitiesExtracted++;
        newlyAdded++;
        outcome.written++;
        if (result.status === "approved") autoApproved++;
        else pendingReview++;
      } else if (result.outcome === "unchanged") {
        skippedDuplicates++;
      } else {
        opportunitiesExtracted++;
        outcome.written++;
      }
    } catch (err: any) {
      outcome.failed++;
      errors.push(`Failed persisting direct opp "${opp.title}": ${err.message}`);
    }
  }

  // ── Phase 2b: AI-normalize raw listings + persist ──────────────────────
  for (const listing of allRawListings) {
    const outcome = sourceOutcome(listing.sourceUrl);
    outcome.fetched++;
    try {
      const extracted = await normalizeToOpportunities(listing.rawText, listing.sourceUrl);
      opportunitiesExtracted += extracted.length;

      for (const opp of extracted) {
        const result = await persistOpportunityById(db, opp, {
          sourceType: listing.sourceType,
          sourceUrl: listing.sourceUrl,
          autoApprove: listing.autoApprove,
        });
        if (result.outcome === "created") {
          newlyAdded++;
          outcome.written++;
          if (result.status === "approved") autoApproved++;
          else pendingReview++;
        } else if (result.outcome === "unchanged") {
          skippedDuplicates++;
        } else {
          outcome.written++;
        }
      }
    } catch (err: any) {
      outcome.failed++;
      errors.push(`Failed processing ${listing.sourceUrl}: ${err.message}`);
    }
  }

  const finishedAt = new Date().toISOString();

  // `sourcesProcessed` used to be `directOpps.length + allRawListings.length`,
  // i.e. a count of ITEMS presented as a count of SOURCES. A run that fetched
  // from 12 sources but parsed 900 listings reported "900 sources", which made a
  // total outage look like a partial one.
  const sourcesProcessed = Object.keys(perSource).length;

  // A run that fetched nothing at all is almost always an upstream breakage
  // (selector change, rate limit, blocked host). Previously that produced a
  // cheerful summary indistinguishable from a healthy run, and the pipeline
  // could stay silently empty for weeks.
  const totalFetched = Object.values(perSource).reduce((n, s) => n + s.fetched, 0);
  if (totalFetched === 0) {
    const msg = `Run ${runId} fetched zero items across ${sourcesProcessed} source(s). The pipeline is likely broken upstream.`;
    errors.push(msg);
    console.error(`[Ingestion] ${msg}`);
  }

  const summary: IngestionSummary = {
    startedAt,
    finishedAt,
    runId,
    sourcesProcessed,
    opportunitiesExtracted,
    newlyAdded,
    skippedDuplicates,
    autoApproved,
    pendingReview,
    errors,
    perSourceCounts,
    perSource,
  };

  try {
    await db.collection("ingestion_logs").add(summary);
  } catch (err) {
    console.error("[Ingestion] Failed to write ingestion log:", err);
  }

  return summary;
}

/** Lightweight scrape without DB writes — for testing / preview */
export async function previewScrape() {
  const { opportunities, rawListings, errors, perSourceCounts } = await runAllScrapers();
  return { opportunities, rawListings, errors, perSourceCounts };
}

/** Scrape + persist directly to Firestore org_opportunities (deterministic deduplication, expiry handled) */
export async function scrapeAndPersistToStorage() {
  const { syncOpportunitiesToFirestore } = await import("@/lib/firestoreSync");
  const result = await runAllScrapers();
  const syncResult = await syncOpportunitiesToFirestore(result.opportunities);
  return { ...result, storedCount: syncResult.newOrUpdated, syncResult };
}
