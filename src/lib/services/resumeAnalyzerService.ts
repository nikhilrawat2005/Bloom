// ---------------------------------------------------------------------------
// Nexora Resume Intelligence — Elite ATS Resume Analyzer Service
// Based on Bob's implementation, adapted for Nexora (Next.js/TypeScript)
// ---------------------------------------------------------------------------
import { AIRouterService } from '../aiProviders';
import { neutralize } from '../promptGuard';
import { extractText } from './documentReaderService';
import PDFDocument from 'pdfkit';

function callAI(prompt: string): Promise<any> {
  // ATS audits are document-heavy. Give them the same headroom as the other
  // heavy routes so a slow-but-working model is not aborted mid-generation.
  return AIRouterService.requestAI(prompt, true, { budgetMs: 170_000, requestTimeoutMs: 120_000 });
}

export interface Breakdown {
  impactAndMetrics: number;
  skillsRelevance: number;
  actionVerbs: number;
  formattingAndClarity: number;
  experienceDepth: number;
}

export interface BulletImprovement {
  original: string;
  improved: string;
}

export interface ContactInfoCheck {
  complete: boolean;
  present: { label: string; value: string }[];
  missing: string[];
  suggestion: string;
}

export interface QuantitativeImpactCheck {
  /** Number of resume bullets that back the claim with a measurable metric. */
  detected: number;
  /** Up to a few example bullets that make claims the model proved unquantified. */
  bulletsWithoutMetrics: string[];
  suggestion: string;
}

export interface SectionCheck {
  name: string;
  present: boolean;
}

export interface JobMatchResult {
  /** 0-100 relevance of the resume against the target job description. */
  score: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  summary: string;
}

export interface AuditResult {
  atsScore: number;
  verdict: 'Tier-1 Ready' | 'Strong Contender' | 'Needs Polish' | 'High Risk';
  breakdown: Breakdown;
  executiveSummary: string;
  strengths: string[];
  criticalNegatives: string[];
  atsKeywordsFound: string[];
  missingRecommendedKeywords: string[];
  bulletImprovements: BulletImprovement[];
  actionPlan: string[];
  /** Present/absent critical contact fields required by a recruiter. */
  contactInfo?: ContactInfoCheck;
  /** Whether the resume quantifies impact with numbers, not just verbs. */
  quantifiedImpact?: QuantitativeImpactCheck;
  /** Standard resume sections the auditor could and could not find. */
  sections?: SectionCheck[];
  /** Skills the resume is missing that the candidate should consider. */
  talentGaps?: string[];
  /** Role-tailored interview questions a recruiter would ask from this resume. */
  interviewQuestions?: string[];
  /** Only present when the caller supplied a target job description. */
  jobMatch?: JobMatchResult;
  /** Heuristic sentence-density score computed server-side (0-100). */
  readabilityScore?: number;
}

export interface AuditOptions {
  resumeText: string;
  targetJobDescription?: string;
}

export interface AuditBufferResult {
  analysis: AuditResult;
  fileName: string;
  charCount: number;
  pageCount: number | null;
}

function fixBareKeys(str: string): string {
  return str.replace(/([{,\[]\s*|^\s*)([A-Za-z_$][A-Za-z0-9_$]*)(\s*:)/gm,
    (_match, pre, key, colon) => `${pre}"${key}"${colon}`
  );
}

function cleanTrailingCommas(str: string): string {
  return str.replace(/,\s*([\]}])/g, '$1');
}

