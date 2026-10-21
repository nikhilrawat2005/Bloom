// Outbound-URL validation for server-side fetches.
//
// `/api/summarize` fetches a caller-supplied URL from the server and returns
// the fetched body to the caller. Without a host/IP allow-list that is a
// textbook SSRF: `http://169.254.169.254/...` reads cloud instance credentials,
// and a private-range host turns the function into an internal port scanner.
//
// `src/lib/profileLinks.ts` already validates user-submitted URLs correctly for
// href rendering; this module is the fetch-side counterpart.

import { lookup as dnsLookup } from "node:dns/promises";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata.goog",
  "instance-data",
]);

function isPrivateIPv4(host: string): boolean {
  const parts = host.split(".");
  if (parts.length !== 4) return false;
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b] = nums;

  if (a === 0) return true; // 0.0.0.0/8   "this network"
  if (a === 10) return true; // 10.0.0.0/8  private
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local (cloud metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 private
  if (a === 192 && b === 168) return true; // 192.168.0.0/16 private
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  if (a >= 224) return true; // multicast + reserved + broadcast
  return false;
}

/**
 * Expand an IPv6 literal into its 8 16-bit groups, or null if malformed.
 * Handles embedded IPv4 tails ("::ffff:127.0.0.1", "::7f00:1") so that all
 * the v4-in-v6 spellings go through the same private-range checks.
 */
function parseIPv6(input: string): number[] | null {
  let h = input.replace(/^\[/, "").replace(/\]$/, "").toLowerCase();
  // Fold a dotted-quad tail into two hex groups.
  const v4 = /(\d{1,3}(?:\.\d{1,3}){3})$/.exec(h);
  if (v4) {
    const parts = v4[1].split(".").map(Number);
    if (parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
    const hi = ((parts[0] << 8) | parts[1]).toString(16);
    const lo = ((parts[2] << 8) | parts[3]).toString(16);
    h = h.slice(0, v4.index) + `${hi}:${lo}`;
  }
  const halves = h.split("::");
  if (halves.length > 2) return null;
  const toGroups = (s: string) => (s === "" ? [] : s.split(":"));
  let groups: string[];
  if (halves.length === 2) {
    const head = toGroups(halves[0]);
    const tail = toGroups(halves[1]);
    if (head.length + tail.length > 8) return null;
    groups = [...head, ...Array(8 - head.length - tail.length).fill("0"), ...tail];
  } else {
    groups = toGroups(h);
    if (groups.length !== 8) return null;
  }
  const out: number[] = [];
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
    out.push(parseInt(g, 16));
  }
  return out;
}

function v4FromGroups(hi: number, lo: number): string {
  return `${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`;
}

