/**
 * Public profile links — the URLs a user wants recruiters, and the AI, to see.
 * Anything from a LinkedIn profile to a random portfolio page counts, so nothing
 * here is allow-list restricted; the kind is only used for labelling and UI display.
 */

import type { ProfileLinkKind } from "./types";

export const PROFILE_LINK_KINDS: ProfileLinkKind[] = [
  "linkedin",
  "github",
  "leetcode",
  "codechef",
  "codeforces",
  "hackerrank",
  "behance",
  "dribbble",
  "devto",
  "hashnode",
  "codepen",
  "notion",
  "medium",
  "substack",
  "kaggle",
  "figma",
  "youtube",
  "twitter",
  "instagram",
  "facebook",
  "threads",
  "mastodon",
  "telegram",
  "website",
  "other",
];

const KIND_LABELS: Record<ProfileLinkKind, string> = {
  linkedin: "LinkedIn",
  github: "GitHub",
  leetcode: "LeetCode",
  codechef: "CodeChef",
  codeforces: "Codeforces",
  hackerrank: "HackerRank",
  behance: "Behance",
  dribbble: "Dribbble",
  devto: "Dev.to",
  hashnode: "Hashnode",
  codepen: "CodePen",
  notion: "Notion",
  medium: "Medium",
  substack: "Substack",
  kaggle: "Kaggle",
  figma: "Figma",
  youtube: "YouTube",
  twitter: "Twitter / X",
  instagram: "Instagram",
  facebook: "Facebook",
  threads: "Threads",
  mastodon: "Mastodon",
  telegram: "Telegram",
  website: "Website",
  other: "Link",
};

/**
 * Badge tone per kind.
 *
 * This used to hand back the brand hex for each site (`#0a66c2` for LinkedIn,
 * `#5B4638` for CodeChef, `#1F8ACB` for Codeforces). Two of those are close to
 * black and close to the surface blue, so on the dark theme the badge text was
 * effectively invisible, and none of them responded to the theme at all. Tones
 * are the only colour vocabulary the app has now, so the label distinguishes the
 * kind and the tone just keeps it legible.
 */
const KIND_TONE: Record<ProfileLinkKind, ProfileLinkTone> = {
  linkedin: "info",
  github: "neutral",
  leetcode: "warning",
  codechef: "gold",
  codeforces: "info",
  hackerrank: "success",
  behance: "gold",
  dribbble: "gold",
  devto: "gold",
  hashnode: "gold",
  codepen: "gold",
  notion: "gold",
  medium: "gold",
  substack: "gold",
  kaggle: "gold",
  figma: "gold",
  youtube: "danger",
  twitter: "info",
  instagram: "warning",
  facebook: "info",
  threads: "info",
  mastodon: "info",
  telegram: "info",
  website: "neutral",
  other: "neutral",
};

export type ProfileLinkTone = "neutral" | "gold" | "success" | "danger" | "warning" | "info";

export function kindLabel(kind: ProfileLinkKind): string {
  return KIND_LABELS[kind] || KIND_LABELS.other;
}

export function kindTone(kind: ProfileLinkKind): ProfileLinkTone {
  return KIND_TONE[kind] || KIND_TONE.other;
}

/** Hostname → kind. Ordered longest-first so subdomains are matched sensibly. */
const HOST_KINDS: Array<[RegExp, ProfileLinkKind]> = [
  [/(^|\.)linkedin\.com$/, "linkedin"],
  [/(^|\.)lnkd\.in$/, "linkedin"],
  [/(^|\.)github\.com$/, "github"],
  [/(^|\.)gitlab\.com$/, "github"],
  [/(^|\.)bitbucket\.org$/, "github"],
  [/(^|\.)leetcode\.com$/, "leetcode"],
  [/(^|\.)codechef\.com$/, "codechef"],
  [/(^|\.)codeforces\.com$/, "codeforces"],
  [/(^|\.)hackerrank\.com$/, "hackerrank"],
  [/(^|\.)behance\.net$/, "behance"],
  [/(^|\.)dribbble\.com$/, "dribbble"],
  [/(^|\.)dev\.to$/, "devto"],
  [/(^|\.)hashnode\.com$/, "hashnode"],
  [/(^|\.)codepen\.io$/, "codepen"],
  [/(^|\.)notion\.site$/, "notion"],
  [/(^|\.)medium\.com$/, "medium"],
  [/(^|\.)substack\.com$/, "substack"],
  [/(^|\.)kaggle\.com$/, "kaggle"],
  [/(^|\.)figma\.com$/, "figma"],
  [/(^|\.)youtube\.com$/, "youtube"],
  [/(^|\.)youtu\.be$/, "youtube"],
  [/(^|\.)twitter\.com$/, "twitter"],
  [/(^|\.)x\.com$/, "twitter"],
  [/(^|\.)instagram\.com$/, "instagram"],
  [/(^|\.)facebook\.com$/, "facebook"],
  [/(^|\.)threads\.net$/, "threads"],
  [/(^|\.)mastodon\.social$/, "mastodon"],
  [/(^|\.)t\.me$/, "telegram"],
];

