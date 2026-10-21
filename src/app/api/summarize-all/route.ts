import { NextResponse } from "next/server";
import { summarizePendingOpportunities } from "@/lib/storage/batchSummarizer";
import { requireCron } from "@/lib/serverAuth";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

// Hard ceiling on a single run. Each pending opportunity is one paid LLM call,
// and the caller-supplied `limit` was previously passed straight through, so
// ?limit=100000 meant 100k sequential model calls inside a 300s function.
const MAX_LIMIT_PER_RUN = 100;

/**
 * In-flight guard.
 *
 * This route is paid work over a shared, resumable work set (everything without
 * a fresh cached summary). Nothing stopped two overlapping runs — a double cron
 * trigger, or the scheduled run plus a manual POST — from picking the *same*
 * pending opportunities and paying for both. The second run's summaries were
 * then simply overwritten by the first's.
 *
 * Scope: this is a per-instance guard, not a distributed lock. Serverless
 * instances are independent, so it cannot serialise across them. It closes the
 * realistic same-instance overlap (retries, manual + scheduled, concurrent
 * clients) without pretending to be a cluster-wide mutex. A true cross-instance
 * lock would need shared state such as Firestore or Redis, which this batch does
 * not otherwise touch.
 */
let inFlight = false;

async function handle(request: Request) {
  // requireCron fails closed in production when CRON_SECRET is missing/blank,
  // and accepts the secret only via the Authorization header (never ?secret=,
  // which leaked the secret into Vercel logs and Referer headers).
  const auth = await requireCron(request);
  if (!auth.ok) return auth.response;

  if (inFlight) {
    return NextResponse.json(
      {
        success: false,
        skipped: true,
        error:
          "A summarization run is already in progress on this instance. Wait for it to finish before starting another, otherwise both runs pay for the same pending opportunities.",
      },
      { status: 409 }
    );
  }

  const url = new URL(request.url);
  const requested = parseInt(url.searchParams.get("limit") || "20", 10);
  const limit = Math.min(Number.isFinite(requested) && requested > 0 ? requested : 20, MAX_LIMIT_PER_RUN);
  const force = url.searchParams.get("force") === "1";

  inFlight = true;
  try {
    const stats = await summarizePendingOpportunities({ limit, force });

    return NextResponse.json({
      success: true,
      ...stats,
      note: "Background summarizer ran. Summary cache updated for the processed opportunities.",
    });
  } catch (err) {
    console.error("[summarize-all] run failed:", (err as Error)?.message);
    return NextResponse.json(
      { success: false, error: "The summarization run failed partway through. See the batch errors in the server log." },
      { status: 500 }
    );
  } finally {
    // Always released, including on failure, or one bad run would wedge the route
    // for the life of the instance.
    inFlight = false;
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
