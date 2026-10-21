// Persistent store for AI-generated opportunity summaries.
// Keyed by normalized source URL so repeat clicks are instant
// and summaries survive restarts without re-scraping / re-asking AI.
//
// The durable copy lives in Firestore ("summary_cache"), not a JSON file under
// `process.cwd()/storage`. Vercel's filesystem is read-only and ephemeral, so
// the old file store lost every write and forgot everything on cold start:
// the "cache" was a no-op in production and every explore click re-paid for an
// AI call. The process-local memo stays as the hot path — one bulk read per
// process, then O(1) lookups — and degrades to an empty cache in local dev
// without a service account instead of throwing.

import { createHash } from "node:crypto";
import { getAdminDb, hasAdminCredentials } from "@/lib/firebaseAdmin";

const COLLECTION = "summary_cache";

// Re-summarize after this many days (freshness).
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

// Hard ceiling on retained entries.
const MAX_ENTRIES = 500;

interface SummaryEntry {
  url: string;
  normalizedUrl: string;
  summary: string;
  provider: string;
  title: string;
  orgName: string;
  createdAt: string;
}

type MemoState = { byKey: Map<string, SummaryEntry>; order: SummaryEntry[] };

let memo: MemoState | null = null;
let loadPromise: Promise<MemoState> | null = null;

/**
 * Saves are serialized through this chain.
 *
 * `saveSummary` is a read-modify-write against shared state. The batch
 * summarizer runs three workers concurrently, so without a queue two workers
 * could read the same base state and the second write would silently drop the
 * first one's entry.
 */
let writeQueue: Promise<void> = Promise.resolve();

/** Doc ids must match [A-Za-z0-9_-]{1,1500}; a URL cannot. Hash it. */
function docIdFor(normalizedUrl: string): string {
  return createHash("sha256").update(normalizedUrl).digest("hex");
}

async function loadFromFirestore(): Promise<MemoState> {
  const byKey = new Map<string, SummaryEntry>();
  const order: SummaryEntry[] = [];
  if (!hasAdminCredentials()) return { byKey, order };
  try {
    const snap = await getAdminDb()
      .collection(COLLECTION)
      .orderBy("createdAt", "desc")
      .limit(MAX_ENTRIES)
      .get();
    snap.forEach((d) => {
      const entry = d.data() as SummaryEntry;
      if (!entry || typeof entry.normalizedUrl !== "string") return;
      if (byKey.has(entry.normalizedUrl)) return;
      byKey.set(entry.normalizedUrl, entry);
      order.push(entry);
    });
  } catch (err) {
    // Fail soft: a cache miss costs one AI call, an exception would take the
    // whole summarize route down.
    console.warn(
      "[summaries-store] Firestore load failed, starting with an empty cache:",
      (err as Error)?.message
    );
  }
  return { byKey, order };
}

function ensureLoaded(): Promise<MemoState> {
  if (memo) return Promise.resolve(memo);
  if (!loadPromise) {
    loadPromise = loadFromFirestore().then((state) => {
      memo = state;
      return state;
    });
  }
  return loadPromise;
}

export function normalizeSummaryKey(url: string): string {
  return url.trim().replace(/\/+$/, "").toLowerCase();
}

/** Returns a fresh cached summary for the url, or null. */
export async function getCachedSummary(url: string): Promise<SummaryEntry | null> {
  const key = normalizeSummaryKey(url);
  const state = await ensureLoaded();
  const found = state.byKey.get(key);
  if (!found) return null;
  const createdAt = new Date(found.createdAt).getTime();
  // An unparseable timestamp means we cannot prove freshness, so treat the entry
  // as stale rather than serving it forever.
  if (Number.isNaN(createdAt) || Date.now() - createdAt > MAX_AGE_MS) return null;
  return found;
}

/** Saves/updates the cached summary for a url. */
export function saveSummary(
  url: string,
  entry: { summary: string; provider: string; title: string; orgName: string }
): Promise<void> {
  const normalizedUrl = normalizeSummaryKey(url);
  const record: SummaryEntry = {
    url,
    normalizedUrl,
    summary: entry.summary,
    provider: entry.provider,
    title: entry.title,
    orgName: entry.orgName,
    createdAt: new Date().toISOString(),
  };

  writeQueue = writeQueue.then(async () => {
    // Local dev without a service account: keep the request working, just
    // uncached, instead of throwing out of the summarize response.
    if (!hasAdminCredentials()) return;
    const state = await ensureLoaded();

    const previous = state.byKey.get(normalizedUrl);
    if (previous) {
      const at = state.order.indexOf(previous);
      if (at !== -1) state.order.splice(at, 1);
    }
    state.byKey.set(normalizedUrl, record);
    state.order.unshift(record);

    // Keep the memo and the collection bounded from the same source of truth.
    let trimmed: SummaryEntry[] = [];
    if (state.order.length > MAX_ENTRIES) {
      trimmed = state.order.splice(MAX_ENTRIES);
      const live = new Set(state.order.map((e) => e.normalizedUrl));
      for (const key of [...state.byKey.keys()]) {
        if (!live.has(key)) state.byKey.delete(key);
      }
    }

    try {
      const db = getAdminDb();
      await db.collection(COLLECTION).doc(docIdFor(normalizedUrl)).set(record);
      if (trimmed.length) {
        const batch = db.batch();
        for (const entry of trimmed) {
          batch.delete(db.collection(COLLECTION).doc(docIdFor(entry.normalizedUrl)));
        }
        await batch.commit();
      }
    } catch (err) {
      // The memo still serves this process; the durable copy will catch up on
      // the next successful save of the same url.
      console.warn("[summaries-store] Firestore write failed:", (err as Error)?.message);
    }
  });

  return writeQueue;
}

export async function getSummaryCount(): Promise<number> {
  return (await ensureLoaded()).order.length;
}

/**
 * Deletes the cached summary for a url (memo + Firestore).
 *
 * Called when the backing opportunity is pruned (expired or category-cap
 * overflow): a summary whose opportunity no longer exists is dead weight, and
 * the 500-entry cache ceiling should be spent on live listings instead.
 * Best-effort — a failed delete only leaves a stale entry, never breaks the
 * prune flow.
 */
export function deleteSummary(url: string): Promise<void> {
  const normalizedUrl = normalizeSummaryKey(url);

  writeQueue = writeQueue.then(async () => {
    if (!hasAdminCredentials()) return;
    const state = await ensureLoaded();

    const previous = state.byKey.get(normalizedUrl);
    if (!previous) return;
    const at = state.order.indexOf(previous);
    if (at !== -1) state.order.splice(at, 1);
    state.byKey.delete(normalizedUrl);

    try {
      await getAdminDb().collection(COLLECTION).doc(docIdFor(normalizedUrl)).delete();
    } catch (err) {
      console.warn("[summaries-store] Firestore delete failed:", (err as Error)?.message);
    }
  });

  return writeQueue;
}

/** Best-effort delete of many summaries; resolves once all deletes settle. */
export async function deleteSummaries(urls: string[]): Promise<void> {
  await Promise.all(urls.filter(Boolean).map((url) => deleteSummary(url)));
}

/** Resolves once every queued write has been persisted. */
export function flushSummaryWrites(): Promise<void> {
  return writeQueue;
}
