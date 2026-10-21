// Server-only profile-link enrichment.
//
// Visits the links a student saved (GitHub, Codeforces, LeetCode, ...) and turns
// them into structured, factual data: repos with stars/forks/commits, total
// stars, language mix, and competitive-programming stats. Like wallet documents
// are analysed to learn what they are, links are visited to learn which platform
// they are and what the person has actually built.
//
// Everything here is best-effort and time-bounded: one slow or blocked platform
// must never fail the whole enrichment. Real facts only — no scores.

import { AIRouterService } from '../aiProviders';
import type {
  CodingStat,
  GithubProfileSummary,
  GithubRepo,
  ProfileEnrichment,
} from '../enrichmentTypes';

const MAX_REPOS = 30;
const MAX_REVIEW_REPOS = 15;
const REPO_CONCURRENCY = 5;

function githubTimeoutMs(): number {
  const raw = Number(process.env.GITHUB_FETCH_TIMEOUT_MS);
  return Number.isFinite(raw) && raw >= 1_000 ? raw : 10_000;
}

function codingTimeoutMs(): number {
  const raw = Number(process.env.CODING_FETCH_TIMEOUT_MS);
  return Number.isFinite(raw) && raw >= 1_000 ? raw : 10_000;
}

function boundedTimeout(preferred: number, deadline: number): number {
  return Math.max(1_000, Math.min(preferred, deadline - Date.now()));
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Runs `fn` over `items` with at most `limit` in flight at once. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = new Array(Math.max(1, Math.min(limit, items.length))).fill(0).map(async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

// ───────────────────────────── GitHub ─────────────────────────────

const GH_RESERVED = new Set([
  'orgs', 'settings', 'features', 'topics', 'collections', 'sponsors', 'about',
  'pricing', 'marketplace', 'explore', 'login', 'signup', 'apps', 'contact',
  'search', 'notifications', 'issues', 'pulls', 'trending',
]);

export function isGithubUrl(url: string): boolean {
  return /(^|\.)github\.com/i.test(safeHost(url));
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

export function githubUsernameFromUrl(url: string): string | null {
  if (!isGithubUrl(url)) return null;
  try {
    const segments = new URL(url).pathname.split('/').filter(Boolean);
    if (segments.length === 0) return null;
    const name = segments[0];
    if (GH_RESERVED.has(name.toLowerCase())) return null;
    return name;
  } catch {
    return null;
  }
}

/** Last path segment, used to pull a handle out of a platform profile URL. */
function lastPathSegment(url: string): string {
  try {
    const segments = new URL(url).pathname.split('/').filter(Boolean);
    return segments.length ? segments[segments.length - 1] : '';
  } catch {
    return '';
  }
}

interface GhResult {
  ok: boolean;
  status: number;
  data: any;
  link: string | null;
  error: string;
}

function ghHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'NEXORA-Profile-Enrichment',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  const token = process.env.GITHUB_TOKEN;
  if (token && token.trim().length > 0) headers.Authorization = `Bearer ${token.trim()}`;
  return headers;
}

async function ghFetch(path: string, deadline: number): Promise<GhResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), boundedTimeout(githubTimeoutMs(), deadline));
  try {
    const res = await fetch(`https://api.github.com${path}`, { headers: ghHeaders(), signal: controller.signal });
    const text = await res.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    return { ok: res.ok, status: res.status, data, link: res.headers.get('link'), error: '' };
  } catch (err) {
    return { ok: false, status: 0, data: null, link: null, error: message(err) };
  } finally {
    clearTimeout(timer);
  }
}

function parseLastPage(link: string | null): number | null {
  if (!link) return null;
  const m = link.match(/[?&]page=(\d+)>[^,]*;\s*rel="last"/);
  return m ? Number(m[1]) : null;
}

