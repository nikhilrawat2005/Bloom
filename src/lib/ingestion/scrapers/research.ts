// ─── Research opportunities scraper / provider ───────────────────
import type { ScrapedOpportunity } from "./types";

const RESEARCH_SEEDS: Omit<ScrapedOpportunity, "sourceType" | "autoApprove" | "scraperName">[] = [
  {
    title: "IISER Pune Summer Student Research Fellowship",
    orgName: "IISER Pune",
    description: "Opportunity for undergraduate and master's students to participate in cutting-edge research across Biology, Chemistry, Physics, and Earth Sciences.",
    eligibility: "Students currently in 2nd/3rd year BSc or 1st year MSc in relevant basic science disciplines.",
    deadline: "2026-04-15",
    country: "India",
    category: "Research",
    field: "Sciences",
    applyLink: "https://www.iiserpune.ac.in",
    requiredDocuments: ["Resume", "Recommendation Letter", "Academic Transcripts", "Statement of Purpose"],
    sourceUrl: "https://www.iiserpune.ac.in",
  },
  {
    title: "IIT Delhi Summer Research Fellowship Programme (SRFP)",
    orgName: "IIT Delhi",
    description: "Prestigious summer fellowship allowing undergraduate and postgraduate students from other institutions to carry out innovative research with IIT Delhi faculty.",
    eligibility: "Top 10-20% rank holders in engineering, technology, sciences, or humanities at recognized universities.",
    deadline: "2026-03-31",
    country: "India",
    category: "Research",
    field: "Computer Science & Engineering",
    applyLink: "https://home.iitd.ac.in",
    requiredDocuments: ["Resume", "NOC from College", "Marksheets", "Project Proposal"],
    sourceUrl: "https://home.iitd.ac.in",
  },
  {
    title: "CSIR-UGC Junior Research Fellowship (JRF)",
    orgName: "Council of Scientific and Industrial Research",
    description: "National level fellowship for research in chemical, earth, life, mathematical, and physical sciences leading to PhD registration.",
    eligibility: "MSc or equivalent degree with minimum 55% marks, qualified through CSIR-UGC NET exam.",
    deadline: "2026-05-30",
    country: "India",
    category: "Research",
    field: "Sciences & Engineering",
    applyLink: "https://csirhrdg.res.in",
    requiredDocuments: ["NET Score Card", "Degree Certificate", "Caste/Category Certificate"],
    sourceUrl: "https://csirhrdg.res.in",
  },
  {
    title: "SERB-POWER Research Grant & Fellowship for Women",
    orgName: "Science and Engineering Research Board (DST)",
    description: "Promoting women researchers in STEM through dedicated research grants and fellowship funding across Indian institutions.",
    eligibility: "Indian women researchers holding regular academic/research positions or pursuing postdoctoral work.",
    deadline: "Rolling — check official site",
    country: "India",
    category: "Research",
    field: "STEM",
    applyLink: "https://serbonline.in",
    requiredDocuments: ["Research Proposal", "CV", "Institutional Endorsement"],
    sourceUrl: "https://serbonline.in",
  },
  {
    title: "DAAD Research Grants — One-Year and Short-Term Grants",
    orgName: "DAAD German Academic Exchange Service",
    description: "Grants primarily for doctoral candidates and young academics from across the globe to conduct research in Germany.",
    eligibility: "Graduates, doctoral candidates, and postdocs from accredited universities.",
    deadline: "2026-10-31",
    country: "Germany",
    category: "Research",
    field: "All Fields",
    applyLink: "https://www.daad.de",
    requiredDocuments: ["CV", "Research Proposal", "Host Acceptance Letter", "Two References"],
    sourceUrl: "https://www.daad.de",
  },
];

export async function scrapeResearch(): Promise<ScrapedOpportunity[]> {
  return RESEARCH_SEEDS.map((s) => ({
    ...s,
    sourceType: "trusted-feed",
    autoApprove: true,
    scraperName: "Research Feeds",
  }));
}
