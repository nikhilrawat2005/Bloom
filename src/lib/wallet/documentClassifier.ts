import { WALLET_CATEGORIES, normalizeCategory } from "./categories";
import type { WalletCategory } from "@/lib/types";
import { authedFetch } from "@/lib/apiClient";

export type CategorySource = "content" | "ai" | "manual" | "unknown";

export interface ClassificationResult {
  category: WalletCategory;
  confidence: number;
  source: CategorySource;
  reason: string;
  needsReview: boolean;
}

export interface ClassifyOptions {
  name?: string;
  mimeType?: string;
  text?: string;
  imageDataUrl?: string;
  /** Set false to skip the AI call entirely (offline rules only). */
  useAI?: boolean;
  /** Send every file to the LLM first; local rules only act as a fallback. */
  preferAI?: boolean;
}

const MAX_PAGES = 4;
const MAX_CHARS = 6000;
const MIN_USEFUL_TEXT = 30;
const MIN_SCORE = 3;

interface Rule {
  pattern: RegExp;
  weight: number;
  label: string;
}

/**
 * Weighted content signatures per category. Scoring (instead of first-match
 * ordering) is what keeps marksheets out of "ID Documents" and award
 * certificates out of "Awards", which is where the old cascade went wrong.
 */
const RULES: Record<Exclude<WalletCategory, "Other">, Rule[]> = {
  Resume: [
    { pattern: /curriculum vitae|\bc\.?v\.?\s*(document)?\b/, weight: 4, label: "curriculum vitae" },
    { pattern: /(work|professional|employment|industry) (experience|history)/, weight: 3, label: "work experience" },
    { pattern: /(career|professional|personal|self) (objective|summary|profile|statement)/, weight: 3, label: "career summary" },
    { pattern: /technical skills|skills? ?(and|&) (expertise|proficiency)/, weight: 2, label: "technical skills" },
    { pattern: /education(al)? (background|details|qualification|section)|(section of )?education/, weight: 1.5, label: "education section" },
    { pattern: /skills?\s*[:\-]/, weight: 1, label: "skills list" },
    { pattern: /achievements|accomplishments|extra[- ]?curricular/, weight: 1.5, label: "achievements" },
    { pattern: /references? (are )?(available|on request|upon request)/, weight: 1.5, label: "references on request" },
    { pattern: /(declaration|hobbies|interests|personal details)/, weight: 1.5, label: "resume boilerplate" },
    { pattern: /(linkedin|github|behance)\.(com|io|in)\//, weight: 1, label: "profile links" },
    { pattern: /(bachelor|master|b\.?tech|m\.?tech|b\.?sc|m\.?sc|bca|mca|class (x|xii|10|12))\b/, weight: 0.5, label: "degree" },
    { pattern: /(objective|summary)\s*:?\s*$/m, weight: 1, label: "objective/summary heading" },
  ],
  "ID Documents": [
    { pattern: /aadhaar|aadhar|adhaar|uidai|unique identification/, weight: 5, label: "Aadhaar/UIDAI" },
    { pattern: /permanent account number|income tax department|\bpan\b[\s:-]*(number|card|no)/, weight: 5, label: "PAN card" },
    { pattern: /election commission|electoral roll|voter'?s? (identity|id)|\bepic\b/, weight: 5, label: "voter ID" },
    { pattern: /driving licen[cs]e/, weight: 4, label: "driving licence" },
    { pattern: /\bpassport\b/, weight: 3, label: "passport" },
    { pattern: /nationality|place of birth|country of issue/, weight: 1.5, label: "identity fields" },
    { pattern: /(valid (upto|until|till|thru)|date of expiry|expiry date|issue date|date of issue)/, weight: 1.5, label: "validity dates" },
    { pattern: /\b\d{4}\s?\d{4}\s?\d{4}\b/, weight: 3, label: "12-digit ID number" },
    { pattern: /\b[a-z]{5}[0-9]{4}[a-z]\b/, weight: 3, label: "PAN format" },
    { pattern: /(identity card|\bid card\b|government of india|republic of india|residence permit)/, weight: 2, label: "government identity" },
  ],
  Results: [
    { pattern: /statement of marks|marks? ?sheet|marks statement/, weight: 5, label: "statement of marks" },
    { pattern: /\bsgpa\b|\bcgpa\b|\bgpa\b|grade point/, weight: 4, label: "grade pointers" },
    { pattern: /(total marks|marks obtained|maximum marks|marks scored|marks secured)/, weight: 4, label: "marks summary" },
    { pattern: /(semester|sem|term)\s*(i|ii|iii|iv|v|vi|1|2|3|4|5|6)?\s*(result|marks|examination|exam)/, weight: 3, label: "semester result" },
    { pattern: /(grade card|transcript|consolidated (result|marks)|academic record)/, weight: 3, label: "grade card/transcript" },
    { pattern: /(examination|exam)\s*(result|results|conducted by|committee)/, weight: 2, label: "exam result" },
    { pattern: /(subject code|subject name|roll no)/, weight: 1.5, label: "subject/roll table" },
    { pattern: /(first|second|third|final) (year|semester)/, weight: 1.5, label: "year/semester" },
    { pattern: /percentage (of )?marks|percentage\s*[:=]?\s*\d/, weight: 1.5, label: "percentage" },
    { pattern: /(passing|pass) (criteria|percentage|marks)/, weight: 1.5, label: "pass criteria" },
    { pattern: /(division|class obtained|distinction|pass category)/, weight: 1, label: "result class" },
    { pattern: /(university|board of studies|board of examinations)/, weight: 1, label: "issuing university/board" },
    { pattern: /(curriculum vitae|work experience|professional summary)/, weight: -3, label: "looks like a resume" },
  ],
  Certificates: [
    { pattern: /certificat(e|ion|es)/, weight: 3, label: "certificate wording" },
    { pattern: /this is to certify|hereby certify|certifies that/, weight: 3, label: "certification statement" },
    { pattern: /has successfully completed|successfully completed the (course|program|training)/, weight: 3, label: "completion statement" },
    { pattern: /completion of (the )?(course|program|training|module)/, weight: 3, label: "course completion" },
    { pattern: /(is awarded to|awarded to|presented (to|for)|bestowed)/, weight: 2, label: "awarded-to clause" },
    { pattern: /(has participated in|participated in|attended|successful participation)/, weight: 2, label: "participation clause" },
    { pattern: /(certificate (id|no|number)|cert (id|no)|serial no)/, weight: 1.5, label: "certificate id" },
    { pattern: /(hrs|hours) (of )?(training|instruction|duration)/, weight: 1.5, label: "training hours" },
    { pattern: /(trainer|instructor|faculty|conducted by|organised by|organized by)/, weight: 1, label: "issuer/faculty" },
    { pattern: /(issued on|issue date|date of issue|valid till)/, weight: 1, label: "issue date" },
    { pattern: /autonomous (institute|college)|training (institute|partner)/, weight: 0.5, label: "training provider" },
  ],
  Awards: [
    { pattern: /(first|second|third|1st|2nd|3rd)\s*(prize|place|rank)/, weight: 4, label: "prize position" },
    { pattern: /\bwinner\b|won the|topped|victor/, weight: 3, label: "winner" },
    { pattern: /runner[- ]?up/, weight: 3, label: "runner-up" },
    { pattern: /best (student|project|performer|app|innovator|presentation|team)|outstanding (student|performer|contributor)/, weight: 3, label: "best/outstanding award" },
    { pattern: /(gold|silver|bronze) medal/, weight: 3, label: "medal" },
    { pattern: /award( of)? (for|to)|was awarded|awarded the/, weight: 2, label: "award statement" },
    { pattern: /(honou?rs? (with|to|in)|with (distinction|honours)|topper)/, weight: 2, label: "honours" },
    { pattern: /(hackathon|code ?fest|ideathon|competition|contest) (winner|victor|champion)/, weight: 2, label: "competition win" },
    { pattern: /congratulations/, weight: 2, label: "congratulations" },
    { pattern: /certificate/, weight: -1.5, label: "certificate framing" },
    { pattern: /statement of marks|total marks/, weight: -2, label: "looks like a marksheet" },
  ],
  Projects: [
    { pattern: /(problem statement|statement of the problem)/, weight: 3, label: "problem statement" },
    { pattern: /methodolog(y|ies)/, weight: 2.5, label: "methodology" },
    { pattern: /(system architecture|architecture diagram|tech stack|technologies used|tools used)/, weight: 2.5, label: "architecture/stack" },
    { pattern: /(future scope|limitations of|scope of the project)/, weight: 2.5, label: "future scope/limitations" },
    { pattern: /acknowledg(e)?ments?/, weight: 2, label: "acknowledgement" },
    { pattern: /(literature survey|objectives? of the (project|work)|aim of the project)/, weight: 2, label: "project objectives" },
    { pattern: /(results? and (discussion|analysis)|discussion on results)/, weight: 1.5, label: "results and discussion" },
    { pattern: /(references|bibliography)/, weight: 1.5, label: "references" },
    { pattern: /(abstract)\s*[:\-]/, weight: 1.5, label: "abstract" },
    { pattern: /(chapter\s*(i|ii|iii|iv|v|1|2|3|4|5|6)|table of contents|index\s*:)/, weight: 1.5, label: "report structure" },
    { pattern: /(submitted (by|to)|project (guide|supervisor)|under the guidance of|department of)/, weight: 1.5, label: "project submission" },
    { pattern: /(github|demo (video|link)|live (demo|at))/, weight: 1.5, label: "repo/demo" },
    { pattern: /(implementation|we have implemented|model implementation|experimental setup)/, weight: 1, label: "implementation" },
    { pattern: /curriculum vitae/, weight: -3, label: "looks like a resume" },
  ],
};

/**
 * Sum of the positive weights per category — the highest score that category can
 * theoretically reach. Used to normalise a raw score into a 0..1 strength so
 * confidence means the same thing across categories whose rule sets have very
 * different totals (Resume tops out at 20.5, Projects at 21.5, and so on).
 *
 * Negative weights (the "looks like a marksheet" discriminators) are excluded,
 * since they exist to penalise, not to be earned.
 */
const MAX_SCORE_BY_CATEGORY: Record<string, number> = Object.fromEntries(
  Object.entries(RULES).map(([category, rules]) => [
    category,
    rules.reduce((sum, r) => sum + Math.max(0, r.weight), 0),
  ])
);

/** Below this the classification is shown to the user as uncertain. */
const REVIEW_THRESHOLD = 0.55;

function scoreCategories(text: string) {
  const scores: Record<string, number> = {};
  const hits: Record<string, string[]> = {};

  for (const category of Object.keys(RULES) as (keyof typeof RULES)[]) {
    let score = 0;
    const labels: string[] = [];
    for (const rule of RULES[category]) {
      if (rule.pattern.test(text)) {
        score += rule.weight;
        if (rule.weight > 0) labels.push(rule.label);
      }
    }
    scores[category] = score;
    hits[category] = labels;
  }

  return { scores, hits };
}

/** Pure content classification. Never looks at the file name. */
export function classifyByContent(rawText: string): ClassificationResult {
  const text = rawText.replace(/\s+/g, " ").trim().toLowerCase();

  if (text.length < MIN_USEFUL_TEXT) {
    return {
      category: "Other",
      confidence: 0,
      source: "unknown",
      reason: "No readable text found in the file",
      needsReview: true,
    };
  }

  const { scores, hits } = scoreCategories(text);
  const ranked = Object.entries(scores)
    .filter(([category]) => category !== "Other")
    .sort((a, b) => b[1] - a[1]);

  const [topCategory, topScore] = ranked[0];
  const runnerUpScore = ranked[1]?.[1] ?? 0;
  const topHits = hits[topCategory] ?? [];

  if (!topCategory || topScore < MIN_SCORE) {
    return {
      category: "Other",
      confidence: 0.2,
      source: "unknown",
      reason: "Content did not match any known document type",
      needsReview: true,
    };
  }

  // Confidence is built from two independent, scale-free signals:
  //
  //   strength    — how much of the winning category's signature matched, so a
  //                 single weak keyword scores low instead of looking certain.
  //   marginRatio — how far ahead of the runner-up the winner is, relative to its
  //                 own score, so an ambiguous two-way tie reads as uncertain.
  //
  // The old formula was `0.4 + 0.07 * topScore + 0.08 * margin` on the raw sums.
  // Because the raw sums run into the tens, that expression exceeded 1.0 for
  // anything beyond a couple of weak matches, so the `Math.min(0.97, ...)` clamp
  // pinned almost every classification at 0.97 and the "needsReview" gate could
  // essentially never fire. Confidence carried no information at all.
  const maxScore = MAX_SCORE_BY_CATEGORY[topCategory] || 1;
  const strength = Math.min(1, Math.max(0, topScore / maxScore));
  const marginRatio = Math.min(1, Math.max(0, (topScore - Math.max(0, runnerUpScore)) / Math.max(topScore, 1)));

  const confidence = Math.min(0.97, Math.max(0.05, 0.05 + 0.7 * strength + 0.25 * marginRatio));

  return {
    category: topCategory as WalletCategory,
    confidence: Number(confidence.toFixed(2)),
    source: "content",
    reason: `Matched: ${topHits.slice(0, 3).join(", ")}`,
    needsReview: confidence < REVIEW_THRESHOLD,
  };
}

export async function classifyWithAI(
  opts: Pick<ClassifyOptions, "text" | "imageDataUrl" | "mimeType" | "name">
): Promise<ClassificationResult> {
  const res = await authedFetch("/api/wallet/categorize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: opts.text?.slice(0, MAX_CHARS),
      imageDataUrl: opts.imageDataUrl,
      mimeType: opts.mimeType,
      name: opts.name,
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Categorizer failed (${res.status})`);

  const category = normalizeCategory(body.category);
  if (!category) throw new Error("Categorizer returned an unknown category");

  return {
    category,
    // A missing confidence must not become a reassuring 0.6 — that reads as
    // "the model was fairly sure". Treat it as unknown and flag for review.
    confidence: typeof body.confidence === "number" ? body.confidence : 0,
    source: "ai",
    reason: body.reason || "Classified by AI",
    needsReview:
      typeof body.needsReview === "boolean"
        ? body.needsReview
        : typeof body.confidence !== "number" || body.confidence < 0.55,
  };
}

/**
 * LLM-first classification, one request per document.
 *
 * The file's own content (text read out of the bytes, or the image itself) is
 * handed to the model, which returns the category. Local scoring is only used
 * as a safety net: when AI is switched off, unavailable, or unsure.
 */
export async function classifyDocument(opts: ClassifyOptions): Promise<ClassificationResult> {
  const local = classifyByContent(opts.text || "");

  if (opts.useAI === false) return local;

  const hasPayload = !!opts.text?.trim() || !!opts.imageDataUrl;
  if (!hasPayload) return local;

  const aiWorthy = opts.preferAI
    ? true
    : local.source === "content" && local.confidence >= 0.6;

  if (!aiWorthy) return local;

  try {
    const ai = await classifyWithAI(opts);
    if (ai.category === "Other" && local.category !== "Other" && local.source === "content") {
      return { ...local, reason: `${local.reason} (AI was unsure)` };
    }
    return ai;
  } catch (err) {
    console.warn("[wallet] AI categorization unavailable, using local rules:", err);
    return local;
  }
}

/* ── Text extraction ─────────────────────────────────────────────────────── */

function isImageMime(mimeType?: string): boolean {
  return !!mimeType && mimeType.toLowerCase().startsWith("image/");
}

function decodeText(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  // Reject binary payloads that are not real text.
  const sample = bytes.subarray(0, 512);
  let printable = 0;
  for (const byte of sample) {
    if (byte === 9 || byte === 10 || byte === 13 || (byte >= 32 && byte !== 127)) printable++;
  }
  if (sample.length > 0 && printable / sample.length < 0.85) return "";
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

async function pdfText(buffer: ArrayBuffer): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
  // pdf.js may detach/transer the buffer, so always hand it a copy.
  const pdf = await pdfjsLib.getDocument({ data: buffer.slice(0) }).promise;
  const pageTexts: string[] = [];
  const maxPages = Math.min(pdf.numPages, MAX_PAGES);
  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pageTexts.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
  }
  return pageTexts.join("\n\n");
}

async function docxText(buffer: ArrayBuffer): Promise<string> {
  const mammoth = await import("mammoth");
  const res = await mammoth.extractRawText({ arrayBuffer: buffer.slice(0) });
  return res.value || "";
}

/** Extract text from raw bytes by sniffing the real format (name/mime are only hints). */
export async function extractTextFromBuffer(
  buffer: ArrayBuffer,
  hint: { name?: string; mimeType?: string } = {}
): Promise<string> {
  try {
    const head = new TextDecoder("latin1").decode(new Uint8Array(buffer.slice(0, 8)));
    const name = (hint.name || "").toLowerCase();
    const mime = (hint.mimeType || "").toLowerCase();
    const isZip = head.startsWith("PK\u0003\u0004");

    if (head.startsWith("%PDF") || mime.includes("pdf") || name.endsWith(".pdf")) {
      return (await pdfText(buffer)).slice(0, MAX_CHARS * 2);
    }
    if (isZip || mime.includes("word") || name.endsWith(".docx")) {
      return (await docxText(buffer)).slice(0, MAX_CHARS * 2);
    }
    if (mime.startsWith("image/") || /\.(jpe?g|png|gif|webp|bmp|heic)$/.test(name)) return "";
    if (mime.startsWith("text/") || name.endsWith(".txt") || name.endsWith(".md") || name.endsWith(".csv")) {
      return decodeText(buffer).slice(0, MAX_CHARS * 2);
    }
    // Unknown type: try plain text, it self-rejects binary content.
    return decodeText(buffer).slice(0, MAX_CHARS * 2);
  } catch (err) {
    console.warn("[wallet] text extraction failed:", err);
    return "";
  }
}

export async function extractTextFromFile(file: File): Promise<string> {
  try {
    const buffer = await file.arrayBuffer();
    return await extractTextFromBuffer(buffer, { name: file.name, mimeType: file.type });
  } catch (err) {
    console.warn("[wallet] could not read file:", file.name, err);
    return "";
  }
}

export async function fileToDataUrl(file: File, maxBytes = 4 * 1024 * 1024): Promise<string | null> {
  if (!isImageMime(file.type) || file.size > maxBytes) return null;
  const buffer = await file.arrayBuffer();
  const base64 = bufferToBase64(buffer);
  return `data:${file.type || "image/jpeg"};base64,${base64}`;
}

export function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...Array.from(bytes.subarray(i, i + chunk)));
  }
  return window.btoa(binary);
}

export interface RemoteDocumentMeta {
  url: string;
  name?: string;
  mimeType?: string;
}

export interface ClassifyRemoteOptions {
  useAI?: boolean;
  preferAI?: boolean;
}

/**
 * Classify a document that already lives in cloud storage: read the bytes once,
 * pull text out of it, and only fall back to the image itself when there is no
 * text to read.
 */
export async function classifyRemoteDocument(
  meta: RemoteDocumentMeta,
  opts: ClassifyRemoteOptions = {}
): Promise<ClassificationResult & { text: string }> {
  let text = "";
  let imageDataUrl: string | undefined;
  const isImage = isImageMime(meta.mimeType) || /\.(jpe?g|png|gif|webp|bmp|heic)(\?|$)/i.test(meta.url);

  try {
    const res = await fetch(meta.url);
    if (res.ok) {
      const buffer = await res.arrayBuffer();
      text = await extractTextFromBuffer(buffer, meta);
      if (!text && isImage && buffer.byteLength <= 4 * 1024 * 1024) {
        imageDataUrl = `data:${meta.mimeType || "image/jpeg"};base64,${bufferToBase64(buffer)}`;
      }
    }
  } catch (err) {
    console.warn("[wallet] could not fetch remote document:", meta.name, err);
  }

  const result = await classifyDocument({
    text,
    imageDataUrl,
    mimeType: meta.mimeType,
    name: meta.name,
    useAI: opts.useAI,
    preferAI: opts.preferAI,
  });

  return { ...result, text };
}

export { WALLET_CATEGORIES, normalizeCategory };