function tryRepairTruncatedJson(str: string): string {
  let s = str.trim();
  s = s.replace(/,\s*$/, '');
  s = s.replace(/:\s*$/, ': null');
  s = s.replace(/("[^"\\]*(?:\\.[^"\\]*)*)$/, '');
  s = s.replace(/,\s*$/, '');

  let openBraces = 0;
  let openBrackets = 0;
  let inString = false;
  let escape = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === '\\') {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (ch === '{') openBraces++;
      else if (ch === '}') openBraces = Math.max(0, openBraces - 1);
      else if (ch === '[') openBrackets++;
      else if (ch === ']') openBrackets = Math.max(0, openBrackets - 1);
    }
  }

  if (inString) s += '"';
  s = cleanTrailingCommas(s);
  while (openBrackets > 0) {
    s += ']';
    openBrackets--;
  }
  while (openBraces > 0) {
    s += '}';
    openBraces--;
  }
  return cleanTrailingCommas(s);
}

function attemptParse(text: string | null): any {
  if (!text) return null;
  const candidates = [
    text,
    fixBareKeys(text),
    cleanTrailingCommas(text),
    cleanTrailingCommas(fixBareKeys(text)),
    tryRepairTruncatedJson(text),
    tryRepairTruncatedJson(fixBareKeys(text))
  ];
  for (const cand of candidates) {
    try {
      return JSON.parse(cand);
    } catch {}
  }
  return null;
}

function getVerdict(score: number): AuditResult['verdict'] {
  if (score >= 85) return 'Tier-1 Ready';
  if (score >= 70) return 'Strong Contender';
  if (score >= 55) return 'Needs Polish';
  return 'High Risk';
}

/** Tolerant numeric parse: accepts 87, "87", "87%", "87/100". NaN if absent. */
function parseScore(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const m = value.match(/-?\d+(\.\d+)?/);
    if (m) return Number(m[0]);
  }
  return NaN;
}

/** Coerce an unknown value into a capped string array; [] when not an array. */
function strArr(v: unknown, max = 8): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((s: unknown): s is string => typeof s === 'string').slice(0, max);
}

function parseContactInfo(raw: unknown): ContactInfoCheck | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const present = Array.isArray(o.present)
    ? (o.present as unknown[])
        .filter(
          (p): p is { label: string; value: string } =>
            !!p &&
            typeof (p as { label?: unknown }).label === 'string' &&
            typeof (p as { value?: unknown }).value === 'string'
        )
        .slice(0, 6)
    : [];
  const missing = strArr(o.missing, 6);
  if (present.length === 0 && missing.length === 0) return undefined;
  return {
    complete: Boolean(o.complete) || (present.length >= 3 && missing.length === 0),
    present,
    missing,
    suggestion: typeof o.suggestion === 'string' ? o.suggestion : '',
  };
}

function parseQuantifiedImpact(raw: unknown): QuantitativeImpactCheck | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const n = parseScore(o.detected);
  return {
    detected: Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0,
    bulletsWithoutMetrics: strArr(o.bulletsWithoutMetrics, 4),
    suggestion: typeof o.suggestion === 'string' ? o.suggestion : '',
  };
}

function parseSections(raw: unknown): SectionCheck[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((s: any) => s && typeof s.name === 'string' && typeof s.present === 'boolean')
    .slice(0, 12);
}

function parseJobMatch(raw: unknown): JobMatchResult | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const n = parseScore(o.score);
  if (!Number.isFinite(n) && !Array.isArray(o.matchedKeywords) && !Array.isArray(o.missingKeywords)) {
    return undefined;
  }
  return {
    score: Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0,
    matchedKeywords: strArr(o.matchedKeywords, 12),
    missingKeywords: strArr(o.missingKeywords, 12),
    summary: typeof o.summary === 'string' ? o.summary : '',
  };
}

/**
 * Server-side sentence-density heuristic (0-100). Long, run-on sentences make a
 * resume dense to read; a healthy resume averages ~12 words per sentence.
 */
function computeReadability(text: string): number {
  const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
  const words = text.split(/\s+/).filter((w) => w.trim().length > 0).length;
  if (sentences.length === 0 || words === 0) return 0;
  const avg = words / sentences.length;
  const penalty = Math.max(0, avg - 12.5);
  return Math.max(0, Math.min(100, Math.round(100 - penalty * 4)));
}

