// ─── Jobs & Internships via free public APIs (no auth needed) ─────────
// - Arbeitnow:  https://www.arbeitnow.com/api/job-board-api  (global jobs)
// - Remotive:   https://remotive.com/api/remote-jobs         (remote jobs)
// Both are auto-approved as trusted-feed.

import { fetchJson, asText, ROLLING_DEADLINE } from "./utils";
import type { ScrapedOpportunity } from "./types";

// Neither board publishes an application closing date. They publish when the
// posting was created. This file used to pass that posting date to
// parseDeadline(), producing a deadline in the past on the day it was scraped,
// so every job record was born expired and pruned before a user ever saw it —
// which is why the shipped data file claims 17 JobsAPIs records and contains
// zero. A job board posting has no deadline; say so rather than inventing one.
const NO_DEADLINE = ROLLING_DEADLINE;

export async function scrapeJobsApis(): Promise<ScrapedOpportunity[]> {
  const out: ScrapedOpportunity[] = [];

  // ── Arbeitnow ───────────────────────────────────────────────────────
  try {
    const data = await fetchJson("https://www.arbeitnow.com/api/job-board-api");
    const jobs: unknown[] = Array.isArray(data?.data) ? data.data : [];
    for (const raw of jobs.slice(0, 30)) {
      if (!raw || typeof raw !== "object") continue;
      const j = raw as Record<string, unknown>;
      const slug = asText(j.slug, 200);
      const link = slug ? `https://www.arbeitnow.com/view/${slug}` : "https://www.arbeitnow.com";
      const title = asText(j.title, 150);
      const description = asText(j.description, 4000) || title;
      const isInternship = /intern/i.test(title) || /intern/i.test(description);
      const tags = Array.isArray(j.tags) ? j.tags.map((t: any) => asText(t, 60)).join(" ") : "";
      out.push({
        title: title || "Job Opening",
        orgName: asText(j.company_name, 180) || "Arbeitnow Employer",
        description: stripDesc(description),
        eligibility: "Check official listing for eligibility and requirements.",
        deadline: NO_DEADLINE,
        country: asText(j.location, 120) || "Global",
        category: isInternship ? "Internships" : "Internships",
        field: inferField(`${title} ${tags}`),
        applyLink: link,
        requiredDocuments: ["Resume", "Cover Letter"],
        sourceUrl: link,
        sourceType: "trusted-feed",
        autoApprove: false, // still needs a quick human glance — external job board
        scraperName: "Arbeitnow",
      });
    }
  } catch (err: any) {
    console.warn("[Scraper:Arbeitnow] failed:", err?.message ?? err);
  }

  // ── Remotive (remote jobs — great for students wanting remote work) ─
  try {
    const data = await fetchJson("https://remotive.com/api/remote-jobs?limit=10");
    const jobs: unknown[] = Array.isArray(data?.jobs) ? data.jobs : [];
    for (const raw of jobs.slice(0, 30)) {
      if (!raw || typeof raw !== "object") continue;
      const j = raw as Record<string, unknown>;
      const title = asText(j.title, 150);
      const url = asText(j.url, 500);
      if (!title || !url) continue;
      const description = asText(j.description, 4000) || title;
      const tags = Array.isArray(j.tags) ? j.tags.map((t: any) => asText(t, 60)).join(" ") : "";
      const isInternship = /intern/i.test(title) || asText(j.job_type, 60).toLowerCase().includes("intern");
      out.push({
        title: title.slice(0, 140),
        orgName: asText(j.company_name, 180) || "Remotive Employer",
        description: stripDesc(description),
        eligibility: asText(j.candidate_required_location, 200) || "Remote — open globally, check listing.",
        deadline: NO_DEADLINE,
        country: "Global",
        category: isInternship ? "Internships" : "Internships",
        field: inferField(`${title} ${asText(j.category, 80)} ${tags}`),
        applyLink: url,
        requiredDocuments: ["Resume"],
        sourceUrl: url,
        sourceType: "trusted-feed",
        autoApprove: false,
        scraperName: "Remotive",
      });
    }
  } catch (err: any) {
    console.warn("[Scraper:Remotive] failed:", err?.message ?? err);
  }

  // Dedup by applyLink
  const seen = new Set<string>();
  return out.filter((o) => {
    if (seen.has(o.applyLink)) return false;
    seen.add(o.applyLink);
    return true;
  }).slice(0, 60);
}

function stripDesc(html: string): string {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (text.length > 300) return text.slice(0, 297) + "...";
  return text || "Job opportunity — check the official listing for full details.";
}

function inferField(text: string): string {
  const t = text.toLowerCase();
  if (/(software|developer|engineer|programming|coding|backend|frontend|full.?stack)/.test(t)) return "Computer Science";
  if (/(data|machine learning|ai|analytics|python|r)/.test(t)) return "Data Science";
  if (/(design|ui|ux|figma|creative)/.test(t)) return "Design";
  if (/(marketing|sales|content|seo|social)/.test(t)) return "Marketing";
  if (/(finance|accounting|analyst)/.test(t)) return "Finance";
  if (/(research|lab|science|phd)/.test(t)) return "Research";
  return "General";
}
