import { NextResponse } from "next/server";
import { AIRouterService } from "@/lib/aiProviders";
import { getCachedSummary, saveSummary } from "@/lib/storage/summariesStore";
import { requireUser } from "@/lib/serverAuth";
import { enforceRateLimit, LIMITS } from "@/lib/rateLimit";
import { validateOutboundUrlDeep } from "@/lib/urlGuard";
import { neutralize } from "@/lib/promptGuard";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const MAX_PAGE_BYTES = 3 * 1024 * 1024;

/**
 * Buffers a fetched page with guards: refuses non-text content types and
 * rejects oversized bodies BEFORE arrayBuffer() materializes them, so a fast
 * multi-GB response can't exhaust function memory.
 */
async function readPageBody(res: Response): Promise<ArrayBuffer> {
  const contentType = res.headers.get("content-type") || "";
  if (contentType && !/text\/html|text\/plain|application\/xhtml\+xml|application\/xml|text\/xml/i.test(contentType)) {
    throw new Error(`Unsupported content-type: ${contentType.split(";")[0]}`);
  }
  const declared = Number(res.headers.get("content-length") || "0");
  if (declared > MAX_PAGE_BYTES) throw new Error("Page exceeds size limit");
  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_PAGE_BYTES) throw new Error("Page exceeds size limit");
  return buf;
}