function isPrivateIPv6(host: string): boolean {
  const g = parseIPv6(host);
  // Malformed literal: fail closed.
  if (!g) return true;
  const allZeroExceptLast = g.slice(0, 7).every((n) => n === 0);
  if (allZeroExceptLast && (g[7] === 0 || g[7] === 1)) return true; // :: and ::1
  if ((g[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((g[0] & 0xffc0) === 0xfec0) return true; // fec0::/10 site-local (deprecated)
  if (g[0] >= 0xfc00 && g[0] <= 0xfdff) return true; // fc00::/7 unique local
  // IPv4-mapped ::ffff:a.b.c.d (and the hex-group spelling ::ffff:7f00:1)
  if (g[0] === 0 && g[1] === 0 && g[2] === 0 && g[3] === 0 && g[4] === 0 && g[5] === 0xffff) {
    return isPrivateIPv4(v4FromGroups(g[6], g[7]));
  }
  // Deprecated IPv4-compatible ::a.b.c.d — still routable, so check it.
  if (g[0] === 0 && g[1] === 0 && g[2] === 0 && g[3] === 0 && g[4] === 0 && g[5] === 0) {
    return isPrivateIPv4(v4FromGroups(g[6], g[7]));
  }
  // 6to4 (2002::/16) embeds a v4 address in groups 1-2.
  if (g[0] === 0x2002) return isPrivateIPv4(v4FromGroups(g[1], g[2]));
  // NAT64 (64:ff9b::/96) embeds a v4 address in the last two groups.
  if (g[0] === 0x0064 && g[1] === 0xff9b && g[2] === 0 && g[3] === 0 && g[4] === 0 && g[5] === 0) {
    return isPrivateIPv4(v4FromGroups(g[6], g[7]));
  }
  return false;
}

export type SafeUrlResult =
  | { ok: true; url: URL }
  | { ok: false; reason: string };

/**
 * Parse and vet a caller-supplied absolute http(s) URL.
 *
 * Rejects: non-http(s) schemes, embedded credentials, hostnames without a dot,
 * bare hostnames, and literal private/loopback/link-local addresses. Hostnames
 * that resolve to private space (DNS rebinding) still need an egress proxy to
 * block; we mitigate that by using `redirect: "manual"` at the call site so a
 * public host cannot bounce us onto an internal one.
 */
export function validateOutboundUrl(raw: unknown): SafeUrlResult {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return { ok: false, reason: "A url string is required." };
  }
  if (raw.length > 2048) {
    return { ok: false, reason: "Url is too long." };
  }

  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { ok: false, reason: "Url is not a valid absolute URL." };
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, reason: "Only http(s) urls are allowed." };
  }
  if (url.username || url.password) {
    return { ok: false, reason: "Urls with embedded credentials are not allowed." };
  }

  const host = url.hostname.toLowerCase().replace(/\.$/, "");

  if (BLOCKED_HOSTNAMES.has(host)) {
    return { ok: false, reason: "That host is not allowed." };
  }
  if (!host.includes(".")) {
    return { ok: false, reason: "Host must be a fully qualified domain name." };
  }
  // IPv6 literals arrive bracketed from URL parsing.
  if (host.startsWith("[") || host.includes(":")) {
    return isPrivateIPv6(host)
      ? { ok: false, reason: "Private network addresses are not allowed." }
      : { ok: true, url };
  }
  if (isPrivateIPv4(host)) {
    return { ok: false, reason: "Private network addresses are not allowed." };
  }

  return { ok: true, url };
}

/**
 * DNS-rebinding-safe variant: everything `validateOutboundUrl` checks, plus a
 * DNS resolution check that every address behind the hostname is public. A
 * hostname-only check passes `rebind.attacker.example` that resolves to
 * 169.254.169.254. Residual TOCTOU between this lookup and the actual fetch
 * remains (blocking it properly needs an egress proxy), but a one-shot rebind
 * would have to flip DNS between two lookups milliseconds apart.
 */
export async function validateOutboundUrlDeep(raw: unknown): Promise<SafeUrlResult> {
  const basic = validateOutboundUrl(raw);
  if (!basic.ok) return basic;
  const host = basic.url.hostname.toLowerCase().replace(/\.$/, "");
  // IPv6 literals were already vetted against the private ranges above.
  if (host.startsWith("[") || host.includes(":")) return basic;
  let addrs: Array<{ address: string; family: number }>;
  try {
    addrs = await dnsLookup(host, { all: true, verbatim: true });
  } catch {
    return { ok: false, reason: "Host could not be resolved." };
  }
  if (addrs.length === 0) return { ok: false, reason: "Host could not be resolved." };
  for (const a of addrs) {
    const priv = a.family === 6 ? isPrivateIPv6(a.address) : isPrivateIPv4(a.address);
    if (priv) {
      return { ok: false, reason: "That host resolves to a private network address." };
    }
  }
  return basic;
}

/** Guard an inbound JSON field that must be a Firestore uid / public id. */
export function isSafeKey(value: unknown, maxLength = 128): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maxLength &&
    !value.includes("/") &&
    !value.includes("\\") &&
    !value.includes("..") &&
    !/[\x00-\x1f]/.test(value)
  );
}