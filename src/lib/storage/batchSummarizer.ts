// Background batch summarizer: pre-computes AI summaries for every stored
// scraped opportunity and persists them to the summaries store, so the
// explore popup is instant (cache hit) instead of calling AI on each click.
// Runs side-by-side with the website (startup + cron + /api/summarize-all).

import { AIRouterService } from "@/lib/aiProviders";
import { neutralize } from "@/lib/promptGuard";
import { getAdminDb, hasAdminCredentials } from "@/lib/firebaseAdmin";
import { getCachedSummary, saveSummary, flushSummaryWrites } from "./summariesStore";

const CONCURRENCY = 3;

/** Upper bound on one batch. Each item is a paid AI call. */
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 15;

/** How many stored opportunities we scan for missing summaries. */
const SCAN_LIMIT = 400;

/**
 * Input now comes from Firestore (`org_opportunities`), the single live store.
 *
 * The old source was `storage/scraped-opportunities.json`, which had no writer
 * left anywhere in the repo — and on Vercel's read-only filesystem `readStore()`
 * returned null regardless, so `/api/summarize-all` processed 0 items and still
 * reported success.
 */
async function loadStoredOpportunities(): Promise<any[]> {
  // No orderBy: a status+updatedAt sort needs a composite index, and
  // firestore.indexes.json defines none — the query would fail with
  // FAILED_PRECONDITION until someone deploys one.
  const snap = await getAdminDb()
    .collection("org_opportunities")
    .where("status", "==", "approved")
    .limit(SCAN_LIMIT)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export interface BatchSummaryStats {
  processed: number;
  aiCalls: number;
  saved: number;
  cachedSkipped: number;
  failed: number;
  errors: string[];
  totalStored: number;
  totalSummarized: number;
  limit: number;
  limitClamped: boolean;
}

function buildPrompt(o: any): string {
  // Stored card fields can originate from scraped pages — neutralize before
  // interpolation so they cannot close the ```""" fences or impersonate
  // control tags and rewrite the instructions (prompt injection).
  const q = (v: unknown, max = 500) => neutralize(v, max).replace(/"/g, "'");
  const title = q(o.title);
  const orgName = q(o.orgName);
  const category = q(o.category);
  const deadline = q(o.deadline);
  const country = q(o.country);
  const field = q(o.field);
  const eligibility = q(o.eligibility, 1000);
  const url = q(o.applyLink || o.sourceUrl, 2000);
  const description = neutralize((o.description || "").slice(0, 2500), 2500);

  return `You are NEXORA's opportunity explainer. Summarize the opportunity described below into a proper easy-to-understand format so any student can understand what is happening.

RULES:
- Use simple, friendly language (no jargon)
- Structure EXACTLY like this (use markdown headings):
## Quick Summary
2-3 lines what this opportunity is.

## What it's about
4-6 sentences covering purpose, what you will do/learn, mode (online/offline), etc.

## Who can apply
Bullet list of eligibility (who is allowed, degree, year, gender if any).

## Benefits / Prizes / Support
Bullet list.

## Important Dates & Location
- Deadline:
- Location / Mode:
- Other dates if found:

## How to Apply
Numbered steps 1-4 in simple words.

## Main Facts (at the very end)
Bullet list of 5-8 key facts the user MUST know (most important info compressed). This section MUST be last.

If any info is not found, write "Check official page" rather than guessing. Keep total under 450 words.

OPPORTUNITY DETAILS:
Title="${title}"
Organization="${orgName}"
Category="${category}"
Deadline="${deadline}"
Country="${country}"
Field="${field}"
Eligibility="${eligibility}"
URL="${url}"

DESCRIPTION:
"""
${description}
"""`;
}

async function summarizeOne(o: any): Promise<string> {
  const prompt = buildPrompt(o);
  const summary = await AIRouterService.requestAI(prompt, false);
  const text = typeof summary === "string" ? summary : JSON.stringify(summary);
  if (!text || text.trim().length < 50) throw new Error("Empty AI output");
  return text.trim();
}

/** Processes stored opportunities that lack a fresh summary. */
export async function summarizePendingOpportunities(
  opts: { limit?: number; force?: boolean } = {},
  onProgress?: (done: number, total: number) => void
): Promise<BatchSummaryStats> {
  // `?limit=100000` used to be honoured verbatim. Every item in the batch is a
  // paid AI call, so an unbounded (or merely careless) limit could spend an
  // arbitrary amount of money in a single request. Clamp, and say so.
  const requested = Number(opts.limit);
  const limit =
    Number.isFinite(requested) && requested > 0
      ? Math.min(Math.floor(requested), MAX_LIMIT)
      : DEFAULT_LIMIT;
  const limitClamped = Number.isFinite(requested) && requested > MAX_LIMIT;
  const force = !!opts.force;

  const errors: string[] = [];

  // An empty scan must never masquerade as success: say why the batch did
  // nothing instead of returning `processed: 0` with no explanation.
  let opps: any[] = [];
  if (!hasAdminCredentials()) {
    errors.push("Admin credentials unavailable — cannot read opportunities from Firestore.");
  } else {
    try {
      opps = await loadStoredOpportunities();
    } catch (err: any) {
      errors.push(`Firestore read failed: ${(err?.message || "unknown error").slice(0, 120)}`);
    }
  }

  let skippedNoUrl = 0;
  const toProcess: any[] = [];
  for (const o of opps) {
    const applyLink = (o.applyLink || o.sourceUrl || "") as string;
    if (!applyLink) {
      skippedNoUrl++;
      continue;
    }
    if (!force && (await getCachedSummary(applyLink))) continue;
    toProcess.push(o);
    if (toProcess.length >= limit) break;
  }

  let saved = 0;
  let failed = 0;
  let aiCalls = 0;

  let index = 0;

  async function worker() {
    while (index < toProcess.length) {
      const i = index++;
      const o = toProcess[i];
      const applyLink = (o.applyLink || o.sourceUrl || "") as string;
      const title = (o.title || "") as string;
      const orgName = (o.orgName || "") as string;
      try {
        const summary = await summarizeOne(o);
        aiCalls++;
        await saveSummary(applyLink, { summary, provider: "openrouter-key1", title, orgName });
        saved++;
      } catch (err: any) {
        failed++;
        errors.push(`${title.slice(0, 30)}: ${(err.message || "AI failed").slice(0, 70)}`);
      }
      if (onProgress) onProgress(saved + failed, toProcess.length);
    }
  }

  const workerCount = Math.min(CONCURRENCY, toProcess.length || 1);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  // `saveSummary` serialises its writes behind a queue, so the route must
  // await the queue or it can return before the summaries have actually landed
  // (and, on a frozen serverless instance, lose them entirely).
  await flushSummaryWrites();

  let summarized = 0;
  for (const o of opps) {
    if (await getCachedSummary((o.applyLink || o.sourceUrl || "") as string)) summarized++;
  }

  if (limitClamped) {
    errors.push(
      `Requested limit ${requested} was clamped to ${MAX_LIMIT}. Each summary is a paid AI call, so a single request cannot fan out without bound.`
    );
  }
  if (skippedNoUrl > 0) {
    errors.push(`${skippedNoUrl} stored opportunit${skippedNoUrl > 1 ? "ies have" : "y has"} no apply or source URL and cannot be summarized.`);
  }

  return {
    processed: toProcess.length,
    aiCalls,
    saved,
    cachedSkipped: opps.length - toProcess.length - skippedNoUrl,
    failed,
    errors: errors.slice(0, 20),
    totalStored: opps.length,
    totalSummarized: summarized,
    limit,
    limitClamped,
  };
}