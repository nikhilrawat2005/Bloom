// Raw data fetchers for the automated ingestion pipeline.
//
// Two tiers:
// - "trusted-feed": official RSS/APIs (Grants.gov, Devpost, ioscholarships).
//   High confidence in the source itself, so listings extracted from these
//   are auto-approved (autoApprove: true).
// - "scraped": general web pages (AnitaB, SWE, AAUW, Outreachy). Parsing a
//   page's HTML with AI is less reliable than a structured feed, so these
//   always land as "pending" for a human to review (autoApprove: false).

export interface RawListing {
  rawText: string;
  sourceUrl: string;
  sourceType: "trusted-feed" | "scraped";
  autoApprove: boolean;
}

function decodeEntities(str: string): string {
  return str
    .replace(/<!\[CDATA\[/g, "")
    .replace(/\]\]>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripHtml(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
  ).trim();
}

const FETCH_TIMEOUT_MS = 12_000;
const MAX_FEED_BYTES = 3 * 1024 * 1024;

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "NexoraOpportunityBot/1.0 (+https://nexora.vercel.app)",
    },
    // Without a timeout one hung upstream stalls Promise.allSettled for the
    // whole run (allSettled waits on the hung promise) until the function dies.
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Fetch failed for ${url}: ${res.status}`);
  // Reject oversized bodies before/while buffering so one huge feed can't
  // exhaust function memory.
  const declared = Number(res.headers.get("content-length") || "0");
  if (declared > MAX_FEED_BYTES) throw new Error(`Feed too large (${declared} bytes): ${url}`);
  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_FEED_BYTES) throw new Error(`Feed too large: ${url}`);
  return new TextDecoder().decode(buf);
}

/** Parses <item>...</item> blocks out of a raw RSS/XML string. */
function parseRssItems(xml: string): { title: string; link: string; description: string }[] {
  const items: { title: string; link: string; description: string }[] = [];
  const itemBlocks = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
  for (const block of itemBlocks) {
    const title = (block.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || "").trim();
    const link = (block.match(/<link>([\s\S]*?)<\/link>/i)?.[1] || "").trim();
    const description = (block.match(/<description>([\s\S]*?)<\/description>/i)?.[1] || "").trim();
    items.push({
      title: decodeEntities(title),
      link: decodeEntities(link),
      description: stripHtml(decodeEntities(description)),
    });
  }
  return items;
}

// ─── TRUSTED (RSS / API) SOURCES — auto-approved ───────────────────────────

const TRUSTED_FEEDS = [
  { name: "Grants.gov", url: "https://grants.gov/rss/GG_NewOppByCategory.xml" },
  { name: "ioscholarships", url: "https://ioscholarships.com/feed" },
];

// Capped low per source per run to stay inside serverless function time
// limits (each item triggers one AI normalization call downstream).
const MAX_ITEMS_PER_FEED = 5;

async function fetchRssFeed(feedUrl: string): Promise<RawListing[]> {
  const xml = await fetchText(feedUrl);
  const items = parseRssItems(xml).slice(0, MAX_ITEMS_PER_FEED);
  return items.map((item) => ({
    rawText: `Title: ${item.title}\nLink: ${item.link}\nDescription: ${item.description}`,
    sourceUrl: item.link || feedUrl,
    sourceType: "trusted-feed" as const,
    autoApprove: true,
  }));
}

async function fetchDevpostHackathons(): Promise<RawListing[]> {
  const res = await fetch(
    "https://devpost.com/api/hackathons?status[]=open&order_by=recently-added",
    { headers: { "User-Agent": "NexoraOpportunityBot/1.0" } }
  );
  if (!res.ok) throw new Error(`Devpost API failed: ${res.status}`);
  const data = await res.json();
  const hackathons = (data?.hackathons || []).slice(0, MAX_ITEMS_PER_FEED);
  return hackathons.map((h: any) => ({
    rawText: [
      `Title: ${h.title}`,
      `URL: ${h.url}`,
      `Themes: ${(h.themes || []).map((t: any) => t.name).join(", ")}`,
      `Submission period: ${h.submission_period_dates}`,
      `Prize: ${h.prize_amount}`,
      `Open state: ${h.open_state}`,
    ].join("\n"),
    sourceUrl: h.url,
    sourceType: "trusted-feed" as const,
    autoApprove: true,
  }));
}

export async function fetchTrustedSources(): Promise<RawListing[]> {
  const results: RawListing[] = [];

  for (const feed of TRUSTED_FEEDS) {
    try {
      results.push(...(await fetchRssFeed(feed.url)));
    } catch (err) {
      console.warn(`[Ingestion] Trusted feed failed (${feed.name}):`, err);
    }
  }

  try {
    results.push(...(await fetchDevpostHackathons()));
  } catch (err) {
    console.warn("[Ingestion] Devpost API failed:", err);
  }

  return results;
}

// ─── SCRAPED SOURCES — auto-approved, no admin review needed ──────────────

const SCRAPED_PAGES = [
  // ── Global Student Tech Communities & Orgs ──
  // Dead source removed: IEEE Students (403).
  { name: "Major League Hacking (MLH)", url: "https://mlh.io/seasons/2026/events" },
  { name: "Google Summer of Code", url: "https://summerofcode.withgoogle.com/" },
  { name: "ACM Student Chapter", url: "https://www.acm.org/chapters/students" },

  // ── Hackathons & Competitions ──
  { name: "Devfolio", url: "https://devfolio.co/hackathons" },
  { name: "Unstop Competitions & Hackathons", url: "https://unstop.com/hackathons" },
  { name: "HackerEarth Challenges", url: "https://www.hackerearth.com/challenges/" },
  { name: "TechGig", url: "https://www.techgig.com/hackathon" },

  // ── Conference Discovery ──
  // Dead sources removed: 10times, All Conference Alert (403/timeouts).
  { name: "WikiCFP", url: "http://www.wikicfp.com/cfp/" },

  // ── International Student Fellowships & Research ──
  { name: "DAAD Scholarships", url: "https://www.daad.de/en/study-and-research-in-germany/scholarships/" },
  { name: "Mitacs Globalink Research Internship", url: "https://www.mitacs.ca/en/programs/globalink" },
  { name: "Pathways to Science", url: "https://www.pathwaystoscience.org/" },
  { name: "Outreachy", url: "https://www.outreachy.org/apply/" },
  { name: "CERN Student Programs", url: "https://careers.cern/students" },

  // ── Space / Aerospace & STEM Research ──
  { name: "NASA STEM Engagement", url: "https://www.nasa.gov/stem/" },
  { name: "ESA Education", url: "https://www.esa.int/Education" },
  { name: "Space Kidz India", url: "https://spacekidzindia.in/" },

  // ── Student Opportunity Aggregators ──
  { name: "Opportunity Desk", url: "https://opportunitydesk.org/" },
  { name: "Youth Opportunities", url: "https://www.youthop.com/" },
];

// A few sources from your list couldn't be added because the name was
// ambiguous / multiple similarly-named sites exist and I couldn't confirm
// the canonical URL: "Women for STEM India", "WiSTEM Global",
// "CII Women in STEM", "ScholarShare", "ScholrNet", "Girls in Aerospace
// Foundation", "Conference Alerts India", "Million Women Mentors".
// If you have the exact URLs for these, add them to SCRAPED_PAGES above in
// the same { name, url } format.

export async function fetchScrapedSources(): Promise<RawListing[]> {
  const settled = await Promise.allSettled(
    SCRAPED_PAGES.map(async (page) => {
      const html = await fetchText(page.url);
      const text = stripHtml(html);
      return {
        rawText: text,
        sourceUrl: page.url,
        sourceType: "scraped" as const,
        autoApprove: true,
      };
    })
  );

  const results: RawListing[] = [];
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") {
      results.push(r.value);
    } else {
      console.warn(`[Ingestion] Scraped source failed (${SCRAPED_PAGES[i].name}):`, r.reason?.message || r.reason);
    }
  });
  return results;
}
