// This file previously held ~15 hardcoded sample opportunities used as
// placeholder/demo data before the real ingestion pipeline existed.
//
// That static list has been removed (see discussion: platform now sources
// real opportunities via src/lib/ingestion — trusted RSS/API feeds +
// reviewed scraped listings — plus organization-posted entries, all stored
// in Firestore's "org_opportunities" collection).
//
// The `Opportunity` type is kept here because many components still import
// it. `mockOpportunities` is kept as an empty array for backward
// compatibility with any code that hasn't been updated yet — it no longer
// contributes any fake data.

export interface Opportunity {
  id: string;
  title: string;
  organization: string;
  /** Schema-drift twin of `organization` — ingestion writes only this field. */
  orgName?: string;
  description: string;
  eligibility: string;
  deadline: string;
  country: string;
  state?: string;
  category: "Scholarships" | "Fellowships" | "Internships" | "Conferences" | "Hackathons" | "STEM Programs" | "Research Programs" | "Exchange Programs" | "Research" | "Workshops";
  applyLink: string;
  requiredDocuments: string[];
  field: string;
  incomeLimit?: number;
  degreeLevel?: string;
}

/** @deprecated No longer populated. Real data comes from Firestore via useOpportunities() / getAllOpportunitiesOnce(). */
export const mockOpportunities: Opportunity[] = [];

/**
 * Normalizes a raw Firestore `org_opportunities` document.
 *
 * Two writers disagree on the org field: the ingestion pipeline stores only
 * `orgName`, organization-posted and seeded entries store `organization`.
 * Both are collapsed into `organization` here so every consumer can read
 * `.organization` without a fallback. The Firestore document id always wins
 * over any stored `id` field (the seed script writes one).
 */
export function normalizeOpportunityDoc(id: string, data: Record<string, unknown>): Opportunity {
  const org =
    (typeof data.organization === "string" && data.organization.trim()) ||
    (typeof data.orgName === "string" && data.orgName.trim()) ||
    "";
  return { ...data, organization: org, orgName: org, id } as unknown as Opportunity;
}