/** Neutralize a metadata value and escape quotes for `Key="..."` prompt contexts. */
function q(value: string): string {
  return neutralize(value, 500).replace(/"/g, "'");
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#8217;|&#8216;/g, "'")
    .replace(/&#8212;|&#8211;/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

// Charset-aware HTML decoding: honors the header charset, falls back to utf-8,
// and retries latin1 when utf-8 produces replacement chars (kills mojibake).
function decodeBody(buf: ArrayBuffer, contentType: string): string {
  const charsetMatch = contentType.match(/charset=([\w-]+)/i);
  const declared = charsetMatch ? charsetMatch[1].toLowerCase() : "";
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(buf);
  if (declared && declared !== "utf-8" && declared !== "utf8") {
    try {
      return new TextDecoder(declared as any).decode(buf);
    } catch {
      return utf8.includes("\uFFFD") ? new TextDecoder("latin1").decode(buf) : utf8;
    }
  }
  if (!utf8.includes("\uFFFD")) return utf8;
  return new TextDecoder("latin1").decode(buf);
}

// Split filtered text down to meaningful lines (no nav/ad boilerplate).
function cleanSnippets(text: string, max = 6): string[] {
  const out: string[] = [];
  for (const line of text.split(/(?:\.|!|\?)\s+/)) {
    const t = line.trim();
    if (t.length < 25 || t.length > 220) continue;
    if (/\b(menu|login|sign in|sign up|subscribe|newsletter|cookie|privacy|terms|©|copyright)\b/i.test(t)) continue;
    if (/^[\s\d\W]+$/.test(t)) continue;
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

function buildFallback(args: {
  title: string;
  orgName: string;
  url: string;
  category: string;
  deadline: string;
  country: string;
  field: string;
  eligibility: string;
  snippets: string[];
  reason: string;
}): string {
  const { title, orgName, url, category, deadline, country, field, eligibility, snippets, reason } = args;
  const notable = snippets.slice(0, 5).map((s) => `- ${s}`).join("\n");
  const cat = category && category !== "General" ? category : "opportunity";
  const lines: string[] = [];
  lines.push(`## Quick Summary`);
  lines.push(`${title} is a ${cat}${orgName ? ` by ${orgName}` : ""}. Here is everything we could verify from the listing${country ? ` (${country})` : ""}.`);
  lines.push("");
  lines.push(`## What it's about`);
  lines.push(notable || `- ${title} — check the official page for the full program description.`);
  lines.push("");
  lines.push(`## Who can apply`);
  const el = (eligibility || "").replace(/^Check official/i, "");
  lines.push(`- ${eligibility && eligibility.trim().length > 3 ? eligibility : `Open to eligible students/professionals — full criteria on the official page.`}${el && !/official/i.test(el) ? "" : ""}`);
  lines.push("");
  lines.push(`## Important Dates & Location`);
  lines.push(`- Deadline: ${deadline || "Check official page"}`);
  lines.push(`- Location: ${country || "Check official page"}`);
  lines.push(`- Field: ${field || "General"}`);
  lines.push("");
  lines.push(`## How to Apply`);
  lines.push(`1. Open the official link below`);
  lines.push(`2. Read eligibility, deadline and required documents`);
  lines.push(`3. Complete the application form`);
  lines.push(`4. Submit before the deadline and save your confirmation`);
  lines.push("");
  lines.push(`## Main Facts`);
  lines.push(`- Title: ${title}`);
  if (orgName) lines.push(`- Organization: ${orgName}`);
  if (category) lines.push(`- Category: ${category}`);
  lines.push(`- Deadline: ${deadline || "Check official page"}`);
  if (field && field !== "General") lines.push(`- Field: ${field}`);
  lines.push(`- Apply at: ${url}`);
  lines.push("");
  lines.push(`_Auto-generated summary (AI offline: ${reason.slice(0, 90)}). Click the source link for full original details._`);
  return lines.join("\n");
}

export async function POST(request: Request) {
  // Paid LLM + server-side fetch of a caller-supplied URL. Requires a verified
  // Firebase session; previously this was fully open (SSRF + free LLM for anyone).
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const limited = enforceRateLimit(request, { ...LIMITS.summarize, uid: auth.user.uid });
  if (!limited.ok) return limited.response;

  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "A JSON object body is required" }, { status: 400 });
    }

    const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
    const url = str(body.url) || str(body.sourceUrl);
    const title = str(body.title);
    const orgName = str(body.orgName) || str(body.organization);
    const category = str(body.category);
    const deadline = str(body.deadline);
    const country = str(body.country);
    const field = str(body.field);
    const eligibility = str(body.eligibility);

    // SSRF guard: rejects loopback / RFC1918 / link-local (cloud metadata) /
    // CGNAT / IPv6-local targets, non-http(s) schemes and embedded credentials.
    // Deep variant also resolves DNS and rejects names pointing at private IPs.
    const checked = await validateOutboundUrlDeep(url);
    if (!checked.ok) {
      return NextResponse.json({ error: checked.reason }, { status: 400 });
    }
    const safeUrl = checked.url.toString();

    // 1. Serve cache instantly (repeat clicks: no re-scrape / no AI cost)
    const cached = await getCachedSummary(safeUrl);
    if (cached) {
      return NextResponse.json({
        success: true,
        url: safeUrl,
        title: cached.title || title,
        orgName: cached.orgName || orgName,
        summary: cached.summary,
        provider: cached.provider + "-cached",
        cached: true,
      });
    }

    // 2. Fetch full page (with charset-aware decode to avoid mojibake)
    let text = "";
    try {
      const res = await fetch(safeUrl, {
        headers: {
          "User-Agent": "NexoraOpportunityBot/1.0 (+https://nexora.vercel.app)",
          Accept: "text/html,application/xhtml+xml",
        },
        signal: AbortSignal.timeout(15000),
        // Manual redirect handling: an open redirect on an allowed host would
        // otherwise walk straight past the host validation above.
        redirect: "manual",
      });
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        const followed = location
          ? await validateOutboundUrlDeep(new URL(location, safeUrl).toString())
          : null;
        if (!followed?.ok) {
          throw new Error("Blocked cross-origin redirect");
        }
        const followRes = await fetch(followed.url, {
          headers: {
            "User-Agent": "NexoraOpportunityBot/1.0 (+https://nexora.vercel.app)",
            Accept: "text/html,application/xhtml+xml",
          },
          signal: AbortSignal.timeout(15000),
          redirect: "error",
        });
        if (!followRes.ok) throw new Error(`Fetch failed ${followRes.status}`);
        const followBuf = await readPageBody(followRes);
        text = stripHtml(decodeBody(followBuf, followRes.headers.get("content-type") || ""));
      } else {
        if (!res.ok) throw new Error(`Fetch failed ${res.status}`);
        const buf = await readPageBody(res);
        const contentType = res.headers.get("content-type") || "";
        text = stripHtml(decodeBody(buf, contentType));
      }
    } catch {
      text = "";
    }

    // Neutralized: scraped page content must not be able to close the ```"""
    // fence or impersonate control tags and rewrite the instructions.
    const raw = neutralize(text, 12000);
    const snippets = cleanSnippets(text);

    // 3. Try AI
    try {
      if (raw.length >= 60) {
        const prompt = `You are NEXORA's opportunity explainer. Summarize the opportunity page below into a proper easy-to-understand format so any student can understand what is happening.

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

If any info is not found on the page, write "Check official page" rather than guessing. Keep total under 450 words.

Context (card info): Title="${q(title)}" Organization="${q(orgName)}" Category="${q(category)}" Deadline="${q(deadline)}" Country="${q(country)}" Field="${q(field)}" Eligibility="${q(eligibility)}" URL="${safeUrl}"

FULL PAGE TEXT:
"""
${raw}
"""`;

        const summary = await AIRouterService.requestAI(prompt, false);
        const summaryText = typeof summary === "string" ? summary : JSON.stringify(summary);
        if (summaryText && summaryText.trim().length > 50) {
          // Awaited: on a frozen serverless instance an un-awaited write can
          // be lost, forcing the next visitor to pay for the same AI call.
          await saveSummary(safeUrl, { summary: summaryText, provider: "ai-router", title, orgName });
          return NextResponse.json({
            success: true,
            url: safeUrl,
            title,
            orgName,
            summary: summaryText,
            sourceLength: raw.length,
            provider: "ai-router",
          });
        }
        throw new Error("Empty AI output");
      }
      throw new Error("Page content too short for AI");
    } catch (aiErr: any) {
      // 4. Smart fallback from card metadata + clean snippets (never raw dump).
      // NOTE: this is deliberately NOT persisted — a transient provider outage must
      // not write a metadata template into the 30-day cache and suppress the real
      // summary for every later visitor.
      console.warn("[summarize] AI failed, using metadata fallback:", aiErr.message);
      const fallback = buildFallback({ title, orgName, url: safeUrl, category, deadline, country, field, eligibility, snippets, reason: aiErr.message || "offline" });
      return NextResponse.json({
        success: true,
        url: safeUrl,
        title,
        orgName,
        summary: fallback,
        sourceLength: raw.length,
        provider: "fallback-metadata",
        warning: "AI provider unavailable — showing a metadata-derived summary. Try again shortly.",
      });
    }
  } catch (err: any) {
    console.error("[summarize] Fatal:", err);
    return NextResponse.json({ error: err.message || "Summarize failed" }, { status: 500 });
  }
}

// The GET variant was removed deliberately. It let any web page trigger a
// paid LLM call and a server-side fetch of an arbitrary URL just by loading
// <img src="/api/summarize?url=http://169.254.169.254/...">. Use POST with an
// Authorization header.
export async function GET() {
  return NextResponse.json(
    { error: "Use POST with a valid Authorization header." },
    { status: 405, headers: { Allow: "POST" } }
  );
}
