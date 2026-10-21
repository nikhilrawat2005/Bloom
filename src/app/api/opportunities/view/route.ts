import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb, hasAdminCredentials } from "@/lib/firebaseAdmin";
import { enforceRateLimit, LIMITS } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{2,127}$/;

/**
 * POST /api/opportunities/view  { id }
 *
 * Increments the view counter for one opportunity.
 *
 * This used to be a direct client-side `updateDoc(doc(db, "org_opportunities",
 * id), { viewCount: increment(1) })` from the opportunity detail page. That is
 * exactly why `org_opportunities` had to be world-writable in `firestore.rules`,
 * which meant any anonymous visitor could also rewrite `title`, `applyLink`,
 * `status` or delete the document. View counting is now done here through the
 * Admin SDK, so the rules file can restrict the collection to
 * owner-create / admin-update only.
 *
 * Intentionally unauthenticated (anonymous page views must still count) but
 * rate-limited per IP, and it writes exactly one field.
 */
export async function POST(request: Request) {
  const limited = enforceRateLimit(request, LIMITS.viewCount);
  if (!limited.ok) return limited.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const id = (body as { id?: unknown })?.id;
  if (typeof id !== "string" || !ID_RE.test(id)) {
    return NextResponse.json({ error: "A valid opportunity id is required." }, { status: 400 });
  }

  if (!hasAdminCredentials()) {
    return NextResponse.json(
      { error: "View tracking is temporarily unavailable." },
      { status: 503 }
    );
  }

  try {
    const ref = getAdminDb().collection("org_opportunities").doc(id);
    // Atomic increment so concurrent views cannot clobber each other.
    await ref.update({ viewCount: FieldValue.increment(1) });
    return NextResponse.json({ ok: true, counted: true });
  } catch {
    // Opportunistic: a counter miss must never break the page for the visitor.
    return NextResponse.json({ ok: true, counted: false });
  }
}