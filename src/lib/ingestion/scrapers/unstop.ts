// ─── Unstop — hackathons / competitions / internships ──────────────────
// Unstop is heavily JS-rendered, so we use a hybrid approach:
//  1. Try to extract structured JSON-LD / __NEXT_DATA__ if present
//  2. Fallback to cheerio selectors for server-rendered parts
//  3. If both fail, return RawListing via stripHtml for AI normalization

import { fetchText, loadCheerio, cleanText, absoluteUrl, parseDeadline, asText, firstLineOf } from "./utils";
import type { ScrapedOpportunity } from "./types";

const BASE = "https://unstop.com";

const PAGES = [
  { url: `${BASE}/hackathons`, category: "Hackathons", field: "Computer Science" },
  { url: `${BASE}/internships`, category: "Internships", field: "General" },
  { url: `${BASE}/competitions`, category: "Conferences", field: "General" },
];

export async function scrapeUnstop(): Promise<ScrapedOpportunity[]> {
  const out: ScrapedOpportunity[] = [];

  for (const page of PAGES) {
    try {
      const html = await fetchText(page.url);
      const $ = loadCheerio(html);

      // Attempt 1: __NEXT_DATA__ JSON
      const nextDataRaw = $("#__NEXT_DATA__").html();
      if (nextDataRaw) {
        try {
          const parsed = JSON.parse(nextDataRaw);
          const opportunities = extractFromNextData(parsed, page);
          if (opportunities.length > 0) {
            out.push(...opportunities);
            continue;
          }
        } catch (err: any) {
          // An empty `catch {}` here is what let one malformed record erase a
          // whole page's results with no trace. Report and try the next route.
          console.warn(`[Scraper:Unstop] __NEXT_DATA__ parse failed on ${page.url}:`, err?.message ?? err);
        }
      }

      // Attempt 2: JSON-LD
      const jsonLdBlocks: any[] = [];
      $('script[type="application/ld+json"]').each((_, el) => {
        try {
          const j = JSON.parse($(el).html() || "");
          jsonLdBlocks.push(j);
        } catch (err: any) {
          console.warn(`[Scraper:Unstop] bad JSON-LD block on ${page.url}:`, err?.message ?? err);
        }
      });
      if (jsonLdBlocks.length > 0) {
        const fromLd = extractFromJsonLd(jsonLdBlocks, page);
        if (fromLd.length > 0) {
          out.push(...fromLd);
          continue;
        }
      }

      // Attempt 3: DOM selectors — Unstop cards typically use these patterns
      const cards = $(
        '[data-testid*="card"], .single_profile, .opportunity-card, a[href*="/o/"], a[href*="/p/"]'
      );
      if (cards.length > 0) {
        cards.slice(0, 30).each((_, el) => {
          const $el = $(el);
          const title = cleanText(
            $el.find("h3, h2, .title, [class*='title'], [class*='heading']").first().text() ||
              // No `.split("\n")[0]` here: Unstop ships minified HTML with zero
              // newlines, so that returned the entire card text (>5000 chars),
              // failed the length guard and silently dropped every card.
              firstLineOf($el.text())
          );
          if (!title || title.length < 5 || title.length > 180) return;
          const href = $el.attr("href") || $el.find("a").first().attr("href") || "";
          const link = href ? absoluteUrl(href, BASE) : page.url;
          const org = cleanText($el.find("[class*='org'], [class*='company'], .organisation").first().text()) || "Unstop";
          const deadlineRaw = cleanText($el.find("[class*='deadline'], [class*='date'], time").first().text());

          out.push({
            title,
            orgName: org || "Unstop",
            description: `${title} — opportunity hosted on Unstop. Visit the official page for full details and registration.`,
            eligibility: "Open to students and professionals — check eligibility on Unstop.",
            deadline: parseDeadline(deadlineRaw),
            country: "Global",
            category: page.category,
            field: page.field,
            applyLink: link,
            requiredDocuments: ["Resume"],
            sourceUrl: link,
            sourceType: "scraped",
            autoApprove: false,
            scraperName: "Unstop",
          });
        });
        if (out.length > 0) continue;
      }
    } catch (err: any) {
      console.warn(`[Scraper:Unstop] ${page.url} failed:`, err.message);
    }
  }

  // Deduplicate by title
  const seen = new Set<string>();
  return out.filter((o) => {
    const k = o.title.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, 60);
}

function extractFromNextData(data: any, page: { url: string; category: string; field: string }): ScrapedOpportunity[] {
  const out: ScrapedOpportunity[] = [];
  // Walk the object looking for arrays that look like opportunity lists
  const stack: any[] = [data];
  const visited = new Set<any>();
  while (stack.length) {
    const cur = stack.pop();
    if (!cur || typeof cur !== "object" || visited.has(cur)) continue;
    visited.add(cur);
    if (Array.isArray(cur)) {
      for (const item of cur) {
        if (item && typeof item === "object" && (item.title || item.name) && (item.url || item.slug || item.id)) {
          const title = cleanText(asText(item.title, 200) || asText(item.name, 200));
          if (title.length < 5 || title.length > 180) {
            if (typeof item === "object") stack.push(item);
            continue;
          }
          // `item.id` is numeric on Unstop, so `slug.startsWith` used to throw
          // a TypeError and abort the entire walk for this page.
          const slug = asText(item.slug, 500) || asText(item.url, 500) || String(item.id ?? "");
          const link = slug.startsWith("http") ? slug : `${BASE}/o/${slug}`;
          out.push({
            title,
            orgName: cleanText(
              asText(item.organisation_name, 180) ||
                asText(item.company, 180) ||
                asText(item.org, 180) ||
                "Unstop"
            ),
            description: cleanText(asText(item.description, 600) || asText(item.tagline, 600)).slice(0, 280) || `${title} on Unstop.`,
            eligibility: "Check Unstop for eligibility details.",
            deadline: parseDeadline(item.deadline || item.end_date || item.reg_end_date),
            country: "Global",
            category: page.category,
            field: page.field,
            applyLink: link,
            requiredDocuments: ["Resume"],
            sourceUrl: link,
            sourceType: "scraped",
            autoApprove: false,
            scraperName: "Unstop",
          });
          if (out.length >= 30) break;
        }
        if (typeof item === "object") stack.push(item);
      }
    } else {
      for (const v of Object.values(cur)) if (typeof v === "object" && v !== null) stack.push(v);
    }
    if (out.length >= 30) break;
  }
  return out;
}

function extractFromJsonLd(blocks: any[], page: { url: string; category: string; field: string }): ScrapedOpportunity[] {
  const out: ScrapedOpportunity[] = [];
  for (const b of blocks) {
    const arr = Array.isArray(b) ? b : [b];
    for (const item of arr) {
      if (!item || typeof item !== "object") continue;
      if (item["@type"] === "Event" || item["@type"] === "Course" || item.name) {
        const title = cleanText(asText(item.name, 200));
        if (!title || title.length < 5) continue;
        const url = asText(item.url, 500) || page.url;
        out.push({
          title,
          orgName: cleanText(
            asText(item.organizer?.name, 180) || asText(item.provider?.name, 180) || "Unstop"
          ),
          description: cleanText(asText(item.description, 600)).slice(0, 280) || `${title} on Unstop.`,
          eligibility: "Check Unstop for eligibility.",
          deadline: parseDeadline(item.endDate || item.startDate),
          country: cleanText(asText(item.location?.name, 120)) || "Global",
          category: page.category,
          field: page.field,
          applyLink: url,
          requiredDocuments: ["Resume"],
          sourceUrl: url,
          sourceType: "scraped",
          autoApprove: false,
          scraperName: "Unstop",
        });
      }
    }
  }
  return out;
}
