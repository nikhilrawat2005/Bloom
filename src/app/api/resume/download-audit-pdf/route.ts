import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/serverAuth';
import { buildAuditReportPdfBuffer, type AuditResult } from '@/lib/services/resumeAnalyzerService';

export const runtime = 'nodejs';

const VERDICTS: readonly string[] = [
  'Tier-1 Ready',
  'Strong Contender',
  'Needs Polish',
  'High Risk',
];

const MAX_LIST_ITEMS = 40;
const MAX_ITEM_CHARS = 500;
const MAX_SUMMARY_CHARS = 4000;
const MAX_FILE_NAME_CHARS = 100;

function strList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .slice(0, MAX_LIST_ITEMS)
    .map((item) => item.trim().slice(0, MAX_ITEM_CHARS))
    .filter(Boolean);
}

function clampScore(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n)));
}

function boolValue(value: unknown): boolean {
  return value === true || value === 'true' || value === 1;
}

function sanitizeContactInfo(raw: unknown): AuditResult['contactInfo'] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const present = Array.isArray(o.present)
    ? (o.present as unknown[])
        .filter((p: any) => p && typeof p.label === 'string' && typeof p.value === 'string')
        .slice(0, 6)
        .map((p: any) => ({ label: p.label.slice(0, 30), value: p.value.slice(0, MAX_ITEM_CHARS) }))
    : [];
  const missing = strList(o.missing).slice(0, 6);
  if (present.length === 0 && missing.length === 0) return undefined;
  return {
    complete: boolValue(o.complete) || (present.length >= 3 && missing.length === 0),
    present,
    missing,
    suggestion: typeof o.suggestion === 'string' ? o.suggestion.slice(0, MAX_SUMMARY_CHARS) : '',
  };
}

function sanitizeQuantifiedImpact(raw: unknown): AuditResult['quantifiedImpact'] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  return {
    detected: Number.isFinite(Number(o.detected)) ? Math.max(0, Math.round(Number(o.detected))) : 0,
    bulletsWithoutMetrics: strList(o.bulletsWithoutMetrics).slice(0, 4),
    suggestion: typeof o.suggestion === 'string' ? o.suggestion.slice(0, MAX_SUMMARY_CHARS) : '',
  };
}

function sanitizeSections(raw: unknown): AuditResult['sections'] {
  if (!Array.isArray(raw)) return undefined;
  const sections = raw
    .filter((s: any) => s && typeof s.name === 'string' && typeof s.present === 'boolean')
    .slice(0, 12)
    .map((s: any) => ({ name: s.name.slice(0, 40), present: s.present }));
  return sections.length > 0 ? sections : undefined;
}

function sanitizeJobMatch(raw: unknown): AuditResult['jobMatch'] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  return {
    score: clampScore(o.score),
    matchedKeywords: strList(o.matchedKeywords).slice(0, 12),
    missingKeywords: strList(o.missingKeywords).slice(0, 12),
    summary: typeof o.summary === 'string' ? o.summary.slice(0, MAX_SUMMARY_CHARS) : '',
  };
}

function verdictFor(score: number): AuditResult['verdict'] {
  if (score >= 85) return 'Tier-1 Ready';
  if (score >= 70) return 'Strong Contender';
  if (score >= 55) return 'Needs Polish';
  return 'High Risk';
}

/**
 * The audit object arrives from the client (localStorage), so treat every
 * field as untrusted: coerce types, clamp scores and cap list sizes before
 * pdfkit renders it. Otherwise a malformed object crashes the render or a
 * caller ships unbounded content into the generated PDF.
 */
function sanitizeAudit(raw: unknown): AuditResult | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const input = raw as Record<string, unknown>;

  const atsScore = clampScore(input.atsScore);
  const rawBreakdown =
    input.breakdown && typeof input.breakdown === 'object' && !Array.isArray(input.breakdown)
      ? (input.breakdown as Record<string, unknown>)
      : {};
  const breakdown: AuditResult['breakdown'] = {
    impactAndMetrics: clampScore(rawBreakdown.impactAndMetrics),
    skillsRelevance: clampScore(rawBreakdown.skillsRelevance),
    actionVerbs: clampScore(rawBreakdown.actionVerbs),
    formattingAndClarity: clampScore(rawBreakdown.formattingAndClarity),
    experienceDepth: clampScore(rawBreakdown.experienceDepth),
  };

  const verdict = VERDICTS.includes(String(input.verdict))
    ? (input.verdict as AuditResult['verdict'])
    : verdictFor(atsScore);

  return {
    atsScore,
    verdict,
    breakdown,
    executiveSummary:
      typeof input.executiveSummary === 'string'
        ? input.executiveSummary.trim().slice(0, MAX_SUMMARY_CHARS)
        : '',
    strengths: strList(input.strengths),
    criticalNegatives: strList(input.criticalNegatives),
    atsKeywordsFound: strList(input.atsKeywordsFound),
    missingRecommendedKeywords: strList(input.missingRecommendedKeywords),
    bulletImprovements: [],
    actionPlan: strList(input.actionPlan),
    contactInfo: sanitizeContactInfo(input.contactInfo),
    quantifiedImpact: sanitizeQuantifiedImpact(input.quantifiedImpact),
    sections: sanitizeSections(input.sections),
    talentGaps: strList(input.talentGaps).slice(0, 6),
    interviewQuestions: strList(input.interviewQuestions).slice(0, 6),
    ...(input.jobMatch ? { jobMatch: sanitizeJobMatch(input.jobMatch) } : {}),
    ...(typeof input.readabilityScore !== 'undefined'
      ? { readabilityScore: clampScore(input.readabilityScore) }
      : {}),
  };
}

export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json().catch(() => null);
    const audit = sanitizeAudit(body?.audit);
    if (!audit) {
      return NextResponse.json(
        { error: 'Audit data is required to generate report PDF.' },
        { status: 400 }
      );
    }
    const rawName =
      typeof body?.fileName === 'string' && body.fileName.trim()
        ? body.fileName.trim().slice(0, MAX_FILE_NAME_CHARS)
        : 'Resume';

    const buffer = await buildAuditReportPdfBuffer(audit, rawName);
    const safeName = rawName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80) || 'Resume';
    const response = new NextResponse(buffer as any);
    response.headers.set('Content-Type', 'application/pdf');
    response.headers.set('Content-Disposition', `attachment; filename="${safeName}_ATS_Report.pdf"`);
    response.headers.set('Content-Length', buffer.length.toString());
    return response;
  } catch (err) {
    console.error('[ResumeAPI] Download audit PDF error:', err);
    // Never surface internal error details (pdfkit paths etc.) to the caller.
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
  }
}
