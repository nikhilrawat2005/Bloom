// Best-effort in-process rate limiter for API routes.
//
// Scope note: on Vercel each serverless instance has its own module registry, so
// this is a *per-instance* limiter, not a global one. It reliably stops a single
// client (or a tight retry loop) from hammering an expensive endpoint, which is
// the abuse case that matters for LLM budget protection. For a hard global limit
// front the app with a shared store (Upstash Redis / Vercel KV) - the interface
// below is deliberately shaped so that swap is a one-file change.

import { NextResponse } from "next/server";

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Bound memory: sweep expired buckets periodically instead of growing forever.
let lastSweep = 0;
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
  limit: number;
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSeconds: 0, limit };
  }

  existing.count += 1;
  const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
  return {
    ok: existing.count <= limit,
    remaining: Math.max(0, limit - existing.count),
    retryAfterSeconds,
    limit,
  };
}

/**
 * Rate limit keyed on the verified caller when available, falling back to the
 * request IP. Prefers the uid so one user behind a shared NAT does not throttle
 * their neighbours.
 */
export function rateLimitKey(request: Request, uid: string | null, scope: string): string {
  if (uid) return `${scope}:uid:${uid}`;
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : request.headers.get("x-real-ip") || "unknown";
  return `${scope}:ip:${ip}`;
}

/** Convenience wrapper that returns a 429 response when the limit is exceeded. */
export function enforceRateLimit(
  request: Request,
  opts: { scope: string; limit: number; windowMs: number; uid?: string | null }
): { ok: true } | { ok: false; response: NextResponse } {
  const result = rateLimit(rateLimitKey(request, opts.uid ?? null, opts.scope), opts.limit, opts.windowMs);
  if (result.ok) return { ok: true };

  return {
    ok: false,
    response: NextResponse.json(
      { error: "Too many requests. Please slow down and try again shortly." },
      {
        status: 429,
        headers: {
          "Retry-After": String(result.retryAfterSeconds),
          "X-RateLimit-Limit": String(result.limit),
          "X-RateLimit-Remaining": "0",
        },
      }
    ),
  };
}

/** Rate limits applied to each guarded route, kept in one place for review. */
export const LIMITS = {
  /** Paid LLM endpoints. */
  ai: { scope: "ai", limit: 20, windowMs: 60_000 },
  /** Multi-file career chat (LLM round-trip + document parsing). */
  chat: { scope: "chat", limit: 30, windowMs: 60_000 },
  summarize: { scope: "summarize", limit: 30, windowMs: 60_000 },
  categorize: { scope: "categorize", limit: 15, windowMs: 60_000 },
  /** Paid resume audits (LLM round-trip + PDF extraction) — heavier, so tighter. */
  resumeAnalyze: { scope: "resume-analyze", limit: 10, windowMs: 60_000 },
  /** Full-person performance assessment (wallet + saved items + LLM) — heavy, kept tight. */
  performance: { scope: "performance", limit: 8, windowMs: 60_000 },
  /** Outbound link crawling (GitHub + coding platforms) — network-heavy, kept tight. */
  profileEnrich: { scope: "profile-enrich", limit: 6, windowMs: 60_000 },
  /** Cloudinary storage + bandwidth. */
  upload: { scope: "wallet-upload", limit: 20, windowMs: 60_000 },
  walletDelete: { scope: "wallet-delete", limit: 30, windowMs: 60_000 },
  /** Unauthenticated Firestore reads; keep tight, it runs per keystroke. */
  usernameCheck: { scope: "username-check", limit: 30, windowMs: 60_000 },
  /** Public read-only dataset fetch used by the explore page. */
  scrapePreview: { scope: "scrape-preview", limit: 60, windowMs: 60_000 },
  /** Public view-counter increments; anonymous, so keyed on IP and kept tight. */
  viewCount: { scope: "opp-view", limit: 60, windowMs: 60_000 },
  /** Signed-in shortlist/status decisions by an organization on an application. */
  applicationStatus: { scope: "app-status", limit: 60, windowMs: 60_000 },
  /** Self-service role changes. Rare and cheap, so kept deliberately tight. */
  roleChange: { scope: "role-change", limit: 5, windowMs: 60_000 },
} as const;