function mapRepoJson(raw: any, username: string): GithubRepo {
  return {
    name: typeof raw?.name === 'string' ? raw.name : '',
    fullName: typeof raw?.full_name === 'string' ? raw.full_name : `${username}/${raw?.name || ''}`,
    url: typeof raw?.html_url === 'string' ? raw.html_url : '',
    description: typeof raw?.description === 'string' ? raw.description : '',
    homepage: typeof raw?.homepage === 'string' ? raw.homepage : '',
    language: typeof raw?.language === 'string' ? raw.language : '',
    topics: Array.isArray(raw?.topics) ? raw.topics.filter((t: unknown): t is string => typeof t === 'string').slice(0, 20) : [],
    stars: Number(raw?.stargazers_count) || 0,
    forks: Number(raw?.forks_count) || 0,
    watchers: Number(raw?.watchers_count) || 0,
    openIssues: Number(raw?.open_issues_count) || 0,
    commits: null,
    createdAt: typeof raw?.created_at === 'string' ? raw.created_at : '',
    pushedAt: typeof raw?.pushed_at === 'string' ? raw.pushed_at : '',
    isFork: raw?.fork === true,
    archived: raw?.archived === true,
    review: '',
  };
}

async function fetchCommitCount(username: string, repo: GithubRepo, defaultBranch: string, deadline: number): Promise<number | null> {
  const branch = defaultBranch || 'main';
  const res = await ghFetch(`/repos/${username}/${repo.name}/commits?per_page=1&sha=${encodeURIComponent(branch)}`, deadline);
  if (!res.ok) return null;
  const last = parseLastPage(res.link);
  if (last !== null) return last;
  // No Link header means a single page: the array length is the commit count.
  if (Array.isArray(res.data)) return res.data.length;
  return null;
}

