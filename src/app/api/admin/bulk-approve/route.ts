import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { requireUser } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/bulk-approve
 *
 * Approves every "pending" opportunity that was ingested automatically
 * (source === "automated"). Manually-posted org opportunities are left
 * untouched — those still need a human decision.
 *
 * Only admins can call this route (checked via the user's Firestore role).
 */
export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const db = getAdminDb();

  // Verify caller is an admin
  const userDoc = await db.collection("users").doc(auth.user.uid).get();
  if (userDoc.data()?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden: admins only." }, { status: 403 });
  }

  try {
    // Fetch all pending automated opportunities
    const snap = await db
      .collection("org_opportunities")
      .where("status", "==", "pending")
      .where("source", "==", "automated")
      .get();

    if (snap.empty) {
      return NextResponse.json({ ok: true, approved: 0, message: "No pending automated opportunities found." });
    }

    // Batch update in chunks of 250 (Firestore limit)
    const CHUNK = 250;
    const docs = snap.docs;
    let approved = 0;

    for (let i = 0; i < docs.length; i += CHUNK) {
      const chunk = docs.slice(i, i + CHUNK);
      const batch = db.batch();
      for (const d of chunk) {
        batch.update(d.ref, { status: "approved", bulkApprovedAt: new Date().toISOString() });
      }
      await batch.commit();
      approved += chunk.length;
    }

    return NextResponse.json({
      ok: true,
      approved,
      message: `✅ ${approved} automated opportunities bulk-approved and now live on Explore.`,
    });
  } catch (err: any) {
    console.error("[bulk-approve] Error:", err);
    return NextResponse.json({ error: err.message || "Bulk approve failed." }, { status: 500 });
  }
}
