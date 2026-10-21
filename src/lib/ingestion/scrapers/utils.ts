// ─── Shared scraper utilities ──────────────────────────────────────────
import * as cheerio from "cheerio";

const BOT_UA =
  "NexoraOpportunityBot/1.0 (+https://nexora.vercel.app; contact: support@nexora.app)";
const FETCH_TIMEOUT_MS = 12000;

/** Decode bytes using charset from content-type; fallback latin1 if UTF-8 looks broken */
function decodeBody(buf: ArrayBuffer, contentType: string | null): string {
  const charset = (contentType || "").match(/charset=([\w-]+)/i)?.[1];
  if (charset && !/utf-?8/i.test(charset)) {
    try {
      const text = new TextDecoder(charset).decode(buf);
      if (!text.includes("\uFFFD")) return text;
    } catch {}
  }
  const utf8 = new TextDecoder("utf-8").decode(buf);
  if (!utf8.includes("\uFFFD")) return utf8;
  // Broken UTF-8 (mojibake like "A��,��??") → the page is likely latin-1/windows-1252
  try {
    const latin = new TextDecoder("latin1").decode(buf);
    if (!latin.includes("\uFFFD")) return latin;
  } catch {}
  return utf8;
}

/** Fetch with timeout + bot UA + retry once + correct charset decoding */
export async function fetchText(url: string, retries = 1): Promise<string> {
  const attempt = async (): Promise<string> => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": BOT_UA,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
        signal: ctrl.signal,
        next: { revalidate: 0 } as any,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      const buf = await res.arrayBuffer();
      return decodeBody(buf, res.headers.get("content-type"));
    } finally {
      clearTimeout(t);
    }
  };

  try {
    return await attempt();
  } catch (e: any) {
    if (retries > 0) {
      await new Promise((r) => setTimeout(r, 800));
      return attempt();
    }
    throw e;
  }
}

export async function fetchJson(url: string): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": BOT_UA, Accept: "application/json" },
      signal: ctrl.signal,
      next: { revalidate: 0 } as any,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

export function loadCheerio(html: string) {
  return cheerio.load(html);
}

/**
 * Sentinel deadline for listings with no machine-readable closing date.
 *
 * Every consumer must treat this as "unknown", never as a date. Keeping it as
 * one shared constant is what lets `isExpired()` and the Firestore prune reason
 * about it instead of guessing.
 */
export const ROLLING_DEADLINE = "Rolling \u2014 check official site";

/**
 * Coerce an untrusted third-party API field to a trimmed string.
 *
 * Feeds do not honour their own schema. Devpost returns `organization_name` as
 * an object; Unstop returns numeric ids; a single `.trim()` on any of those
 * throws a TypeError that unwinds the whole endpoint's `try`, so every record
 * from that endpoint is silently discarded. Every scraper must funnel external
 * values through here before touching a string method.
 */
export function asText(value: unknown, max = 4000): string {
  if (typeof value === "string") return value.trim().slice(0, max);
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return String(value);
  if (value && typeof value === "object") {
    // Common shape: { name }, { title }, { display_name }, { location }.
    const rec = value as Record<string, unknown>;
    for (const key of ["name", "title", "display_name", "displayName", "label", "location"]) {
      const nested = rec[key];
      if (typeof nested === "string" && nested.trim()) return nested.trim().slice(0, max);
    }
    return "";
  }
  return "";
}

export function cleanText(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Best-effort short title from untrusted card text, when no title element matched.
 *
 * The previous `$el.text().split("\n")[0]` was a guaranteed no-op on minified
 * HTML — Unstop, 10times and every React/Next-rendered target ship zero
 * newlines — so `[0]` returned the *entire* element text, often >5000 chars,
 * which then failed the `title.length > 180` guard and the card was silently
 * dropped. That was the second reason "Unstop: 0".
 *
 * Tries a newline split first (works when the markup is pretty-printed), then
 * falls back to a sentence/clause boundary so minified markup still yields a
 * plausible short title.
 */
export function firstLineOf(raw: string, max = 180): string {
  const text = cleanText(raw || "");
  if (!text) return "";
  const byNewline = text.split(/\r?\n/)[0]?.trim();
  if (byNewline && byNewline.length <= max) return byNewline;
  const byClause = text.split(/(?<=[.!?|])\s+|\s+[|\u2013\u2014-]\s+/)[0] ?? text;
  return byClause.length <= max ? byClause : text.slice(0, max);
}

export function decodeEntities(str: string): string {
  return str
    .replace(/<!\[CDATA\[/g, "")
    .replace(/\]\]>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#039;/g, "'");
}

export function stripHtml(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
  ).trim();
}

export function absoluteUrl(href: string, base: string): string {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

/**
 * Extract a closing date as `YYYY-MM-DD`, or `ROLLING_DEADLINE`.
 *
 * This used to fall through to `return trimmed`, accepting any short string as
 * the deadline. That is why 0 of the 219 shipped records carried a parseable
 * date and `pruneExpiredFromFirestore` was a no-op on 100% of the dataset: the
 * expiry path silently skipped everything. A field that is either an ISO date
 * or the sentinel is strictly more useful than one that is usually prose.
 *
 * Rejects anything outside [minYear, maxYear] so a page printing a 1998
 * copyright footer cannot pin every listing to an already-expired year.
 */
export function parseDeadline(raw?: unknown, minYear = 2024, maxYear = 2030): string {
  const text = asText(raw, 200);
  if (!text) return ROLLING_DEADLINE;

  const inRange = (d: Date) =>
    !isNaN(d.getTime()) && d.getUTCFullYear() >= minYear && d.getUTCFullYear() <= maxYear;

  // Full ISO / RFC date, with or without a time component.
  const direct = new Date(text);
  if (inRange(direct)) return direct.toISOString().slice(0, 10);

  // "Submit by 2026-03-04", "Deadline: 04/03/2026", "Mar 4, 2026" — pull the
  // first date-like token out of the prose instead of rejecting the whole line.
  const iso = text.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (iso) {
    const d = new Date(`${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}T00:00:00Z`);
    if (inRange(d)) return d.toISOString().slice(0, 10);
  }

  const slash = text.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/);
  if (slash) {
    // Ambiguous D/M vs M/D: a value > 12 in the first position can only be a
    // day, so treat it as day-first; otherwise fall back to month-first, which
    // is the convention on every source this project scrapes.
    let dd = Number(slash[1]);
    let mm = Number(slash[2]);
    if (dd > 12 && mm <= 12) {
      /* already day-first */
    } else if (mm > 12 && dd <= 12) {
      [dd, mm] = [mm, dd];
    }
    const d = new Date(Date.UTC(Number(slash[3]), mm - 1, dd));
    if (inRange(d)) return d.toISOString().slice(0, 10);
  }

  const monthName = text.match(
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})/i
  );
  if (monthName) {
    const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    const mm = months.indexOf(monthName[1].slice(0, 3).toLowerCase());
    const d = new Date(Date.UTC(Number(monthName[3]), mm, Number(monthName[2])));
    if (inRange(d)) return d.toISOString().slice(0, 10);
  }

  return ROLLING_DEADLINE;
}