export async function fetchGithubProfile(username: string, deadline: number): Promise<GithubProfileSummary> {
  const userRes = await ghFetch(`/users/${encodeURIComponent(username)}`, deadline);
  if (!userRes.ok) {
    if (userRes.status === 404) throw new Error(`GitHub user "${username}" was not found.`);
    if (userRes.status === 403 || userRes.status === 429) {
      throw new Error('GitHub API rate limit reached. Add a GITHUB_TOKEN to raise the limit and retry.');
    }
    throw new Error(`GitHub profile request failed (HTTP ${userRes.status}${userRes.error ? ` - ${userRes.error}` : ''}).`);
  }

  const reposRes = await ghFetch(`/users/${encodeURIComponent(username)}/repos?per_page=100&sort=updated&type=owner`, deadline);
  if (!reposRes.ok || !Array.isArray(reposRes.data)) {
    throw new Error(`GitHub repository request failed (HTTP ${reposRes.status}${reposRes.error ? ` - ${reposRes.error}` : ''}).`);
  }

  const allRepos: GithubRepo[] = reposRes.data.map((r: any) => mapRepoJson(r, username));

  // Totals are computed over the full fetched set (up to 100 repos).
  const totalStars = allRepos.reduce((acc, r) => acc + r.stars, 0);
  const totalForks = allRepos.reduce((acc, r) => acc + r.forks, 0);

  const languageCounts = new Map<string, number>();
  for (const r of allRepos) {
    if (r.language) languageCounts.set(r.language, (languageCounts.get(r.language) || 0) + 1);
  }
  const topLanguages = Array.from(languageCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([lang]) => lang);

  // Prioritise the most interesting repos for the visible list + reviews.
  const ranked = [...allRepos].sort((a, b) => {
    if (b.stars !== a.stars) return b.stars - a.stars;
    return (b.pushedAt || '').localeCompare(a.pushedAt || '');
  });
  const repos = ranked.slice(0, MAX_REPOS);

  // Commit counts are one request per repo: cap it, and lower the cap hard when
  // no token is configured (unauthenticated GitHub allows only 60 req/hour).
  const authed = Boolean(process.env.GITHUB_TOKEN && process.env.GITHUB_TOKEN.trim().length > 0);
  const commitBudget = authed ? 25 : 8;
  const commitTargets = repos.filter((r) => !r.isFork).slice(0, commitBudget);
  const branchByRepo = new Map<string, string>();
  for (const raw of reposRes.data) {
    if (raw && typeof raw.name === 'string') branchByRepo.set(raw.name, typeof raw.default_branch === 'string' ? raw.default_branch : 'main');
  }

  const counts = await mapLimit(commitTargets, REPO_CONCURRENCY, (repo) =>
    fetchCommitCount(username, repo, branchByRepo.get(repo.name) || 'main', deadline)
  );
  commitTargets.forEach((repo, i) => {
    repo.commits = counts[i];
  });

  const totalCommits = commitTargets.reduce((acc, r) => acc + (typeof r.commits === 'number' ? r.commits : 0), 0);

  return {
    username: typeof userRes.data?.login === 'string' ? userRes.data.login : username,
    name: typeof userRes.data?.name === 'string' ? userRes.data.name : '',
    bio: typeof userRes.data?.bio === 'string' ? userRes.data.bio : '',
    avatarUrl: typeof userRes.data?.avatar_url === 'string' ? userRes.data.avatar_url : '',
    profileUrl: typeof userRes.data?.html_url === 'string' ? userRes.data.html_url : `https://github.com/${username}`,
    company: typeof userRes.data?.company === 'string' ? userRes.data.company : '',
    location: typeof userRes.data?.location === 'string' ? userRes.data.location : '',
    blog: typeof userRes.data?.blog === 'string' ? userRes.data.blog : '',
    publicRepos: Number(userRes.data?.public_repos) || allRepos.length,
    followers: Number(userRes.data?.followers) || 0,
    following: Number(userRes.data?.following) || 0,
    totalStars,
    totalForks,
    totalCommits: commitTargets.length > 0 ? totalCommits : null,
    topLanguages,
    repos,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Turn whatever the model returned into a `{ repoName: review }` map. The
 * response is accepted as a parsed object (JSON mode), a raw string (plain
 * mode), or an embedded JSON blob inside prose. `name :: review` lines are the
 * last resort, because a well-behaved model in plain mode emits exactly that.
 */
function coerceReviews(res: unknown, candidates: GithubRepo[]): Record<string, string> {
  const out: Record<string, string> = {};
  const push = (name: unknown, review: unknown) => {
    if (typeof name !== 'string' || typeof review !== 'string') return;
    const n = name.trim();
    const r = review.trim();
    if (n && r) out[n] = r.slice(0, 500);
  };
  const readArray = (value: unknown) => {
    if (Array.isArray((value as { reviews?: unknown })?.reviews)) {
      return (value as { reviews: unknown[] }).reviews;
    }
    if (Array.isArray((value as { repositories?: unknown })?.repositories)) {
      return (value as { repositories: unknown[] }).repositories;
    }
    return Array.isArray(value) ? (value as unknown[]) : [];
  };

  if (res && typeof res === 'object') {
    for (const item of readArray(res)) {
      if (item && typeof item === 'object') {
        const it = item as { name?: unknown; review?: unknown; reviewText?: unknown; text?: unknown };
        push(it.name, it.review ?? it.reviewText ?? it.text);
      }
    }
  }
  if (Object.keys(out).length > 0) return out;

  const text = typeof res === 'string' ? res : res != null ? JSON.stringify(res) : '';
  if (!text) return out;

  // 1. Salvage an embedded JSON object/array from surrounding prose.
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first !== -1 && last > first) {
    try {
      const parsed = JSON.parse(text.slice(first, last + 1));
      for (const item of readArray(parsed)) {
        if (item && typeof item === 'object') {
          const it = item as { name?: unknown; review?: unknown; reviewText?: unknown; text?: unknown };
          push(it.name, it.review ?? it.reviewText ?? it.text);
        }
      }
    } catch {
      // Fall through to line parsing.
    }
  }
  if (Object.keys(out).length > 0) return out;

  // 2. Line format: "<repo name> :: <review>" (also tolerate | - — : separators).
  for (const line of text.split(/\r?\n/)) {
    const cleaned = line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim();
    if (!cleaned) continue;
    const lower = cleaned.toLowerCase();
    for (const r of candidates) {
      if (out[r.name]) continue;
      if (!lower.startsWith(r.name.toLowerCase())) continue;
      const rest = cleaned.slice(r.name.length).replace(/^\s*(?:::|\||[-—:])\s*/, '').trim();
      if (rest.length >= 8) {
        push(r.name, rest);
        break;
      }
    }
  }
  return out;
}

/** One batched AI call producing a short honest review sentence per repo. */
export async function reviewRepos(repos: GithubRepo[]): Promise<Record<string, string>> {
  const candidates = repos.filter((r) => !r.isFork && r.name).slice(0, MAX_REVIEW_REPOS);
  if (candidates.length === 0) return {};

  const list = candidates
    .map((r, i) =>
      `${i + 1}. ${r.name} | language: ${r.language || 'n/a'} | stars: ${r.stars} | forks: ${r.forks} | topics: ${
        r.topics.join(', ') || 'none'
      } | description: ${r.description || 'none'}`
    )
    .join('\n');

  // Reviews are best-effort and time-bounded so the whole enrich route (GitHub
  // fetch + reviews) stays inside its platform budget. If a slow model drops
  // them, the factual repo data is still returned.
  //
  // Primary call is PLAIN (not json mode): some OpenRouter models ignore
  // `response_format: json_object`, which made the router throw a format error,
  // fall back to the (often unconfigured) Groq key, and wipe out every review.
  // Asking for one `name :: review` line each and parsing tolerantly works
  // across models and never depends on strict JSON compliance.
  const linePrompt = `You are a senior software engineer reviewing a developer's public GitHub repositories. For EACH repository below, write ONE concise, honest review sentence (max 35 words) describing what the project appears to be and the engineering signal it shows. Do not invent facts that are not implied by the data. Return ONLY one line per repository, in EXACTLY this format (no JSON, no markdown, no numbering, no extra commentary):
<exact repo name> :: <one-sentence review>

REPOSITORIES:
${list}`;

  try {
    const res = await AIRouterService.requestAI(linePrompt, false, { budgetMs: 45_000, requestTimeoutMs: 30_000 });
    const reviews = coerceReviews(res, candidates);
    if (Object.keys(reviews).length > 0) return reviews;
  } catch {
    // Fall through to the JSON attempt.
  }

  // Backup: JSON mode, in case the model prefers it. Same tolerant parsing.
  try {
    const jsonPrompt = `You are a senior software engineer reviewing a developer's public GitHub repositories. For EACH repository below, write ONE concise, honest review sentence (max 35 words). Do not invent facts that are not implied by the data. Return ONLY valid JSON in this exact shape: {"reviews":[{"name":"<exact repo name>","review":"<one sentence>"}]}.

REPOSITORIES:
${list}`;
    const res = await AIRouterService.requestAI(jsonPrompt, true, { budgetMs: 20_000, requestTimeoutMs: 15_000 });
    return coerceReviews(res, candidates);
  } catch {
    return {};
  }
}

// ───────────────────────── coding platforms ─────────────────────────

async function fetchJsonWithTimeout(url: string, deadline: number, init?: RequestInit): Promise<{ ok: boolean; status: number; data: any; error: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), boundedTimeout(codingTimeoutMs(), deadline));
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const text = await res.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    return { ok: res.ok, status: res.status, data, error: '' };
  } catch (err) {
    return { ok: false, status: 0, data: null, error: message(err) };
  } finally {
    clearTimeout(timer);
  }
}

