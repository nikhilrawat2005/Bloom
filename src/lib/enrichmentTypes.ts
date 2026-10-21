// Shared types for profile link enrichment (GitHub + coding platforms).
// These shapes are produced server-side by `profileEnrichmentService`, persisted
// by the client into `profile_enrichment/{uid}`, and rendered on the Performance
// Tracker. The normalizer is deliberately tolerant: it accepts whatever the
// server (or an older cached document) hands it and never throws.

export interface GithubRepo {
  name: string;
  fullName: string;
  url: string;
  description: string;
  homepage: string;
  language: string;
  topics: string[];
  stars: number;
  forks: number;
  watchers: number;
  openIssues: number;
  commits: number | null;
  createdAt: string;
  pushedAt: string;
  isFork: boolean;
  archived: boolean;
  review: string;
}

export interface GithubProfileSummary {
  username: string;
  name: string;
  bio: string;
  avatarUrl: string;
  profileUrl: string;
  company: string;
  location: string;
  blog: string;
  publicRepos: number;
  followers: number;
  following: number;
  totalStars: number;
  totalForks: number;
  totalCommits: number | null;
  topLanguages: string[];
  repos: GithubRepo[];
  fetchedAt: string;
}

export interface CodingStat {
  platform: string;
  url: string;
  handle: string;
  available: boolean;
  rating: number | null;
  maxRating: number | null;
  rank: string;
  problemsSolved: number | null;
  contests: number | null;
  stars: number | null;
  note: string;
}

export interface ProfileEnrichment {
  github: GithubProfileSummary | null;
  githubError: string;
  coding: CodingStat[];
  updatedAt: string;
}

function str(v: unknown, max = 600): string {
  return typeof v === 'string' ? v.slice(0, max) : '';
}

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : 0;
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function strList(v: unknown, max = 20): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).slice(0, max);
}

function normalizeRepo(raw: any): GithubRepo {
  return {
    name: str(raw?.name, 200),
    fullName: str(raw?.fullName, 240),
    url: str(raw?.url, 500),
    description: str(raw?.description, 1200),
    homepage: str(raw?.homepage, 500),
    language: str(raw?.language, 60),
    topics: strList(raw?.topics, 20),
    stars: num(raw?.stars),
    forks: num(raw?.forks),
    watchers: num(raw?.watchers),
    openIssues: num(raw?.openIssues),
    commits: numOrNull(raw?.commits),
    createdAt: str(raw?.createdAt, 40),
    pushedAt: str(raw?.pushedAt, 40),
    isFork: raw?.isFork === true,
    archived: raw?.archived === true,
    review: str(raw?.review, 1200),
  };
}

function normalizeGithub(raw: any): GithubProfileSummary | null {
  if (!raw || typeof raw !== 'object') return null;
  const username = str(raw.username, 80);
  if (!username) return null;
  return {
    username,
    name: str(raw.name, 120),
    bio: str(raw.bio, 600),
    avatarUrl: str(raw.avatarUrl, 500),
    profileUrl: str(raw.profileUrl, 500),
    company: str(raw.company, 120),
    location: str(raw.location, 120),
    blog: str(raw.blog, 300),
    publicRepos: num(raw.publicRepos),
    followers: num(raw.followers),
    following: num(raw.following),
    totalStars: num(raw.totalStars),
    totalForks: num(raw.totalForks),
    totalCommits: numOrNull(raw.totalCommits),
    topLanguages: strList(raw.topLanguages, 12),
    repos: Array.isArray(raw.repos) ? raw.repos.slice(0, 40).map(normalizeRepo) : [],
    fetchedAt: str(raw.fetchedAt, 40),
  };
}

function normalizeCoding(raw: any): CodingStat {
  return {
    platform: str(raw?.platform, 60),
    url: str(raw?.url, 500),
    handle: str(raw?.handle, 80),
    available: raw?.available === true,
    rating: numOrNull(raw?.rating),
    maxRating: numOrNull(raw?.maxRating),
    rank: str(raw?.rank, 80),
    problemsSolved: numOrNull(raw?.problemsSolved),
    contests: numOrNull(raw?.contests),
    stars: numOrNull(raw?.stars),
    note: str(raw?.note, 400),
  };
}

export function normalizeProfileEnrichment(raw: unknown): ProfileEnrichment {
  const r = (raw && typeof raw === 'object' ? raw : {}) as any;
  return {
    github: normalizeGithub(r.github),
    githubError: str(r.githubError, 400),
    coding: Array.isArray(r.coding) ? r.coding.slice(0, 12).map(normalizeCoding) : [],
    updatedAt: str(r.updatedAt, 40) || new Date().toISOString(),
  };
}
