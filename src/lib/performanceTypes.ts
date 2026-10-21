// ---------------------------------------------------------------------------
// Performance Tracker — shared shapes.
//
// The tracker reads everything a student has stored (wallet documents, saved
// opportunities, profile, and enriched GitHub/coding links) and asks the AI to
// produce a full, evidence-backed *qualitative* profile of the person: their
// honed skills, plus points, the gaps to close, and which career lines fit them
// best. There are deliberately NO invented scores here — stars, commits,
// platform ratings and the resume ATS score are real facts shown elsewhere; the
// AI only contributes words.
// ---------------------------------------------------------------------------

export interface PerformanceTrait {
  name: string;
  /** The wallet/profile/repo evidence this judgement is based on. */
  evidence: string;
}

export interface PerformanceSkill {
  name: string;
  evidence: string;
}

export interface CareerPathFit {
  title: string;
  /** Why this career line suits the person. */
  reason: string;
  steps: string[];
}

export interface RoleFit {
  opportunityId?: string;
  title: string;
  organization: string;
  category: string;
  /** The specific role inside this opportunity that suits them best. */
  bestRole: string;
  reason: string;
  matchedSkills: string[];
  missingSkills: string[];
}

export interface PerformanceEvidenceDoc {
  document: string;
  highlight: string;
}

export interface PerformanceAssessment {
  /** Short persona label, e.g. "Emerging Full-Stack Builder". */
  profileTitle: string;
  /** 2-3 sentence holistic summary of the person. */
  summary: string;
  traits: PerformanceTrait[];
  skills: PerformanceSkill[];
  /** "Plus points" — what is genuinely strong about this person. */
  plusPoints: string[];
  /** Honest gaps holding them back. */
  gaps: string[];
  /** Which lines/fields they can move into, best first. */
  careerPaths: CareerPathFit[];
  /** How they fit each opportunity they saved for later. */
  roleFit: RoleFit[];
  evidenceHighlights: PerformanceEvidenceDoc[];
  nextActions: string[];
  generatedAt?: string;
}

/**
 * Per-saved-opportunity qualitative match (Opportunity Matcher). No scores: the
 * model states which of the student's real traits are plus points, what is
 * missing, what to do about it, and the role that fits best.
 */
export interface SavedOpportunityMatch {
  opportunityId?: string;
  title: string;
  organization: string;
  category: string;
  summary: string;
  plusPoints: string[];
  gaps: string[];
  actions: string[];
  bestRole: string;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function strList(v: unknown, max = 12): string[] {
  return Array.isArray(v)
    ? v.filter((s): s is string => typeof s === "string" && s.trim().length > 0).slice(0, max)
    : [];
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

/**
 * Coerces whatever the model returned into a well-formed assessment. Anything
 * missing becomes an empty list rather than a crash.
 */
export function normalizePerformanceAssessment(raw: unknown): PerformanceAssessment {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

  const traits: PerformanceTrait[] = asArray(r.traits)
    .map((t) => {
      const o = (t ?? {}) as Record<string, unknown>;
      return {
        name: str(o.name) || str(o.trait) || str(o.label),
        evidence: str(o.evidence) || str(o.reason),
      };
    })
    .filter((t) => t.name)
    .slice(0, 10);

  const skills: PerformanceSkill[] = asArray(r.skills)
    .map((s) => {
      const o = (s ?? {}) as Record<string, unknown>;
      return {
        name: str(o.name) || str(o.skill),
        evidence: str(o.evidence) || str(o.reason),
      };
    })
    .filter((s) => s.name)
    .slice(0, 16);

  const careerPaths: CareerPathFit[] = asArray(r.careerPaths)
    .map((c) => {
      const o = (c ?? {}) as Record<string, unknown>;
      return {
        title: str(o.title) || str(o.field) || str(o.path),
        reason: str(o.reason) || str(o.why),
        steps: strList(o.steps, 6),
      };
    })
    .filter((c) => c.title)
    .slice(0, 5);

  const roleFit: RoleFit[] = asArray(r.roleFit)
    .map((c) => {
      const o = (c ?? {}) as Record<string, unknown>;
      return {
        opportunityId: str(o.opportunityId) || undefined,
        title: str(o.title),
        organization: str(o.organization) || str(o.orgName),
        category: str(o.category),
        bestRole: str(o.bestRole) || str(o.role),
        reason: str(o.reason),
        matchedSkills: strList(o.matchedSkills, 10),
        missingSkills: strList(o.missingSkills, 10),
      };
    })
    .filter((c) => c.title)
    .slice(0, 20);

  const evidenceHighlights: PerformanceEvidenceDoc[] = asArray(r.evidenceHighlights)
    .map((e) => {
      const o = (e ?? {}) as Record<string, unknown>;
      return {
        document: str(o.document) || str(o.name),
        highlight: str(o.highlight) || str(o.note),
      };
    })
    .filter((e) => e.document || e.highlight)
    .slice(0, 10);

  return {
    profileTitle: str(r.profileTitle) || str(r.persona) || str(r.title),
    summary: str(r.summary) || str(r.executiveSummary),
    traits,
    skills,
    plusPoints: strList(r.plusPoints, 12),
    gaps: strList(r.gaps ?? r.weaknesses ?? r.improvementAreas, 12),
    careerPaths,
    roleFit,
    evidenceHighlights,
    nextActions: strList(r.nextActions ?? r.actionPlan, 10),
    generatedAt: new Date().toISOString(),
  };
}

/** Coerces the matcher response into well-formed per-opportunity matches. */
export function normalizeSavedOpportunityMatches(raw: unknown): SavedOpportunityMatch[] {
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as Record<string, unknown>)?.matches)
      ? ((raw as Record<string, unknown>).matches as unknown[])
      : [];

  return list
    .map((m) => {
      const o = (m ?? {}) as Record<string, unknown>;
      return {
        opportunityId: str(o.opportunityId) || undefined,
        title: str(o.title),
        organization: str(o.organization) || str(o.orgName),
        category: str(o.category),
        summary: str(o.summary),
        plusPoints: strList(o.plusPoints ?? o.strengths, 10),
        gaps: strList(o.gaps ?? o.missingSkills ?? o.weaknesses, 10),
        actions: strList(o.actions ?? o.nextActions ?? o.actionPlan, 10),
        bestRole: str(o.bestRole) || str(o.role),
      };
    })
    .filter((m) => m.title);
}
