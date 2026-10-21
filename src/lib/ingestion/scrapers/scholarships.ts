// ─── Scholarships & Fellowships scrapers ───────────────────────────────
import { fetchText, loadCheerio, cleanText, absoluteUrl, stripHtml, firstLineOf } from "./utils";
import type { ScrapedOpportunity } from "./types";

// RSS-based scholarship feeds (trusted — autoApprove logic handled by caller)
// Dead source removed: Scholarships.com RSS (timeout).
const RSS_FEEDS = [
  { name: "Grants.gov", url: "https://grants.gov/rss/GG_NewOppByCategory.xml" },
  { name: "ioscholarships", url: "https://ioscholarships.com/feed" },
];

function decodeEntities(str: string): string {
  return str.replace(/<!\[CDATA\[/g, "").replace(/\]\]>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#039;/g, "'");
}

function parseRssItems(xml: string) {
  const items: { title: string; link: string; description: string }[] = [];
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
  for (const block of blocks) {
    const title = (block.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || "").trim();
    const link = (block.match(/<link>([\s\S]*?)<\/link>/i)?.[1] || "").trim();
    const description = (block.match(/<description>([\s\S]*?)<\/description>/i)?.[1] || "").trim();
    items.push({ title: decodeEntities(title), link: decodeEntities(link), description: stripHtml(decodeEntities(description)) });
  }
  return items;
}

export async function scrapeScholarshipRss(): Promise<ScrapedOpportunity[]> {
  const out: ScrapedOpportunity[] = [];
  for (const feed of RSS_FEEDS) {
    try {
      const xml = await fetchText(feed.url);
      const items = parseRssItems(xml).slice(0, 30);
      for (const item of items) {
        if (!item.title) continue;
        const isScholarship = true; // all items from these feeds are scholarship/grant related
        out.push({
          title: item.title.slice(0, 140),
          orgName: feed.name,
          description: item.description.slice(0, 300) || `${item.title} — scholarship opportunity from ${feed.name}.`,
          eligibility: "Check official site for eligibility criteria.",
          deadline: "Rolling — check official site",
          country: "Global",
          category: isScholarship ? "Scholarships" : "Fellowships",
          field: "General",
          applyLink: item.link || feed.url,
          requiredDocuments: ["Transcript", "Resume"],
          sourceUrl: item.link || feed.url,
          sourceType: "trusted-feed",
          autoApprove: true,
          scraperName: feed.name,
        });
      }
    } catch (err: any) {
      console.warn(`[Scraper:ScholarshipRSS:${feed.name}] failed:`, err.message);
    }
  }
  return out;
}

// ── HTML-based scholarship aggregators (cheerio) ─────────────────────

const HTML_PAGES = [
  { url: "https://www.buddy4study.com/scholarships", name: "Buddy4Study" },
  { url: "https://scholarships.gov.in/", name: "National Scholarship Portal" },
  { url: "https://www.scholarshipsads.com/", name: "ScholarshipsAds" },
  { url: "https://www.opportunitydesk.org/category/scholarships/", name: "OpportunityDesk Scholarships" },
];

export async function scrapeScholarshipHtml(): Promise<ScrapedOpportunity[]> {
  const out: ScrapedOpportunity[] = [];
  for (const page of HTML_PAGES) {
    try {
      const html = await fetchText(page.url);
      const $ = loadCheerio(html);
      // Generic card selectors that work across multiple scholarship portals
      const cards = $("a[href*='scholarship'], .scholarship-card, .card, [class*='scholarship']");
      const seen = new Set<string>();
      cards.slice(0, 30).each((_, el) => {
        const $el = $(el);
        const title = cleanText($el.find("h3, h2, .title, [class*='title']").first().text() || firstLineOf($el.text()));
        if (!title || title.length < 10 || title.length > 180) return;
        const key = title.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        const href = $el.attr("href") || $el.find("a").first().attr("href") || "";
        const link = href ? absoluteUrl(href, page.url) : page.url;
        out.push({
          title: title.slice(0, 140),
          orgName: page.name,
          description: `${title} — scholarship opportunity from ${page.name}. Visit official site for eligibility and deadline.`.slice(0, 300),
          eligibility: "Students — check official site for eligibility.",
          deadline: "Rolling — check official site",
          country: "India",
          category: "Scholarships",
          field: "General",
          applyLink: link,
          requiredDocuments: ["Transcript", "ID Proof"],
          sourceUrl: link,
          sourceType: "scraped",
          autoApprove: false,
          scraperName: page.name,
        });
      });
    } catch (err: any) {
      console.warn(`[Scraper:ScholarshipHTML:${page.name}] failed:`, err.message);
    }
  }
  return out;
}
