// ─── Generic cheerio scrapers for remaining platforms ──────────────────
// These cover: MLH, Devfolio, HackerEarth, DAAD, NASA, and generic aggregators.
// They return RawListing-shaped data via direct ScrapedOpportunity where
// structure is known, otherwise minimal ScrapedOpportunity with AI-friendly text.

import { fetchText, loadCheerio, cleanText, absoluteUrl, parseDeadline, stripHtml, firstLineOf } from "./utils";
import type { ScrapedOpportunity } from "./types";
import type { RawListing } from "../sources";

interface PageConfig {
  name: string;
  url: string;
  category: string;
  field: string;
  cardSelector: string;
  titleSelector: string;
  linkSelector: string;
}

/**
 * True when a card's resolved link points back at the listing/category page
 * itself rather than a distinct per-item page.
 *
 * Loose card selectors (e.g. `a[href*='/hackathons/']`) match a listing page's
 * own navigation and hero links, and cards with no inner anchor used to fall
 * back to `page.url`. Emitting those produced many documents all sharing the
 * same category URL (e.g. 21 docs pointing at devfolio.co/hackathons), which
 * then collided in the capped feed. Such cards are skipped.
 */
export function isListingPageLink(link: string, pageUrl: string): boolean {
  const norm = (u: string) => u.trim().toLowerCase().replace(/\/+$/, "");
  const a = norm(link);
  const b = norm(pageUrl);
  if (!a) return true;
  if (a === b) return true;
  try {
    const la = new URL(a);
    const lb = new URL(b);
    // Same origin and identical path (ignoring trailing slash) => the listing page.
    return la.host === lb.host && norm(la.pathname) === norm(lb.pathname);
  } catch {
    return a === b;
  }
}

const GENERIC_PAGES: PageConfig[] = [
  {
    name: "MLH Events",
    url: "https://mlh.io/seasons/2026/events",
    category: "Hackathons",
    field: "Computer Science",
    cardSelector: ".event, [class*='event'], a[href*='/events/']",
    titleSelector: "h3, h2, .event-name, [class*='name']",
    linkSelector: "a",
  },
  {
    name: "Devfolio",
    url: "https://devfolio.co/hackathons",
    category: "Hackathons",
    field: "Computer Science",
    cardSelector: "[class*='hackathon'], [class*='card'], a[href*='/hackathons/']",
    titleSelector: "h3, h2, [class*='title'], [class*='name']",
    linkSelector: "a",
  },
  {
    name: "DAAD Scholarships",
    url: "https://www2.daad.de/deutschland/stipendium/datenbank/en/21148-scholarship-database/",
    category: "Scholarships",
    field: "General",
    cardSelector: "a[href*='stipendien'], .result, [class*='scholarship']",
    titleSelector: "h3, h2, [class*='title']",
    linkSelector: "a",
  },
  {
    name: "Opportunity Desk",
    url: "https://opportunitydesk.org/",
    category: "Scholarships",
    field: "General",
    cardSelector: "article, .post, [class*='card'], a[href*='/20']",
    titleSelector: "h2, h3, .entry-title, [class*='title']",
    linkSelector: "a",
  },
  {
    name: "Youth Opportunities",
    url: "https://www.youthop.com/",
    category: "Internships",
    field: "General",
    cardSelector: "article, .post, [class*='card']",
    titleSelector: "h2, h3, .entry-title",
    linkSelector: "a",
  },
];

export async function scrapeGenericPages(): Promise<ScrapedOpportunity[]> {
  const out: ScrapedOpportunity[] = [];

  for (const page of GENERIC_PAGES) {
    try {
      const html = await fetchText(page.url);
      const $ = loadCheerio(html);
      const cards = $(page.cardSelector);
      const seen = new Set<string>();

      if (cards.length === 0) {
        // No structured cards found — try to extract any <a> with meaningful text
        const links: { title: string; href: string }[] = [];
        $("a[href]").each((_, el) => {
          const t = cleanText($(el).text());
          const href = $(el).attr("href") || "";
          if (t.length >= 12 && t.length <= 160 && !t.toLowerCase().includes("read more") && !t.toLowerCase().includes("click here")) {
            if (!seen.has(t.toLowerCase())) {
              seen.add(t.toLowerCase());
              links.push({ title: t, href: absoluteUrl(href, page.url) });
            }
          }
        });
        for (const l of links.slice(0, 20)) {
          out.push({
            title: l.title.slice(0, 140),
            orgName: page.name,
            description: `${l.title} — opportunity from ${page.name}. Visit the official page for details.`.slice(0, 280),
            eligibility: "Check official site for eligibility.",
            deadline: "Rolling — check official site",
            country: "Global",
            category: page.category,
            field: page.field,
            applyLink: l.href,
            requiredDocuments: ["Resume"],
            sourceUrl: l.href,
            sourceType: "scraped",
            autoApprove: false,
            scraperName: page.name,
          });
        }
        continue;
      }

      cards.slice(0, 30).each((_, el) => {
        const $el = $(el);
        const title = cleanText($el.find(page.titleSelector).first().text() || firstLineOf($el.text()));
        if (!title || title.length < 10 || title.length > 160) return;
        const key = title.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        const href = $el.attr("href") || $el.find(page.linkSelector).first().attr("href") || "";
        const link = href ? absoluteUrl(href, page.url) : page.url;
        // Skip cards whose only resolvable link is the listing/category page
        // itself (no distinct per-item URL) — see isListingPageLink.
        if (isListingPageLink(link, page.url)) return;
        const deadlineRaw = cleanText($el.find("[class*='deadline'], [class*='date'], time").first().text());

        out.push({
          title: title.slice(0, 140),
          orgName: page.name,
          description: `${title} — opportunity from ${page.name}. Visit official page for full details.`.slice(0, 280),
          eligibility: "Check official site for eligibility.",
          deadline: parseDeadline(deadlineRaw),
          country: "Global",
          category: page.category,
          field: page.field,
          applyLink: link,
          requiredDocuments: ["Resume"],
          sourceUrl: link,
          sourceType: "scraped",
          autoApprove: false,
          scraperName: page.name,
        });
      });
    } catch (err: any) {
      console.warn(`[Scraper:Generic:${page.name}] failed:`, err.message);
    }
  }

  return out.slice(0, 60);
}

/** Fallback: for pages where we can't extract structured cards, return a RawListing for AI normalization */
export async function scrapeGenericAsRaw(urls: string[]): Promise<RawListing[]> {
  const raw: RawListing[] = [];
  for (const url of urls) {
    try {
      const html = await fetchText(url);
      const text = stripHtml(html).slice(0, 8000);
      if (text.length < 100) continue;
      raw.push({ rawText: text, sourceUrl: url, sourceType: "scraped", autoApprove: false });
    } catch (err: any) {
      console.warn(`[Scraper:GenericRaw] ${url} failed:`, err.message);
    }
  }
  return raw;
}
