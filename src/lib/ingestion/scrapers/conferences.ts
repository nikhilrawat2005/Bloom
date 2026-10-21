// ─── Conferences scraper ─────────────────────────────────────────────
// Aggregates conferences from multiple sources (cheerio + RSS)
// Sources are scraped WITHOUT pre-filtering — all entries are returned
// and the user filters client-side (category-wise)

import { fetchText, loadCheerio, cleanText, absoluteUrl, parseDeadline, firstLineOf } from "./utils";
import { isListingPageLink } from "./generic";
import type { ScrapedOpportunity } from "./types";

interface ConfPage {
  name: string;
  url: string;
  category: "Conferences" | "Fellowships";
}

// Dead sources removed (403/404/timeouts): AllConferenceAlert RSS + HTML,
// 10times RSS + Technology, IEEE Conferences, OpportunityDesk category/conferences,
// YouthOp /conferences. Keeping only sources that responded live in testing.
const HTML_PAGES: ConfPage[] = [
  { name: "WikiCFP", url: "http://www.wikicfp.com/cfp/", category: "Conferences" },
  { name: "ConferenceAlerts", url: "https://conferencealerts.com/", category: "Conferences" },
];

export async function scrapeConferences(): Promise<ScrapedOpportunity[]> {
  const out: ScrapedOpportunity[] = [];

  // ── HTML pages (cheerio) ──
  for (const page of HTML_PAGES) {
    try {
      const html = await fetchText(page.url);
      const $ = loadCheerio(html);
      const seen = new Set<string>();

      // Try generic article/card selectors
      const cards = $("article, .card, [class*='card'], .event, [class*='event'], .conference-card, a[href*='/conference'], a[href*='/event']");
      // If nothing, fallback to all links with meaningful text
      if (cards.length === 0) {
        const links: { title: string; href: string }[] = [];
        $("a[href]").each((_, el) => {
          const t = cleanText($(el).text());
          const href = $(el).attr("href") || "";
          if (t.length >= 12 && t.length <= 160 && !/read more|click here|view all/i.test(t)) {
            const key = t.toLowerCase();
            if (!seen.has(key)) {
              seen.add(key);
              links.push({ title: t, href: absoluteUrl(href, page.url) });
            }
          }
        });
        for (const l of links.slice(0, 20)) {
          out.push({
            title: l.title.slice(0, 140),
            orgName: page.name,
            description: `${l.title} — conference from ${page.name}. Check official site for dates and CFP deadline.`.slice(0, 300),
            eligibility: "Researchers, students, professionals — check official site.",
            deadline: "Rolling — check official site",
            country: "Global",
            category: page.category,
            field: "General",
            applyLink: l.href,
            requiredDocuments: ["Abstract"],
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
        const title = cleanText($el.find("h2, h3, .title, [class*='title'], .entry-title").first().text() || firstLineOf($el.text()));
        if (!title || title.length < 10 || title.length > 180) return;
        const key = title.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        const href = $el.attr("href") || $el.find("a").first().attr("href") || "";
        const link = href ? absoluteUrl(href, page.url) : page.url;
        if (isListingPageLink(link, page.url)) return;
        const deadlineRaw = cleanText($el.find("[class*='deadline'], [class*='date'], time, [class*='cfp']").first().text());
        out.push({
          title: title.slice(0, 140),
          orgName: page.name,
          description: `${title} — conference from ${page.name}. Visit official page for CFP, dates and registration.`.slice(0, 300),
          eligibility: "Open to researchers and students — check official site.",
          deadline: parseDeadline(deadlineRaw),
          country: "Global",
          category: page.category,
          field: "General",
          applyLink: link,
          requiredDocuments: ["Abstract"],
          sourceUrl: link,
          sourceType: "scraped",
          autoApprove: false,
          scraperName: page.name,
        });
      });
    } catch (err: any) {
      console.warn(`[Scraper:Conference:${page.name}] failed:`, err.message);
    }
  }

  // dedup by title
  const seen = new Set<string>();
  const deduped = out.filter((o) => {
    const k = o.title.toLowerCase().trim();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return deduped.slice(0, 60);
}