function normalizeAudit(audit: any, readability?: number): AuditResult {
  const parsedScore = parseScore(audit.atsScore);
  const atsScore = Number.isFinite(parsedScore)
    ? Math.max(0, Math.min(100, Math.round(parsedScore)))
    : 0;
  // Always derive the verdict from the score: trusting the model's free-text
  // verdict allowed "Tier-1 Ready" alongside a score of 40.
  const verdict = getVerdict(atsScore);
  const breakdown = audit.breakdown || {};
  const b = (v: unknown) => {
    const n = parseScore(v);
    return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0;
  };
  const jobMatch = parseJobMatch(audit.jobMatch);
  return {
    atsScore,
    verdict,
    breakdown: {
      impactAndMetrics: b(breakdown.impactAndMetrics),
      skillsRelevance: b(breakdown.skillsRelevance),
      actionVerbs: b(breakdown.actionVerbs),
      formattingAndClarity: b(breakdown.formattingAndClarity),
      experienceDepth: b(breakdown.experienceDepth),
    },
    executiveSummary: typeof audit.executiveSummary === 'string' ? audit.executiveSummary : '',
    strengths: strArr(audit.strengths, 8),
    criticalNegatives: strArr(audit.criticalNegatives, 8),
    atsKeywordsFound: strArr(audit.atsKeywordsFound, 10),
    missingRecommendedKeywords: strArr(audit.missingRecommendedKeywords, 10),
    bulletImprovements: Array.isArray(audit.bulletImprovements)
      ? audit.bulletImprovements
          .filter((b: any) => b && typeof b.original === 'string' && typeof b.improved === 'string')
          .map((b: any) => ({ original: b.original, improved: b.improved }))
          .slice(0, 5)
      : [],
    actionPlan: strArr(audit.actionPlan, 8),
    contactInfo: parseContactInfo(audit.contactInfo),
    quantifiedImpact: parseQuantifiedImpact(audit.quantifiedImpact),
    sections: parseSections(audit.sections),
    talentGaps: strArr(audit.talentGaps, 6),
    interviewQuestions: strArr(audit.interviewQuestions, 6),
    ...(jobMatch ? { jobMatch } : {}),
    ...(typeof readability === 'number' ? { readabilityScore: readability } : {}),
  };
}