function emptyStat(platform: string, url: string, handle: string, note: string): CodingStat {
  return {
    platform,
    url,
    handle,
    available: false,
    rating: null,
    maxRating: null,
    rank: '',
    problemsSolved: null,
    contests: null,
    stars: null,
    note,
  };
}

async function fetchCodeforces(handle: string, url: string, deadline: number): Promise<CodingStat> {
  try {
    const info = await fetchJsonWithTimeout(`https://codeforces.com/api/user.info?handles=${encodeURIComponent(handle)}`, deadline);
    if (!info.ok || info.data?.status !== 'OK') {
      throw new Error(info.data?.comment || `HTTP ${info.status}`);
    }
    const u = info.data?.result?.[0] || {};

    let solved: number | null = null;
    const status = await fetchJsonWithTimeout(`https://codeforces.com/api/user.status?handle=${encodeURIComponent(handle)}`, deadline);
    if (status.ok && status.data?.status === 'OK' && Array.isArray(status.data.result)) {
      const unique = new Set<string>();
      for (const sub of status.data.result) {
        if (sub?.verdict === 'OK' && sub?.problem) unique.add(`${sub.problem.contestId}-${sub.problem.index}`);
      }
      solved = unique.size;
    }

    return {
      platform: 'Codeforces',
      url,
      handle,
      available: true,
      rating: typeof u.rating === 'number' ? u.rating : null,
      maxRating: typeof u.maxRating === 'number' ? u.maxRating : null,
      rank: typeof u.rank === 'string' ? u.rank : '',
      problemsSolved: solved,
      contests: typeof u.contribution === 'number' ? null : null,
      stars: null,
      note: solved === null ? 'Live from Codeforces (problem count unavailable).' : 'Live from Codeforces public API.',
    };
  } catch (err) {
    return emptyStat('Codeforces', url, handle, `Could not fetch: ${message(err)}`);
  }
}

