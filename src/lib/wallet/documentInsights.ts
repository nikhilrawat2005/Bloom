import type { DocumentInsights, WalletCategory } from "@/lib/types";

/**
 * Turns a document's raw text into structured facts.
 *
 * The performance engine never re-reads the PDF/Word file — it works purely off
 * these insights, which is why they get persisted alongside the document. More
 * documents in the wallet means more facts, which means a more accurate score.
 *
 * Pure and dependency-free so it can run on the client (at upload time) and on
 * the server (when recomputing a snapshot).
 */

const MAX_TEXT = 8000;

const TECH_LIST = [
  "python", "java", "javascript", "typescript", "c++", "c#", "go", "rust", "ruby", "php", "swift", "kotlin", "scala", "r", "matlab",
  "react", "reactjs", "react native", "next.js", "nextjs", "vue", "angular", "svelte", "node.js", "nodejs", "express", "django", "flask", "fastapi", "spring boot", "rails",
  "html", "css", "sass", "tailwind", "bootstrap",
  "sql", "mysql", "postgresql", "mongodb", "firebase", "firestore", "redis", "elasticsearch",
  "aws", "azure", "gcp", "google cloud", "docker", "kubernetes", "terraform", "cicd", "jenkins", "linux", "git", "github",
  "machine learning", "deep learning", "tensorflow", "pytorch", "keras", "opencv", "nlp", "llm", "generative ai", "data science", "pandas", "numpy", "tableau", "power bi",
  "android", "ios", "flutter", "blockchain", "iot", "cybersecurity", "cloud computing", "devops", "graphql", "rest api", "microservices",
];

const SKILL_HINTS = [
  "problem solving", "teamwork", "team work", "communication", "leadership", "critical thinking", "time management",
  "public speaking", "presentation", "research", "analytical", "attention to detail", "adaptability", "collaboration",
  "project management", "data analysis", "networking", "event management", "documentation", "report writing",
];

const LANG_LIST = [
  "english", "hindi", "french", "german", "spanish", "chinese", "mandarin", "japanese", "korean", "arabic",
  "portuguese", "russian", "italian", "punjabi", "tamil", "telugu", "bengali", "marathi", "gujarati", "kannada", "malayalam",
];

const MONTH_INDEX: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

const STOPWORDS = new Set([
  "the", "and", "for", "with", "this", "that", "from", "your", "our", "has", "have", "was", "were", "are", "been", "will", "shall",
  "name", "date", "page", "certify", "certificate", "award", "issued", "issuedby", "ref", "no", "number", "sri", "shri", "ms",
  "mrs", "dr", "prof", "dear", "regards", "sincerely", "signature", "seal", "stamp", "board", "university", "college", "school",
  "semester", "subject", "code", "credits", "grade", "total", "marks", "obtained", "grade", "pass", "fail", "attendance",
]);

const DEGREES: [RegExp, string][] = [
  [/\b(b\.?\s?tech|bachelor of technology|btech)\s*(?:in)?\s*([a-z& ]{3,40})/i, "B.Tech"],
  [/\b(b\.?\s?e|bachelor of engineering)\s*(?:in)?\s*([a-z& ]{3,40})/i, "B.E."],
  [/\b(m\.?\s?tech|master of technology)\s*(?:in)?\s*([a-z& ]{3,40})/i, "M.Tech"],
  [/\b(mca|master of computer applications)\b/i, "MCA"],
  [/\b(bca|bachelor of computer applications)\b/i, "BCA"],
  [/\b(mba|master of business administration)\b/i, "MBA"],
  [/\b(b\.?\s?sc|bachelor of science)\s*(?:in)?\s*([a-z& ]{3,40})/i, "B.Sc"],
  [/\b(m\.?\s?sc|master of science)\s*(?:in)?\s*([a-z& ]{3,40})/i, "M.Sc"],
  [/\b(b\.?\s?com|bachelor of commerce)\b/i, "B.Com"],
  [/\b(class\s*(?:10|ten|x|12|twelve)|xii|ssc|hsc|secondary school certificate|higher secondary)\b/i, "Secondary"],
  [/\b(diploma)\s*(?:in)?\s*([a-z& ]{3,40})/i, "Diploma"],
];

const clean = (s: string) => s.replace(/\s+/g, " ").replace(/[|_]+/g, " ").trim();

