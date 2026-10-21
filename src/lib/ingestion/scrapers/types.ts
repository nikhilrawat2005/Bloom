// ─── Shared types for the scraper system ───────────────────────────────

import type { NormalizedOpportunity } from "../normalize";

export interface ScrapedOpportunity extends NormalizedOpportunity {
  sourceUrl: string;
  sourceType: "trusted-feed" | "scraped";
  autoApprove: boolean;
  scraperName: string;
}

export interface ScraperResult {
  scraperName: string;
  opportunities: ScrapedOpportunity[];
  rawListings: import("../sources").RawListing[];
  error?: string;
}

export interface ScraperConfig {
  name: string;
  category: string;
  timeoutMs: number;
  maxItems: number;
}