/** TLDs that almost always belong to a single person's own site. */
const PERSONAL_TLDS = new Set([
  "dev", "me", "io", "page", "site", "website", "xyz", "online", "tech",
  "design", "studio", "link", "bio", "live", "blog", "space", "fun", "host",
]);

/** Short one-liners shown next to the input so the user knows what to paste. */
const DOMAIN_HINTS: Array<[RegExp, ProfileLinkKind]> = [
  [/\b(portfolio|works|homepage)\b/, "website"],
  [/\b(profile|cv|resume|contact|about)\b/, "website"],
  [/\b(repo|projects?|code)\b/, "github"],
  [/\b(feed|timeline|posts?)\b/, "website"],
  [/\b(public|public-?site)\b/, "website"],
];

export interface LinkParseResult {
  url: string;
  host: string;
  kind: ProfileLinkKind;
  label: string;
  ok: boolean;
  error?: string;
}

/**
 * Accepts what people actually type — "linkedin.com/in/nikhil", "https://x.com/me",
 * "github.com/you" — and turns it into a clean, absolute https URL.
 */
export function parseProfileLink(raw: string): LinkParseResult {
  const trimmed = (raw || "").trim();
  const fail = (error: string): LinkParseResult => ({ url: "", host: "", kind: "other", label: "", ok: false, error });

  if (!trimmed) return fail("Paste a link first.");
  if (trimmed.length > 500) return fail("That link is too long.");

  // Strip anything that would be pasted alongside the URL.
  const cleaned = trimmed.replace(/^[\s"'`<(]+/, "").replace(/[\s"'`>).,;:]+$/, "");

  // Catch a pasted non-web scheme before we blindly prepend https://. Covers both
  // "ftp://host" and the `//`-less forms (mailto:, tel:, javascript:, data:).
  const scheme = cleaned.match(/^([a-z][a-z0-9+.-]*):/i);
  if (scheme && !/^https?$/i.test(scheme[1])) {
    return fail(`Only http and https links can be saved, not ${scheme[1]}:`);
  }

  const withScheme = /^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`;

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return fail("That does not look like a valid URL.");
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return fail("Only http and https links can be saved.");
  }
  // Never store credentials. "https://user:pass@host" parses fine, so it has to be
  // rejected explicitly or a pasted secret would end up saved in the database.
  if (parsed.username || parsed.password) {
    return fail("Remove the username and password from that link before saving it.");
  }
  const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
  if (!host || !host.includes(".")) {
    return fail("Add the full domain, for example linkedin.com/in/yourname.");
  }

  const path = parsed.pathname === "/" ? "" : parsed.pathname;
  const kind = detectKind(host);
  return {
    url: `https://${host}${path}${parsed.search}${parsed.hash}`,
    host,
    kind,
    label: kindLabel(kind),
    ok: true,
  };
}

export function detectKind(hostOrUrl: string): ProfileLinkKind {
  const value = (hostOrUrl || "").trim().toLowerCase();
  if (!value) return "other";
  const host = value.includes("://") || value.includes("/") ? hostOf(value) : value.replace(/^www\./, "");

  for (const [re, kind] of HOST_KINDS) {
    if (re.test(host)) return kind;
  }
  if (/\.(edu|ac\.[a-z]{2})$/.test(host)) return "website";
  for (const [re, kind] of DOMAIN_HINTS) {
    if (re.test(host)) return kind;
  }
  const labels = host.split(".");
  if (PERSONAL_TLDS.has(labels[labels.length - 1])) return "website";
  return "website";
}

function hostOf(value: string): string {
  try {
    return new URL(value.includes("://") ? value : `https://${value}`).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return value.split("/")[0].replace(/^www\./, "").toLowerCase();
  }
}

/** Strips the scheme and any trailing slash, for compact display. */
export function displayUrl(url: string): string {
  return (url || "")
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "")
    .replace(/^www\./i, "");
}

/** Two links pointing at the same place. Normalises trailing slashes. */
export function isSameLink(a: string, b: string): boolean {
  const norm = (u: string) => (u || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, "").replace(/^www\./, "");
  return norm(a) === norm(b);
}

/** One-tap starting points for users who do not have a link handy. */
export const LINK_SUGGESTIONS: Array<{ kind: ProfileLinkKind; label: string; placeholder: string }> = [
  { kind: "linkedin", label: "LinkedIn", placeholder: "linkedin.com/in/yourname" },
  { kind: "github", label: "GitHub", placeholder: "github.com/yourname" },
  { kind: "website", label: "Website", placeholder: "yourname.dev" },
  { kind: "behance", label: "Behance", placeholder: "behance.net/you" },
];

/** LinkedIn needs a profile path — the bare domain is not a profile anyone can open. */
export function needsProfilePath(kind: ProfileLinkKind, url: string): boolean {
  return kind === "linkedin" && !/\/in\/|\/pub\//i.test(url);
}
