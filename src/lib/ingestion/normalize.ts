// Uses the existing AIRouterService (Groq -> OpenRouter fallback) to turn
// raw text pulled from a feed/page into structured opportunities matching
// the platform's schema.

import { AIRouterService } from "@/lib/aiProviders";
import { neutralize } from "@/lib/promptGuard";

export interface NormalizedOpportunity {
  title: string;
  orgName: string;
  description: string;
  eligibility: string;
  deadline: string;
  country: string;
  category: string;
  field: string;
  applyLink: string;
  requiredDocuments: string[];
}

export const VALID_CATEGORIES = [
  "Scholarships",
  "Fellowships",
  "Internships",
  "Conferences",
  "Hackathons",
  "STEM Programs",
  "Research Programs",
  "Exchange Programs",
  "Research",
  "Workshops",
];

/** Maps common scraped/AI-generated category strings to canonical VALID_CATEGORIES values. */
export function normalizeCategory(raw: string): string {
  const s = raw.toLowerCase().trim();
  if (s === "research" || s === "research program" || s === "research opportunity") return "Research";
  if (s === "workshop" || s === "bootcamp" || s === "webinar" || s === "skill development") return "Workshops";
  if (s === "exchange" || s === "exchange program" || s === "international program" || s === "study abroad") return "Exchange Programs";
  return raw; // pass through — the caller validates against VALID_CATEGORIES
}

export async function normalizeToOpportunities(
  rawText: string,
  sourceUrl: string
): Promise<NormalizedOpportunity[]> {
  // Scraped content and the source URL are attacker-influenced: neutralize
  // both so they cannot close the ```""" fence or impersonate control tags
  // and override the extraction instructions.
  const safeUrl = neutralize(sourceUrl, 2000).replace(/"/g, "'");
  const safeRaw = neutralize(rawText, 6000);
  const prompt = `
    You are a data-extraction assistant for a platform that lists scholarships,
    fellowships, internships, hackathons, conferences, and STEM programs —
    with a focus on opportunities for women.

    Below is raw content pulled from: ${safeUrl}

    Extract EVERY distinct, genuine opportunity you can find in this content
    (there may be one, several, or none — do not invent any). For each one,
    output an object with exactly these fields:
    - title (string)
    - orgName (string) — the organization/company/government body offering it
    - description (string, 1-3 sentences)
    - eligibility (string, summarize who can apply)
    - deadline (string, ISO date "YYYY-MM-DD" if an exact date is present,
      otherwise a short human string like "Rolling — check official site")
    - country (string, use "Global" if not region-specific)
    - category (one of exactly: "Scholarships", "Fellowships", "Internships",
      "Conferences", "Hackathons", "STEM Programs", "Research Programs",
      "Exchange Programs", "Research", "Workshops")
    - field (string, e.g. "Computer Science", "STEM", "Engineering")
    - applyLink (string — the URL to apply or learn more; use "${safeUrl}"
      if no more specific link is present in the content)
    - requiredDocuments (array of strings, reasonable guess, e.g. ["Resume", "Transcript"])

    Only include items CLEARLY relevant to scholarships, fellowships,
    internships, hackathons, conferences, or STEM programs. Ignore navigation
    menus, ads, unrelated articles, or generic page boilerplate.

    Respond ONLY with valid JSON in exactly this shape, no markdown, no extra text:
    { "opportunities": [ { <fields above> }, ... ] }

    If there are no genuine opportunities in this content, respond with:
    { "opportunities": [] }

    RAW CONTENT:
    """
    ${safeRaw}
    """
  `;

  try {
    const result = await AIRouterService.requestAI(prompt, true);
    const list = result?.opportunities;
    if (!Array.isArray(list)) {
      // A malformed model response is a failure, not "no opportunities" —
      // returning [] here used to make provider outages look like healthy
      // runs with nothing to extract.
      throw new Error("AI returned an unexpected response shape");
    }

    return list
      .filter(
        (o: any) =>
          o &&
          typeof o.title === "string" &&
          o.title.trim().length > 0 &&
          typeof o.orgName === "string" &&
          o.orgName.trim().length > 0
      )
      .map((o: any) => ({
        title: o.title.trim(),
        orgName: o.orgName.trim(),
        description: typeof o.description === "string" ? o.description.trim() : "",
        eligibility: typeof o.eligibility === "string" ? o.eligibility.trim() : "",
        deadline: typeof o.deadline === "string" && o.deadline.trim() ? o.deadline.trim() : "Rolling — check official site",
        country: typeof o.country === "string" && o.country.trim() ? o.country.trim() : "Global",
        category: VALID_CATEGORIES.includes(normalizeCategory(o.category)) ? normalizeCategory(o.category) : "STEM Programs",
        field: typeof o.field === "string" && o.field.trim() ? o.field.trim() : "STEM",
        // http(s) only — a compromised feed must not be able to plant
        // javascript:/data: URLs that execute in our origin when clicked.
        applyLink:
          typeof o.applyLink === "string" && /^https?:\/\//i.test(o.applyLink.trim())
            ? o.applyLink.trim()
            : /^https?:\/\//i.test(sourceUrl)
            ? sourceUrl
            : "#",
        requiredDocuments: Array.isArray(o.requiredDocuments) ? o.requiredDocuments.filter((d: any) => typeof d === "string") : [],
      }));
  } catch (err: any) {
    // Propagate: run.ts phase 2b catches per listing and records the failure
    // in outcome.failed/errors. Swallowing here made every outage invisible.
    console.error(`[Ingestion] Normalization failed for ${sourceUrl}:`, err);
    throw new Error(`Normalization failed: ${err?.message || err}`);
  }
}