export async function auditResume(options: AuditOptions): Promise<AuditResult> {
  const { resumeText, targetJobDescription = '' } = options;
  if (!resumeText || resumeText.trim().length < 50) {
    throw new Error('Resume content is too short or empty to analyze.');
  }

  const readability = computeReadability(resumeText);

  const prompt = `You are a Principal Tech Recruiter and Merciless Fortune 500 ATS Auditor. Perform a deep, strict, zero-leniency review of the resume. Return ONLY a valid JSON object with this structure:
{
  "atsScore": <integer 0-100>,
  "verdict": "<Tier-1 Ready | Strong Contender | Needs Polish | High Risk>",
  "breakdown": {
    "impactAndMetrics": <integer 0-100>,
    "skillsRelevance": <integer 0-100>,
    "actionVerbs": <integer 0-100>,
    "formattingAndClarity": <integer 0-100>,
    "experienceDepth": <integer 0-100>
  },
  "executiveSummary": "<2-3 sentences>",
  "strengths": ["<max 6 strengths>"],
  "criticalNegatives": ["<max 6 weaknesses>"],
  "atsKeywordsFound": ["<max 8 keywords actually present>"],
  "missingRecommendedKeywords": ["<max 8 important missing keywords>"],
  "bulletImprovements": [{ "original": "<exact bullet>", "improved": "<rewrite that quantifies impact>" }],
  "actionPlan": ["<max 6 concrete steps>"],
  "contactInfo": {
    "complete": <true/false>,
    "present": [{ "label": "Email|Phone|Location|LinkedIn|Portfolio|Name", "value": "<as written>" }],
    "missing": ["<critical field not found, e.g. LinkedIn>"],
    "suggestion": "<one sentence>"
  },
  "quantifiedImpact": {
    "detected": <integer count of bullets containing numbers/metrics>,
    "bulletsWithoutMetrics": ["<max 3 example bullets that make unquantified claims>"],
    "suggestion": "<one sentence on adding metrics>"
  },
  "sections": [{ "name": "Summary|Experience|Education|Skills|Projects|Certifications", "present": true/false }],
  "talentGaps": ["<max 5 high-value skills or credentials the role expects that are absent>"],
  "interviewQuestions": ["<max 5 sharp, resume-specific questions a recruiter would ask>"]${targetJobDescription ? `,
  "jobMatch": {
    "score": <integer 0-100 resume vs target job relevance>,
    "matchedKeywords": ["<keywords in both resume and job>"],
    "missingKeywords": ["<keywords the job demands but the resume lacks>"],
    "summary": "<2-3 sentences>"
  }` : ''}
}

Rules:
- BulletImprovements must quote the original exact bullet. Rewrite each improved bullet to lead with a strong verb and a quantified result.
- Keep every string crisp; do not pad lists.
- atsScore must reflect how an ATS + human screener would honestly grade this resume.

RESUME:
"""
${neutralize(resumeText, 25000)}
"""

${targetJobDescription ? `TARGET JOB:\n"""\n${neutralize(targetJobDescription, 10000)}\n"""` : ''}`;

  const response = await callAI(prompt);
  const rawText = typeof response === 'string' ? response : JSON.stringify(response);
  let cleaned = rawText.replace(/^﻿/, '').replace(/[​-‍﻿ ]/g, '').trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/im, '').replace(/\s*```\s*$/m, '').trim();

  const startIdx = cleaned.indexOf('{');
  const endIdx = cleaned.lastIndexOf('}');
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    throw new Error(`Failed to parse ATS analysis. Snippet: ${rawText.slice(0, 200)}`);
  }

  const parsed = attemptParse(cleaned.slice(startIdx, endIdx + 1));
  if (parsed && typeof parsed === 'object') {
    return normalizeAudit(parsed, readability);
  }

  const scoreMatch = cleaned.match(/"atsScore"\s*:\s*(\d+)/);
  if (scoreMatch) {
    // `(\d+)` guarantees a valid number — including a legitimate 0, which the
    // old `|| 80` coerced into a fabricated 80-point audit.
    const fallbackScore = Number(scoreMatch[1]);
    return normalizeAudit({ atsScore: fallbackScore }, readability);
  }

  throw new Error(`Audit JSON parse failed. Snippet: ${cleaned.slice(0, 240)}`);
}

export async function auditResumeBuffer(
  fileBuffer: Buffer,
  originalName: string,
  targetJobDescription = ''
): Promise<AuditBufferResult> {
  const extraction = await extractText(fileBuffer, originalName);
  if (!extraction || !extraction.text || extraction.text.trim().length < 50) {
    throw new Error(extraction?.error || 'Could not extract readable text from this file.');
  }

  const analysis = await auditResume({ resumeText: extraction.text, targetJobDescription });
  return {
    analysis,
    fileName: originalName,
    charCount: extraction.text.length,
    pageCount: extraction.pageCount || 1,
  };
}

export function buildAuditReportPdfBuffer(audit: AuditResult, resumeFileName = 'Resume'): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margins: { top: 40, bottom: 40, left: 45, right: 45 } });
      const buffers: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err: Error) => reject(err));

      const scoreColor = audit.atsScore >= 85 ? '#10b981' : audit.atsScore >= 70 ? '#f59e0b' : '#ef4444';
      doc.font('Helvetica-Bold').fontSize(18).fillColor('#0f172a').text('ATS Resume Audit Report', { align: 'center' });
      doc.font('Helvetica').fontSize(9.5).fillColor('#64748b').text(`Document: ${resumeFileName}  |  Generated: ${new Date().toLocaleDateString()}`, { align: 'center' });
      doc.moveDown(0.8);

      doc.font('Helvetica-Bold').fontSize(26).fillColor(scoreColor).text(`${audit.atsScore}%`, 45, doc.y);
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a').text(`VERDICT: ${audit.verdict}`, 140, doc.y - 30);
      doc.moveDown(2);

      doc.font('Helvetica-Bold').fontSize(12).fillColor('#0f172a').text('Executive Summary');
      doc.font('Helvetica').fontSize(9).fillColor('#334155').text(audit.executiveSummary || 'No summary available.');
      doc.moveDown(1);

      doc.font('Helvetica-Bold').fontSize(12).fillColor('#0f172a').text('Breakdown');
      const labels: Record<string, string> = {
        impactAndMetrics: 'Impact & Metrics',
        skillsRelevance: 'Skills Relevance',
        actionVerbs: 'Action Verbs',
        formattingAndClarity: 'Formatting & Clarity',
        experienceDepth: 'Experience Depth',
      };
      for (const [k, v] of Object.entries(audit.breakdown)) {
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#0f172a').text(`${labels[k] || k}: `, { continued: true });
        doc.font('Helvetica').fillColor('#334155').text(`${v}%`);
      }
      if (typeof audit.readabilityScore === 'number') {
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#0f172a').text('Readability (sentence density): ', { continued: true });
        doc.font('Helvetica').fillColor('#334155').text(`${audit.readabilityScore}%`);
      }
      if (audit.jobMatch && typeof audit.jobMatch.score === 'number') {
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#0f172a').text('Job Match (target JD): ', { continued: true });
        doc.font('Helvetica').fillColor('#334155').text(`${audit.jobMatch.score}%`);
      }
      doc.moveDown(1);

      if (audit.contactInfo) {
        doc.font('Helvetica-Bold').fontSize(12).fillColor('#0f172a').text(`Contact Info ${audit.contactInfo.complete ? '(Complete)' : '(Incomplete)'}`);
        audit.contactInfo.present.forEach((p) => doc.font('Helvetica').fontSize(9).fillColor('#059669').text(`  • ${p.label}: ${p.value}`));
        if (audit.contactInfo.missing.length > 0) {
          doc.font('Helvetica').fontSize(9).fillColor('#dc2626').text(`  ✗ Missing: ${audit.contactInfo.missing.join(', ')}`);
        }
        if (audit.contactInfo.suggestion) doc.font('Helvetica').fontSize(9).fillColor('#334155').text(`  → ${audit.contactInfo.suggestion}`);
        doc.moveDown(1);
      }

      if (audit.quantifiedImpact) {
        doc.font('Helvetica-Bold').fontSize(12).fillColor('#0f172a').text('Quantified Impact');
        doc.font('Helvetica').fontSize(9).fillColor('#334155').text(`  Bullets containing concrete metrics: ${audit.quantifiedImpact.detected}`);
        audit.quantifiedImpact.bulletsWithoutMetrics.forEach((bl) => doc.font('Helvetica').fontSize(9).fillColor('#f59e0b').text(`  • ${bl}`));
        if (audit.quantifiedImpact.suggestion) doc.font('Helvetica').fontSize(9).fillColor('#334155').text(`  → ${audit.quantifiedImpact.suggestion}`);
        doc.moveDown(1);
      }

      if (audit.sections && audit.sections.length > 0) {
        doc.font('Helvetica-Bold').fontSize(12).fillColor('#0f172a').text('Sections Detected');
        audit.sections.forEach((s) => doc.font('Helvetica').fontSize(9).fillColor(s.present ? '#059669' : '#dc2626').text(`  ${s.present ? '✓' : '✗'} ${s.name}`));
        doc.moveDown(1);
      }

      if (audit.jobMatch) {
        doc.font('Helvetica-Bold').fontSize(12).fillColor('#0f172a').text('Job Match Detail');
        if (audit.jobMatch.summary) doc.font('Helvetica').fontSize(9).fillColor('#334155').text(`  ${audit.jobMatch.summary}`);
        if (audit.jobMatch.matchedKeywords.length > 0) {
          doc.font('Helvetica-Bold').fontSize(9).fillColor('#059669').text('  Matched: ');
          doc.font('Helvetica').fontSize(9).fillColor('#334155').text(` ${audit.jobMatch.matchedKeywords.join(', ')}`);
        }
        if (audit.jobMatch.missingKeywords.length > 0) {
          doc.font('Helvetica-Bold').fontSize(9).fillColor('#dc2626').text('  Missing: ');
          doc.font('Helvetica').fontSize(9).fillColor('#334155').text(` ${audit.jobMatch.missingKeywords.join(', ')}`);
        }
        doc.moveDown(1);
      }

      if (audit.talentGaps && audit.talentGaps.length > 0) {
        doc.font('Helvetica-Bold').fontSize(12).fillColor('#0f172a').text('Talent Gaps');
        audit.talentGaps.forEach((g) => doc.font('Helvetica').fontSize(9).fillColor('#f59e0b').text(`  • ${g}`));
        doc.moveDown(1);
      }

      doc.font('Helvetica-Bold').fontSize(12).fillColor('#0f172a').text('Strengths');
      audit.strengths.forEach((s) => doc.font('Helvetica').fontSize(9).fillColor('#059669').text(`  • ${s}`));
      doc.moveDown(1);

      doc.font('Helvetica-Bold').fontSize(12).fillColor('#0f172a').text('Critical Negatives');
      audit.criticalNegatives.forEach((n) => doc.font('Helvetica').fontSize(9).fillColor('#dc2626').text(`  • ${n}`));
      doc.moveDown(1);

      if (audit.interviewQuestions && audit.interviewQuestions.length > 0) {
        doc.font('Helvetica-Bold').fontSize(12).fillColor('#0f172a').text('Likely Interview Questions');
        audit.interviewQuestions.forEach((q, i) => doc.font('Helvetica').fontSize(9).fillColor('#334155').text(`  ${i + 1}. ${q}`));
        doc.moveDown(1);
      }

      doc.font('Helvetica-Bold').fontSize(12).fillColor('#0f172a').text('Action Plan');
      audit.actionPlan.forEach((step, i) => doc.font('Helvetica').fontSize(9).fillColor('#334155').text(`  ${i + 1}. ${step}`));

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}