// ─── Unified scraper orchestrator ──────────────────────────────────────
// Runs all platform scrapers in parallel with isolation (one failure doesn't kill others)
// Returns both direct opportunities and raw listings for AI fallback.

import type { ScrapedOpportunity } from "./types";
import type { RawListing } from "../sources";
import { scrapeDevpost } from "./devpost";
import { scrapeUnstop } from "./unstop";
import { scrapeInternshala } from "./internshala";
import { scrapeJobsApis } from "./jobsApi";
import { scrapeScholarshipRss, scrapeScholarshipHtml } from "./scholarships";
import { scrapeConferences } from "./conferences";
import { scrapeFellowships } from "./fellowships";
import { scrapeResearch } from "./research";
import { scrapeWorkshops } from "./workshops";
import { scrapeGenericPages, scrapeGenericAsRaw } from "./generic";

export interface ScrapeResult {
  opportunities: ScrapedOpportunity[];
  rawListings: RawListing[];
  errors: string[];
  perSourceCounts: Record<string, number>;
}

export async function runAllScrapers(): Promise<ScrapeResult> {
  const opportunities: ScrapedOpportunity[] = [];
  const rawListings: RawListing[] = [];
  const errors: string[] = [];
  const perSourceCounts: Record<string, number> = {};

  const tasks: { name: string; fn: () => Promise<ScrapedOpportunity[]> }[] = [
    { name: "Devpost", fn: scrapeDevpost },
    { name: "Unstop", fn: scrapeUnstop },
    { name: "Internshala", fn: scrapeInternshala },
    { name: "JobsAPIs (Arbeitnow+Remotive)", fn: scrapeJobsApis },
    { name: "ScholarshipRSS", fn: scrapeScholarshipRss },
    { name: "ScholarshipHTML", fn: scrapeScholarshipHtml },
    { name: "Conferences", fn: scrapeConferences },
    { name: "Fellowships", fn: scrapeFellowships },
    { name: "Research", fn: scrapeResearch },
    { name: "Workshops", fn: scrapeWorkshops },
    { name: "GenericPages", fn: scrapeGenericPages },
  ];

  const results = await Promise.allSettled(
    tasks.map(async (t) => {
      const res = await t.fn();
      return { name: t.name, data: res };
    })
  );

  for (const r of results) {
    if (r.status === "fulfilled") {
      const { name, data } = r.value;
      perSourceCounts[name] = data.length;
      opportunities.push(...data);

      // Almost every scraper catches its own fetch/parse errors and returns `[]`.
      // That means `Promise.allSettled` essentially never rejects, so a scraper
      // broken by a CSS change or a rate limit was indistinguishable from one
      // that legitimately found nothing — `errors` stayed empty and the run was
      // logged as healthy. This is what let "Devpost: 0" sit unnoticed in the
      // data file. A zero-yield source is now reported so it shows up in
      // `ingestion_logs`.
      if (data.length === 0) {
        const msg = `Source "${name}" returned 0 opportunities. This is either an upstream outage or a broken parser — verify before trusting the run.`;
        errors.push(msg);
        console.warn(`[Scraper] ${msg}`);
      }
    } else {
      const msg = `${r.reason?.message || String(r.reason)} (source name unavailable: the task rejected before returning)`;
      errors.push(msg);
      console.warn(`[Scraper] A scraper task failed:`, msg);
    }
  }

  // Also fetch a few generic pages as RawListing fallback for AI extraction
  // (these are slower/cheerio-unfriendly pages where AI parsing is better)
  const fallbackUrls = [
    "https://www.hackerearth.com/challenges/",
    "https://www.techgig.com/hackathon",
    "https://opportunitydesk.org/",
  ];
  try {
    const fallbackRaw = await scrapeGenericAsRaw(fallbackUrls);
    rawListings.push(...fallbackRaw);
    perSourceCounts["GenericRaw(AI)"] = fallbackRaw.length;
    if (fallbackRaw.length === 0) {
      errors.push(
        "GenericRaw fallback returned 0 listings from 3 URLs — all three are likely blocked or their markup changed."
      );
    }
  } catch (err: any) {
    errors.push(`GenericRaw fallback failed: ${err.message}`);
  }

  return { opportunities, rawListings, errors, perSourceCounts };
}

// Re-export individual scrapers for targeted use
export { scrapeDevpost } from "./devpost";
export { scrapeUnstop } from "./unstop";
export { scrapeInternshala } from "./internshala";
export { scrapeJobsApis } from "./jobsApi";
export { scrapeScholarshipRss, scrapeScholarshipHtml } from "./scholarships";
export { scrapeConferences } from "./conferences";
export { scrapeFellowships } from "./fellowships";
export { scrapeGenericPages } from "./generic";