function uniq(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list) {
    const v = clean(item);
    const k = v.toLowerCase();
    if (!v || seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  return out;
}

function findEmails(text: string): string[] {
  const m = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi);
  return uniq(m || []).slice(0, 3);
}

function findPhones(text: string): string[] {
  const m = text.match(/(?:\+\d{1,3}[\s-]?)?(?:\(?\d{3,5}\)?[\s-]?)?\d{3,5}[\s-]?\d{4,6}/g);
  if (!m) return [];
  const out = m
    .map((s) => s.replace(/[^\d+]/g, ""))
    .filter((d) => d.replace(/\D/g, "").length >= 10 && d.replace(/\D/g, "").length <= 13);
  return uniq(out).slice(0, 3);
}

function findLinks(text: string): string[] {
  const m = text.match(/(?:https?:\/\/|www\.)[^\s"'<>)\]]+/gi);
  return uniq(m || []).slice(0, 8);
}

/** "8.7 CGPA" / "CGPA: 8.7/10" / "SGPA 9.1" → 0-100. Returns null if not a GPA. */
function findGpa(text: string): { value: number; raw: string } | null {
  const patterns: RegExp[] = [
    // "100" must come before "10" in the alternation, otherwise "/100" matches
    // the leading "10" and "8.7/100" is parsed as a /10 scale (→ 870 → dropped).
    /\b(?:cgpa|sgpa|gpa)\s*[:\-]?\s*(\d{1,2}(?:\.\d{1,2})?)\s*(?:\/\s*(100|10|5|4))?/i,
    /(\d{1,2}(?:\.\d{1,2})?)\s*(?:cgpa|sgpa|gpa)\b/i,
    /aggregate\s*(?:score)?\s*[:\-]?\s*(\d{1,2}(?:\.\d{1,2})?)\s*(?:\/\s*(100|10|5|4))?/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (!m) continue;
    const rawNum = parseFloat(m[1]);
    if (Number.isNaN(rawNum) || rawNum <= 0) continue;
    const explicit = m[2] ? parseFloat(m[2]) : null;
    // No written scale: guess from magnitude, trying plausible scales in order
    // so a value that overflows one scale is re-tried on the next instead of
    // being dropped (e.g. "GPA 4.3" on a 4.33 scale).
    const scales = explicit
      ? [explicit]
      : rawNum <= 4.5 ? [4, 10, 100]
      : rawNum <= 10 ? [10, 100]
      : [100];
    for (const scale of scales) {
      const value = scale === 10 ? rawNum * 10 : scale === 5 ? rawNum * 20 : scale === 4 ? rawNum * 25 : rawNum;
      if (value > 0 && value <= 100) return { value: Math.round(value * 10) / 10, raw: clean(m[0]) };
      // Slight overshoot on a 4.0 scale (4.33-scale GPAs) tops out at 100.
      if (scale === 4 && value > 100 && value <= 110) return { value: 100, raw: clean(m[0]) };
    }
  }
  return null;
}

function findPercentage(text: string): number | null {
  const m = text.match(/(?:aggregate|overall|total|percentage|percent|marks)\D{0,12}(\d{1,3}(?:\.\d{1,2})?)\s*%/i)
    || text.match(/(\d{1,3}(?:\.\d{1,2})?)\s*%/)
    // "Total Marks 92 / 100" — same meaning as 92%.
    || text.match(/(?:aggregate|overall|total|marks)\D{0,12}(\d{1,3}(?:\.\d{1,2})?)\s*(?:\/|out of)\s*100/i);
  if (!m) return null;
  const v = parseFloat(m[1]);
  return v > 0 && v <= 100 ? Math.round(v * 10) / 10 : null;
}

function findYear(text: string): number | null {
  const years = text.match(/\b(19[89]\d|20[0-4]\d)\b/g);
  if (!years) return null;
  const now = new Date().getFullYear();
  const valid = years.map(Number).filter((y) => y >= 1980 && y <= now + 1);
  if (!valid.length) return null;
  return valid.includes(now) ? now : Math.max(...valid);
}

function findRollNumber(text: string): string | undefined {
  const m = text.match(/(?:roll\s*(?:no|number)?|registration\s*(?:no|number)?|enrollment\s*(?:no|number)?|student\s*id|usn)\s*[:#-]?\s*([A-Z0-9\/-]{4,20})/i);
  return m ? clean(m[1]) : undefined;
}

/** Words that can sit in front of "University" without being part of its name. */
const NOT_INSTITUTION =
  /^(statement|marks?|result|register|registration|number|no|semester|session|year|consolidated|individual|aggregate|provisional|final|the|of|this|certificate|transcript|report|card|government|india|central|state|private|public|deemed|autonomous|affiliated|board|council|authority|office|department|all|level|first|second|third|division|class|and|for|to|in|by|has|been|obtained|total|subject|code)/i;

const INSTITUTION_KW = /^(universit\w*|college|institute|academy|school|polytechnic|faculty)/i;
/** Degree / section words that end an "of X" institution tail. */
const STOPS_TAIL =
  /^(b\.?\s?tech|b\.?\s?e|m\.?\s?tech|bca|mca|bba|mba|b\.?\s?sc|m\.?\s?sc|b\.?\s?com|b\.?\s?phd|phd|diploma|class|secondary|board|semester|branch|department|division|faculty|year|session|roll|marks|subject|code|programme|program|course|stream|part|section)$/i;

/**
 * Rebuilds a clean institution name: keeps the keyword plus an optional
 * "of X" tail and drops the document noise that sat in front of it, so
 * "Statement of Marks University of Delhi" becomes "University of Delhi".
 */
function tidyInstitution(raw: string): string | null {
  const words = clean(raw).split(" ").filter(Boolean);
  const idx = words.findIndex((w) => INSTITUTION_KW.test(w));
  if (idx < 0) return null;
  const before = words.slice(0, idx).filter((w) => !NOT_INSTITUTION.test(w)).slice(-2);
  const after: string[] = [];
  for (const w of words.slice(idx, idx + 4)) {
    if (after.length && STOPS_TAIL.test(w)) break;
    after.push(w);
  }
  const value = [...before, ...after].join(" ").replace(/\s{2,}/g, " ").trim();
  if (value.length < 4 || value.length > 70) return null;
  return value;
}

function findInstitution(text: string, category: WalletCategory): string | undefined {
  // Ordered: "Indian Institute of ..." and "X University of Y" first, then a
  // keyword scan with up to two leading capitalised words, blocklist-filtered.
  const patterns = [
    /((?:[A-Z][A-Za-z.&]+\s+){0,2}Institute\s+of\s+[A-Z][A-Za-z.&]*(?:\s+[A-Z][A-Za-z.&]*){0,3})/,
    /((?:[A-Z][A-Za-z.&]+\s+){0,2}(?:University|College|Academy|School|Polytechnic)\s+of\s+[A-Z][A-Za-z.&]*(?:\s+(?:of\s+)?[A-Z][A-Za-z.&]*){0,2})/,
    /((?:[A-Z][A-Za-z.&]+\s+){0,2}(?:University|College|Institute|Academy|School|Polytechnic)\b(?:\s+of\s+[A-Z][A-Za-z.&]*(?:\s+(?:of\s+)?[A-Z][A-Za-z.&]*){0,2})?)/,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (!m) continue;
    const v = tidyInstitution(m[1] || m[0]);
    if (v) return v;
  }
  if (category === "Awards" || category === "Certificates") {
    const org = text.match(/\b(?:by|from)\s+((?:[A-Z][A-Za-z.&]+\s+){0,3}(?:Foundation|Society|Association|Council|Committee|Institute|Academy|Club|Trust|NGO|Inc\.|Ltd\.|Corp\.|Corporation|Organization|University|Department|Ministry|Authority|Centre|Center))/);
    if (org) return clean(org[1]);
  }
  return undefined;
}

const ORG_SUFFIX =
  "(?:Foundation|Society|Association|Council|Committee|Institute|Academy|Club|Trust|NGO|Inc\\.|Ltd\\.|Corp\\.|Corporation|Organization|Organisation|University|Department|Ministry|Authority|Centre|Center|Board|Agency)";
const ORG_TAIL = "(?:\\s+of\\s+[A-Z][A-Za-z.&]*(?:\\s+(?:and\\s+)?[A-Z][A-Za-z.&]*){0,2})?";

function findIssuer(text: string): string | undefined {
  const patterns = [
    // "awarded to John Doe by the Ministry of Education, Government of India"
    new RegExp(`\\bby\\s+(?:the\\s+)?((?:[A-Z][A-Za-z.&]+\\s+){0,3}${ORG_SUFFIX}${ORG_TAIL})`),
    // "certified / presented / issued / conducted by CodeChef Foundation"
    new RegExp(`\\b(?:certified|awarded|presented|issued|conducted|organized|organised|signed)\\s+(?:to\\s+[A-Z][A-Za-z.\\s]{2,40}?\\s+)?by\\s+(?:the\\s+)?((?:[A-Z][A-Za-z.&]+\\s+){0,3}${ORG_SUFFIX}${ORG_TAIL})`),
    new RegExp(`\\b(?:issued|awarded|presented)\\s+by\\s+(?:the\\s+)?((?:[A-Z][A-Za-z.&]+\\s+){0,3}${ORG_SUFFIX}${ORG_TAIL})`),
    /\bis\s+proud\s+to\s+(?:present|award)\s+(?:this\s+\w+\s+to|to)\s+([A-Z][A-Za-z ]{3,40})/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const v = clean(m[1]).replace(/[,;]\s*$/, "");
      if (v.length > 3 && v.length < 80) return v;
    }
  }
  return findInstitution(text, "Certificates");
}

function findField(text: string): string | undefined {
  for (const [re, label] of DEGREES) {
    const m = text.match(re);
    if (!m) continue;
    const subject = m[2] ? clean(m[2]).replace(/\b(and|&|with|department of)\b.*/i, "").trim() : "";
    return subject ? `${label} in ${subject}` : label;
  }
  return undefined;
}

function detectAwardLevel(text: string): DocumentInsights["awardLevel"] {
  if (/\b(international|global|world|overseas)\b/i.test(text)) return "international";
  if (/\b(national|all india|pan\s?india|republic day|independence day)\b/i.test(text)) return "national";
  if (/\b(state\s?level|state\s?award|government of [a-z ]*state|district level)\b/i.test(text)) return "state";
  if (/\b(university\s?level|university)\b/i.test(text)) return "university";
  if (/\b(college|school|department)\s?level\b/i.test(text)) return "college";
  return undefined;
}

function detectOrgType(text: string): DocumentInsights["orgType"] {
  if (/\b(ministry|department of|government of|government|bureau|authority|commission|uidai|aadhaar|pan\b|election commission|municipal|police|govt\.?)\b/i.test(text)) return "government";
  if (/\b(university|college|institute|academy|school|department of studies|faculty)\b/i.test(text)) return "academic";
  if (/\b(ngo|non-?profit|foundation|charity|trust|society|association|volunteer)\b/i.test(text)) return "ngo";
  if (/\b(pvt|ltd|inc\.?|llp|corp\.|corporation|company|industries|technologies|enterprises)\b/i.test(text)) return "private";
  return "unknown";
}

function isGovtId(text: string): boolean {
  return /\b(aadhaar|aadhar|uidai|election commission|voter id|pan\s?(?:card|no)|passport|driving licen[cs]e|ration card|abha| Ayushman|residence certificate| caste certificate|income certificate)\b/i.test(text);
}

function collectListAfter(text: string, labels: string[], limit: number): string[] {
  const re = new RegExp(`(?:${labels.join("|")})\\s*[:\\-]?\\s*([^\\n]{5,300})`, "i");
  const m = text.match(re);
  if (!m) return [];
  return uniq(
    m[1]
      .split(/[,;•·|/]| and /i)
      .map((s) => s.replace(/\b\d{2,}\b/g, "").trim())
      .filter((s) => s.length >= 2 && s.length <= 40)
  ).slice(0, limit);
}

function findSkills(text: string): string[] {
  const fromSection = collectListAfter(text, ["key skills", "skills", "competencies", "soft skills", "strengths", "areas of expertise"], 20);
  const hints = SKILL_HINTS.filter((s) => new RegExp(`\\b${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text));
  return uniq([...fromSection, ...hints]);
}

function findTechnologies(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];
  for (const tech of TECH_LIST) {
    if (tech.includes(" ")) {
      if (lower.includes(tech)) found.push(tech);
    } else {
      const re = new RegExp(`(?<![a-z0-9])${tech.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z0-9])`, "i");
      if (re.test(text)) found.push(tech);
    }
  }
  return uniq(found).slice(0, 18);
}

function findLanguages(text: string): string[] {
  const fromSection = collectListAfter(text, ["languages", "language known", "linguistic"], 8);
  const lower = text.toLowerCase();
  const found = LANG_LIST.filter((l) => new RegExp(`(?<![a-z])${l}(?![a-z])`, "i").test(lower));
  return uniq([...fromSection, ...found]).slice(0, 8);
}

function findKeywords(text: string, limit = 12): string[] {
  const counts = new Map<string, number>();
  const words = text
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
  for (const w of words) counts.set(w, (counts.get(w) || 0) + 1);
  return [...counts.entries()]
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([w]) => w);
}

const pad2 = (n: number) => String(n).padStart(2, "0");
/** Local-calendar ISO date. Never `toISOString()` on a local Date — that shifts a day. */
const isoDate = (year: number, month: number, day: number) =>
  `${year}-${pad2(month + 1)}-${pad2(day)}`;

function findDate(text: string): string | undefined {
  const months = "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";
  const maxYear = new Date().getFullYear() + 1;
  const cands: string[] = [];
  // 12 August 2025 | 12 Aug, 2025
  const named = new RegExp(`\\b(\\d{1,2})[\\s-](${months})[\\s,-]*(\\d{4})\\b`, "gi");
  // August 12, 2025
  const named2 = new RegExp(`\\b(${months})[\\s-](\\d{1,2})[\\s,-]*(\\d{4})\\b`, "gi");
  // 12-08-2025 | 12/08/2025 | 2025-08-12
  const numeric = /\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})\b|\b(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})\b/g;

  for (const m of text.matchAll(named)) {
    const mo = MONTH_INDEX[m[2].toLowerCase().slice(0, 3)];
    if (mo === undefined) continue;
    cands.push(isoDate(Number(m[3]), mo, Number(m[1])));
  }
  for (const m of text.matchAll(named2)) {
    const mo = MONTH_INDEX[m[1].toLowerCase().slice(0, 3)];
    if (mo === undefined) continue;
    cands.push(isoDate(Number(m[3]), mo, Number(m[2])));
  }
  for (const m of text.matchAll(numeric)) {
    if (m[1]) {
      const a = Number(m[1]);
      const b = Number(m[2]);
      // Ambiguous D/M vs M/D: take the only valid reading, else assume D/M.
      const [day, month] = a > 12 ? [a, b] : b > 12 ? [b, a] : [a, b];
      if (month >= 1 && month <= 12) cands.push(isoDate(Number(m[3]), month - 1, day));
    } else if (m[4]) {
      cands.push(isoDate(Number(m[4]), Number(m[5]) - 1, Number(m[6])));
    }
  }
  return cands
    .filter((iso) => {
      const y = Number(iso.slice(0, 4));
      return y >= 1980 && y <= maxYear;
    })
    .sort()
    .pop();
}

/**
 * Extract marksheet-specific data: board, class (10/12), stream, percentage, subjects.
 */
function extractMarksheetData(text: string): {
  board?: string;
  class?: "10" | "12";
  stream?: "science" | "commerce" | "arts" | "vocational";
  percentage?: number;
  subjects?: Array<{ name: string; marks: number; maxMarks?: number }>;
  school?: string;
  rollNumber?: string;
} {
  const lower = text.toLowerCase();
  const result: ReturnType<typeof extractMarksheetData> = {};

  // Board detection
  const boards = [
    "cbse", "icse", "isc", "iscse", "i.s.c", "c.b.s.e",
    "up board", "uttar pradesh", "bihar board", "bseb",
    "mp board", "madhya pradesh", "maharashtra board", "msbshse",
    "rajasthan board", "rbse", "gujarat board", "gseb",
    "karnataka board", "puc", "west bengal board", "wbchse",
    "tamil nadu", "tn board", "dge tn", "andhra pradesh", "bseap",
    "telangana", "tsbse", "kerala board", "kbpe",
    "punjab board", "psb", "haryana board", "hbse",
    "delhi board", "nios", "national institute of open schooling",
    "cambridge", "igcse", "ib", "international baccalaureate",
  ];
  for (const b of boards) {
    if (lower.includes(b)) { result.board = b.toUpperCase(); break; }
  }
  if (!result.board && /board of secondary/i.test(lower)) result.board = "STATE BOARD";

  // Class 10 or 12
  if (/\b(?:class\s*(?:10|x|ten)|x\s*(?:board|exam)|ssc|matric|secondary\s*school\s*certificate)\b/i.test(lower)) {
    result.class = "10";
  } else if (/\b(?:class\s*(?:12|xii|twelve)|intermediate|hsc|higher\s*secondary|senior\s*school\s*certificate|puc\s*ii)\b/i.test(lower)) {
    result.class = "12";
  }

  // Stream (for class 12)
  if (result.class === "12") {
    if (/science|pcm|pcb|physics|chemistry|biology|maths|mathematics/.test(lower)) result.stream = "science";
    else if (/commerce|accountancy|business\s*studies|economics/.test(lower)) result.stream = "commerce";
    else if (/arts|humanities|history|political\s*science|geography|psychology/.test(lower)) result.stream = "arts";
    else if (/vocational|skill/.test(lower)) result.stream = "vocational";
  }

  // School name (often appears as "School: XYZ" or "Institution: XYZ")
  const schoolMatch = text.match(/(?:school|institution|college|academy)\s*[:.\-]\s*([A-Z][A-Za-z0-9 .&'-]{3,60})/i);
  if (schoolMatch) result.school = clean(schoolMatch[1]);

  // Roll number (already extracted by findRollNumber, but try marksheet-specific patterns)
  const rollMatch = text.match(/(?:roll\s*(?:no|number)?|admit\s*card\s*no|registration\s*no)\s*[:#-]?\s*([A-Z0-9\/-]{5,20})/i);
  if (rollMatch) result.rollNumber = clean(rollMatch[1]);

  // Percentage (enhanced for marksheets)
  const pctMatch = text.match(/(?:aggregate|overall|total|percentage|grand\s*total)\D{0,12}(\d{1,3}(?:\.\d{1,2})?)\s*%/i)
    || text.match(/(?:total|aggregate|grand\s*total)\s*[:\-]\s*(\d{1,3}(?:\.\d{1,2})?)\s*(?:\/|out\s*of)\s*(\d{3,4})/i)
    || text.match(/(\d{1,3}(?:\.\d{1,2})?)\s*%\s*(?:aggregate|overall|total)/i);
  if (pctMatch) {
    const v = parseFloat(pctMatch[1]);
    const max = pctMatch[2] ? parseFloat(pctMatch[2]) : null;
    // Only pattern 2 captures a denominator. Check it BEFORE the plain-value
    // branch, otherwise "Total: 92/500" short-circuits at v=92 and is reported
    // as 92% instead of 18.4%.
    if (max && max > 0 && max !== 100) {
      const calc = (v / max) * 100;
      if (calc > 0 && calc <= 100) result.percentage = Math.round(calc * 10) / 10;
    } else if (v > 0 && v <= 100) {
      result.percentage = Math.round(v * 10) / 10;
    }
  }

  // Subject-wise marks (look for patterns like "Mathematics 95/100" or "Physics: 92")
  const subjects: Array<{ name: string; marks: number; maxMarks?: number }> = [];
  const subjPattern = /(?:^|\n)\s*([A-Za-z][A-Za-z\s&]{2,30}?)\s*[:.\-]?\s*(\d{1,3}(?:\.\d{1,2})?)\s*(?:\/|out\s*of\s*)?(\d{2,3})?/gi;
  let m;
  while ((m = subjPattern.exec(text)) !== null) {
    const name = clean(m[1]).replace(/\s+/g, " ");
    const marks = parseFloat(m[2]);
    const max = m[3] ? parseFloat(m[3]) : undefined;
    if (marks >= 0 && marks <= 100 && name.length >= 3 && /[a-z]/i.test(name)) {
      // Filter out common non-subject lines
      if (!/total|aggregate|grand\s*total|percentage|result|pass|fail|grade|rank|attendance/.test(name.toLowerCase())) {
        subjects.push({ name, marks, maxMarks: max });
      }
    }
  }
  if (subjects.length) result.subjects = subjects.slice(0, 10);

  return result;
}

/**
 * Extract every fact we can from one document's text.
 * Safe to call with empty text — returns an empty insight object.
 */
export function extractInsights(text: string, category: WalletCategory, name = ""): DocumentInsights {
  const body = (text || "").slice(0, MAX_TEXT);
  const source = body || name || "";
  const insights: DocumentInsights = { skills: [], technologies: [], languages: [], links: [], keywords: [] };
  if (!source.trim()) return insights;

  // Marksheet-specific extraction for Results
  const marksheet = category === "Results" ? extractMarksheetData(body) : null;

  const gpa = findGpa(body);
  const percentage = findPercentage(body);
  const institution = findInstitution(body, category);
  const issuer = category === "Certificates" || category === "Awards" ? findIssuer(body) : undefined;

  if (gpa) {
    insights.gpa = gpa.value;
    insights.gpaRaw = gpa.raw;
  } else if (percentage !== null) {
    insights.gpa = percentage;
  }
  if (percentage !== null) insights.percentage = percentage;
  // Prefer marksheet percentage (more accurate)
  if (marksheet?.percentage !== undefined) {
    insights.percentage = marksheet.percentage;
    // Only borrow it as the normalized score when no real GPA was parsed —
    // otherwise gpaRaw still shows "CGPA 8.7/10" while gpa says 92.
    if (gpa === null && percentage === null) insights.gpa = marksheet.percentage;
  }

  const roll = findRollNumber(body);
  if (roll) insights.rollNumber = roll;
  // Use marksheet roll number if available
  if (marksheet?.rollNumber) insights.rollNumber = marksheet.rollNumber;

  const year = findYear(body);
  if (year) insights.graduationYear = year;
  const date = findDate(body);
  if (date) insights.documentDate = date;
  const field = findField(body);
  if (field) insights.field = field;
  if (institution) insights.institution = institution;
  // Markshet board as institution fallback
  if (marksheet?.board && !insights.institution) insights.institution = marksheet.board;
  if (marksheet?.school && !insights.institution) insights.institution = marksheet.school;

  if (issuer && issuer !== institution) insights.issuer = issuer;

  // Markshet class & stream
  if (marksheet?.class) insights.marksheetClass = marksheet.class;
  if (marksheet?.stream) insights.marksheetStream = marksheet.stream;
  if (marksheet?.board) insights.marksheetBoard = marksheet.board;
  if (marksheet?.subjects?.length) insights.marksheetSubjects = marksheet.subjects;

  insights.skills = findSkills(body);
  insights.technologies = findTechnologies(body);
  insights.languages = findLanguages(body);
  insights.links = findLinks(body);

  const emails = findEmails(body);
  if (emails.length) insights.contactEmail = emails[0];
  const phones = findPhones(body);
  if (phones.length) insights.contactPhone = phones[0];

  insights.orgType = detectOrgType(body);
  if (category === "ID Documents" || isGovtId(body)) insights.isGovtId = true;
  if (category === "Awards") {
    // Only record a level that the text actually supports. This used to fall back
    // to `"university"`, which asserted a specific competitive tier for every
    // award whose level could not be read — feeding `scoreRecognition` a
    // guaranteed non-null level and handing out recognition points for a tier the
    // document never claimed.
    const level = detectAwardLevel(body);
    if (level) insights.awardLevel = level;
  }

  insights.keywords = findKeywords(body);
  return insights;
}

/** Compact one-line summary used inside the AI prompt. */
export function describeInsights(i?: DocumentInsights): string {
  if (!i) return "no readable text";
  const parts: string[] = [];
  if (i.field) parts.push(i.field);
  if (i.gpa !== undefined) parts.push(`score ${i.gpa}${i.gpaRaw ? ` (${i.gpaRaw})` : ""}`);
  if (i.institution) parts.push(i.institution);
  if (i.issuer) parts.push(`issued by ${i.issuer}`);
  if (i.graduationYear) parts.push(String(i.graduationYear));
  if (i.awardLevel) parts.push(`${i.awardLevel}-level`);
  if (i.skills.length) parts.push(`skills: ${i.skills.slice(0, 6).join(", ")}`);
  if (i.technologies.length) parts.push(`tech: ${i.technologies.slice(0, 6).join(", ")}`);
  if (i.languages.length) parts.push(`languages: ${i.languages.join(", ")}`);
  if (i.links.length) parts.push(`${i.links.length} link(s)`);
  return parts.length ? parts.join(" | ") : "minimal detail";
}
