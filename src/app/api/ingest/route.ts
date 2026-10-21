import { NextResponse } from "next/server";
import { runIngestion } from "@/lib/ingestion/run";
import { requireCron } from "@/lib/serverAuth";
import { enforceCategoryCaps } from "@/lib/firestoreSync";

// Default Vercel function timeout is 300s (all plans, as of 2026) — plenty
// for this pipeline given the low per-feed item caps in sources.ts.
export const maxDuration = 300;

// Don't cache this route — every invocation should actually run.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Fail-closed in production: a missing/blank CRON_SECRET rejects every caller
  // instead of silently turning this into a public 300s scraping + LLM endpoint.
  const auth = await requireCron(request);
  if (!auth.ok) return auth.response;

  try {
    const summary = await runIngestion();

    // This pipeline writes into the same org_opportunities collection as
    // /api/scrape, so the 20-per-category cap has to run here too — otherwise
    // a cron that only hits /api/ingest could grow the catalogue without bound
    // until the next scrape day. Expired items are pruned inside runIngestion.
    let caps: Awaited<ReturnType<typeof enforceCategoryCaps>> | { deletedCount: number; perCategory: Record<string, number> } = {
      deletedCount: 0,
      perCategory: {},
    };
    try {
      caps = await enforceCategoryCaps(20);
    } catch (capErr: any) {
      console.error("[Ingestion] Category cap failed:", capErr?.message);
    }

    // A run with source-level errors is still a real run — returning 500 would
    // make Vercel Cron retry a pipeline that is only partially broken, adding
    // load and duplicating work. Instead the response says plainly that it was
    // degraded and carries the per-source detail.
    const degraded = summary.errors.length > 0;
    return NextResponse.json(
      {
        success: !degraded,
        degraded,
        message: degraded
          ? `Run ${summary.runId} completed with ${summary.errors.length} issue(s). See summary.errors and summary.perSource.`
          : `Run ${summary.runId} completed cleanly.`,
        summary,
        categoryCaps: { deletedCount: caps.deletedCount, perCategory: caps.perCategory },
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("[Ingestion] Fatal error:", err);
    return NextResponse.json({ error: err.message || "Ingestion failed" }, { status: 500 });
  }
}
