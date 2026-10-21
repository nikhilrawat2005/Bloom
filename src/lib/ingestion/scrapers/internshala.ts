// ─── Internshala — internships & jobs (cheerio, server-rendered HTML) ──
import { fetchText, loadCheerio, cleanText, absoluteUrl, parseDeadline } from "./utils";
import type { ScrapedOpportunity } from "./types";

const BASE = "https://internshala.com";

const PAGES = [
  { url: `${BASE}/internships`, category: "Internships" },
  { url: `${BASE}/internships/work-from-home-jobs`, category: "Internships" },
  { url: `${BASE}/jobs`, category: "Internships" },
];

export async function scrapeInternshala(): Promise<ScrapedOpportunity[]> {
  const out: ScrapedOpportunity[] = [];
  const seen = new Set<string>();

  for (const page of PAGES) {
    try {
      const html = await fetchText(page.url);
      const $ = loadCheerio(html);

      // Internshala cards: .individual_internship or .container-fluid .internship_meta
      const cards = $(".individual_internship, .internship_meta, [class*='internship-card']");
      const fallbackCards = cards.length > 0 ? cards : $("a[href*='/internship/detail/'], a[href*='/job/detail/']");

      fallbackCards.slice(0, 30).each((_, el) => {
        const $el = $(el);
        // If el is an <a>, treat it as the link wrapper; otherwise find link inside
        const isAnchor = $el.is("a");
        const $card = isAnchor ? $el : $el;
        const href = isAnchor ? $el.attr("href") || "" : $card.find("a").first().attr("href") || $el.attr("href") || "";

        // Title: .profile or heading
        let title = cleanText($card.find(".profile, h3, .heading_4_5, [class*='profile']").first().text());
        if (!title) title = cleanText($card.text().split("\n").find((s) => s.trim().length > 8) || "");
        if (!title || title.length < 5 || title.length > 180) return;
        const key = title.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);

        const link = href ? absoluteUrl(href, BASE) : page.url;
        const org = cleanText($card.find(".company_name, .company-name, [class*='company']").first().text()) || "Internshala Employer";
        const location = cleanText($card.find(".location, [class*='location']").first().text()) || "India";
        const stipend = cleanText($card.find(".stipend, [class*='stipend']").first().text());
        const duration = cleanText($card.find(".other_detail_item, [class*='duration']").first().text());
        const deadlineRaw = cleanText($card.find("[class*='deadline'], [class*='apply_by']").first().text());

        const descParts = [title, org !== "Internshala Employer" ? `at ${org}` : "", location ? `(${location})` : "", stipend ? `Stipend: ${stipend}.` : "", duration ? `Duration: ${duration}.` : ""]
          .filter(Boolean)
          .join(" ");

        out.push({
          title: `${title} — ${org !== "Internshala Employer" ? org : "Internship"}`.slice(0, 140),
          orgName: org,
          description: (descParts || `${title} internship opportunity via Internshala.`).slice(0, 300),
          eligibility: "Students and recent graduates in India — check Internshala for detailed eligibility.",
          deadline: parseDeadline(deadlineRaw),
          country: location.toLowerCase().includes("remote") || location.toLowerCase().includes("work from home") ? "Global" : "India",
          category: page.category,
          field: inferField(title),
          applyLink: link,
          requiredDocuments: ["Resume", "Cover Letter"],
          sourceUrl: link,
          sourceType: "scraped",
          autoApprove: false,
          scraperName: "Internshala",
        });
      });
    } catch (err: any) {
      console.warn(`[Scraper:Internshala] ${page.url} failed:`, err.message);
    }
  }

  return out.slice(0, 50);
}

function inferField(title: string): string {
  const t = title.toLowerCase();
  if (t.includes("software") || t.includes("developer") || t.includes("engineering") || t.includes("coding")) return "Computer Science";
  if (t.includes("data") || t.includes("machine learning") || t.includes("ai ")) return "Data Science";
  if (t.includes("design") || t.includes("ui") || t.includes("ux")) return "Design";
  if (t.includes("marketing") || t.includes("content") || t.includes("social media")) return "Marketing";
  if (t.includes("finance") || t.includes("account")) return "Finance";
  if (t.includes("research") || t.includes("science")) return "Research";
  return "General";
}
