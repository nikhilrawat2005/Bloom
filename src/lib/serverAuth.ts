// Server-only request authentication.
//
// Every mutating or AI-cost-incurring API route must call one of the guards
// below. The Firebase Admin SDK bypasses `firestore.rules`, so a route that
// trusts the Admin SDK MUST establish its own authorization - these helpers
// are the single place that does that.
//
// Token source: the client sends the Firebase ID token as
// `Authorization: Bearer <idToken>`. Cron endpoints (Vercel Cron) instead send
// `Authorization: Bearer $CRON_SECRET`, handled by `verifyCronSecret`.

import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { getAdminAuth } from "@/lib/firebaseAdmin";

export interface VerifiedUser {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  /** Convenience flag: allow-listed AND email-verified. */
  isAdmin: boolean;
}

/**
 * The authoritative admin allow-list. Server-only: this must never be imported
 * by a client component, because that inlines the addresses into the public JS
 * bundle. Configure with the `ADMIN_EMAILS` env var (comma separated) so the
 * list can be rotated without a redeploy; the constants below are the fallback.
 *
 * NOTE: these addresses are also present in `firestore.rules`, which is a
 * tracked file. Treat them as non-secret; the security boundary is the *verified
 * token email* check, not the obscurity of the address list.
 */
const FALLBACK_ADMIN_EMAILS = [
  "nikhil2005114@gmail.com",
  "bhatt.yogesh0814@gmail.com",
  "ypranjalt@gmail.com",
  "teamcipher.work@gmail.com",
  "priyanshusrivastav850@gmail.com",
  "deepikanshp@gmail.com",
];

function adminEmails(): string[] {
  const fromEnv = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return fromEnv.length > 0 ? fromEnv : FALLBACK_ADMIN_EMAILS;
}

/**
 * Admin status requires BOTH an allow-listed address AND a verified email.
 * Firebase issues email-bearing ID tokens for unverified email/password
 * accounts, so without the `email_verified` gate whoever registers an
 * allow-listed address first would inherit admin.
 */
export function isAdminEmail(email: string | null | undefined, emailVerified: boolean): boolean {
  if (!email || !emailVerified) return false;
  return adminEmails().includes(email.trim().toLowerCase());
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

async function verifyIdToken(request: Request): Promise<VerifiedUser | null> {
  const token = bearerToken(request);
  if (!token) return null;
  try {
    const decoded = await getAdminAuth().verifyIdToken(token, true);
    const email = typeof decoded.email === "string" ? decoded.email.toLowerCase() : null;
    const emailVerified = decoded.email_verified === true;
    return {
      uid: decoded.uid,
      email,
      emailVerified,
      isAdmin: isAdminEmail(email, emailVerified),
    };
  } catch (err) {
    console.warn("[serverAuth] ID token verification failed:", (err as Error).message);
    return null;
  }
}

/** Constant-time secret comparison. */
function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Vercel Cron authenticates with `Authorization: Bearer $CRON_SECRET`.
 *
 * Fails CLOSED in production: a missing/blank CRON_SECRET rejects every request
 * rather than silently turning a paid, DB-writing endpoint into a public one.
 * Outside production we allow unauthenticated access so `npm run dev` works
 * without extra setup.
 */
export function verifyCronSecret(request: Request): boolean {
  if (process.env.NODE_ENV !== "production") return true;

  const secret = (process.env.CRON_SECRET || "").trim();
  if (!secret) {
    console.error("[serverAuth] CRON_SECRET is not set - rejecting cron request (fail closed).");
    return false;
  }

  const token = bearerToken(request);
  if (token && secretMatches(token, secret)) return true;

  console.warn("[serverAuth] Cron request presented no valid CRON_SECRET bearer token.");
  return false;
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export type AuthFailure = { ok: false; response: NextResponse };

/**
 * Require a verified Firebase user.
 *
 * On success the caller receives the user AND the verified uid - routes must
 * use `user.uid` as the document owner and must never accept a `uid` from the
 * request body or query string (that is an IDOR).
 */
export async function requireUser(
  request: Request
): Promise<{ ok: true; user: VerifiedUser } | AuthFailure> {
  if (!bearerToken(request)) {
    return { ok: false, response: jsonError("Authentication required.", 401) };
  }
  const user = await verifyIdToken(request);
  if (!user) {
    return { ok: false, response: jsonError("Invalid or expired session token.", 401) };
  }
  return { ok: true, user };
}

/** Require a verified, allow-listed admin. */
export async function requireAdmin(
  request: Request
): Promise<{ ok: true; user: VerifiedUser } | AuthFailure> {
  const result = await requireUser(request);
  if (!result.ok) return result;
  if (!result.user.isAdmin) {
    return { ok: false, response: jsonError("Administrator access required.", 403) };
  }
  return result;
}

/** Require a valid CRON_SECRET bearer token. */
export function requireCron(request: Request): { ok: true } | AuthFailure {
  if (!verifyCronSecret(request)) {
    return { ok: false, response: jsonError("Unauthorized.", 401) };
  }
  return { ok: true };
}