async function fetchLeetCode(handle: string, url: string, deadline: number): Promise<CodingStat> {
  const query = `query userData($u:String!){ matchedUser(username:$u){ username submitStats{ acSubmissionNum{ difficulty count } } } userContestRanking(username:$u){ rating attendedContestsCount globalRanking } }`;
  try {
    const res = await fetchJsonWithTimeout('https://leetcode.com/graphql', deadline, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; NEXORA/1.0)',
        Referer: 'https://leetcode.com/',
      },
      body: JSON.stringify({ query, variables: { u: handle } }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const matched = res.data?.data?.matchedUser;
    if (!matched) throw new Error('profile not found or API blocked');
    const nums = Array.isArray(matched?.submitStats?.acSubmissionNum) ? matched.submitStats.acSubmissionNum : [];
    const total = nums.find((n: any) => n?.difficulty === 'All');
    const contest = res.data?.data?.userContestRanking || {};
    return {
      platform: 'LeetCode',
      url,
      handle,
      available: true,
      rating: typeof contest.rating === 'number' ? Math.round(contest.rating) : null,
      maxRating: null,
      rank: typeof contest.globalRanking === 'number' ? `#${contest.globalRanking}` : '',
      problemsSolved: typeof total?.count === 'number' ? total.count : null,
      contests: typeof contest.attendedContestsCount === 'number' ? contest.attendedContestsCount : null,
      stars: null,
      note: 'Live from LeetCode public GraphQL API.',
    };
  } catch (err) {
    return emptyStat('LeetCode', url, handle, `Could not fetch: ${message(err)}`);
  }
}

// ───────────────────────────── orchestration ─────────────────────────────

export interface EnrichLinkInput {
  url: string;
  kind?: string;
  id?: string;
}

export interface EnrichLinkLabel {
  url: string;
  kind: string;
  platform: string;
  label: string;
}

const CODING_PLATFORM_LABELS: Record<string, string> = {
  codeforces: 'Codeforces',
  leetcode: 'LeetCode',
  codechef: 'CodeChef',
  hackerrank: 'HackerRank',
};

/**
 * Visits each recognised link and returns structured enrichment plus improved
 * display labels. Unknown/unsupported links are ignored (they keep the label
 * detected by the client). Never throws: failures land in `githubError` or the
 * per-platform `note`.
 */
export async function enrichLinks(
  links: EnrichLinkInput[],
  deadline: number
): Promise<{ enrichment: ProfileEnrichment; labels: EnrichLinkLabel[] }> {
  const labels: EnrichLinkLabel[] = [];
  let github: GithubProfileSummary | null = null;
  let githubError = '';

  const ghLink = links.find((l) => l.kind === 'github' || isGithubUrl(l.url));
  if (ghLink) {
    const username = githubUsernameFromUrl(ghLink.url) || (ghLink.kind === 'github' ? lastPathSegment(ghLink.url) : null);
    if (!username) {
      githubError = 'Could not read a GitHub username from that link.';
    } else {
      try {
        github = await fetchGithubProfile(username, deadline);
        labels.push({ url: ghLink.url, kind: 'github', platform: 'GitHub', label: `GitHub · @${github.username}` });
      } catch (err) {
        githubError = message(err);
      }
    }
  }

  const coding: CodingStat[] = [];
  for (const kind of Object.keys(CODING_PLATFORM_LABELS)) {
    const link = links.find((l) => l.kind === kind || safeHost(l.url).includes(kind));
    if (!link) continue;
    const platform = CODING_PLATFORM_LABELS[kind];
    const handle = lastPathSegment(link.url);

    let stat: CodingStat;
    if (!handle) {
      stat = emptyStat(platform, link.url, '', 'Could not read a handle from this URL.');
    } else if (kind === 'codeforces') {
      stat = await fetchCodeforces(handle, link.url, deadline);
    } else if (kind === 'leetcode') {
      stat = await fetchLeetCode(handle, link.url, deadline);
    } else {
      stat = emptyStat(platform, link.url, handle, `${platform} has no public stats API — link saved for reference.`);
    }
    coding.push(stat);
    if (handle) labels.push({ url: link.url, kind, platform, label: `${platform} · @${handle}` });
  }

  return {
    enrichment: { github, githubError, coding, updatedAt: new Date().toISOString() },
    labels,
  };
}
