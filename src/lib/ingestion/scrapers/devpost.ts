// ─── Devpost — official hackathon API (trusted-feed) ───────────────────
import { fetchJson, parseDeadline, asText } from "./utils";
import type { ScrapedOpportunity } from "./types";

const ENDPOINTS = [
  "https://devpost.com/api/hackathons?status[]=open&order_by=recently-added&per_page=40",
  "https://devpost.com/api/hackathons?status[]=upcoming&order_by=recently-added&per_page=30",
  "https://devpost.com/api/hackathons?status[]=recent&order_by=recently-added&per_page=20",
];

export async function scrapeDevpost(): Promise<ScrapedOpportunity[]> {
  const out: ScrapedOpportunity[] = [];
  const seen = new Set<string>();

  for (const url of ENDPOINTS) {
    let hackathons: unknown[] = [];
    try {
      const data = await fetchJson(url);
      if (Array.isArray(data?.hackathons)) hackathons = data.hackathons;
    } catch (err: any) {
      console.warn(`[Scraper:Devpost] ${url} failed:`, err?.message ?? err);
      continue;
    }

    // One malformed record must not cost us the whole endpoint. Previously the
    // per-record mapping ran inside the endpoint's try, so a single non-string
    // field threw a TypeError and discarded all 40 rows in that batch — which
    // is why the shipped data file shows "Devpost": 0.
    for (const raw of hackathons) {
      const h = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

      const link = asText(h.url, 500) || asText(h.hackathon_url, 500);
      if (!link || seen.has(link)) continue;
      seen.add(link);

      const themes = Array.isArray(h.themes)
        ? h.themes
            .map((t: any) => asText(t, 80))
            .filter(Boolean)
            .join(", ")
        : asText(h.themes, 300);

      const prizeRaw = asText(h.prize_amount, 60);
      // Devpost returns prize_amount as HTML (e.g. "$<span data-currency-value>0</span>")
      // Strip all tags before using it in plain-text descriptions.
      const prizeAmount = prizeRaw.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      const prize = prizeAmount && prizeAmount !== "0" && prizeAmount !== "$0" ? `Prize pool: ${prizeAmount}` : "";
      const tagline = asText(h.tagline, 400);
      const description = asText(h.description, 4000);

      const location = h.displayed_location;
      let country = "Global";
      if (typeof location === "string") {
        country = location.includes("Online") ? "Global" : asText(location, 120) || "Global";
      } else if (location && typeof location === "object") {
        const loc = (location as Record<string, unknown>).location;
        country = asText(loc, 120) || "Global";
      }

      out.push({
        title: asText(h.title, 180) || "Untitled Hackathon",
        orgName: asText(h.organization_name, 180) || "Devpost",
        description:
          cleanDesc(tagline || description) ||
          `Hackathon on Devpost. ${themes ? `Themes: ${themes}. ` : ""}${prize}`.trim() ||
          "Join this hackathon on Devpost and build something amazing.",
        eligibility:
          asText(h.eligibility, 400) ||
          "Open to all students and developers — check official page for details.",
        deadline: parseDeadline(h.submission_period_dates),
        country,
        category: "Hackathons",
        field: themes.split(",")[0].trim() || "Computer Science",
        applyLink: link,
        requiredDocuments: ["Resume", "Project submission"],
        sourceUrl: link,
        sourceType: "trusted-feed",
        autoApprove: true,
        scraperName: "Devpost",
      });
    }
  }

  return out.slice(0, 60);
}

function cleanDesc(s: string): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length > 280) return t.slice(0, 277) + "...";
  return t;
}
