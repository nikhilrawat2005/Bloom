import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { requireAdmin } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/overview
 *
 * Aggregate counts for the admin dashboard.
 *
 * The dashboard used to call `getDocs(collection(db, "applications"))` and
 * `getDocs(collection(db, "community_posts"))` purely to increment two counters.
 * That was wrong twice over:
 *
 *   - `applications` documents belong to their applicant, and a rule of the form
 *     `resource.data.uid == request.auth.uid` cannot be proven safe for an
 *     unfiltered query, so Firestore rejects the read outright. The dashboard's
 *     application total was therefore always 0 (silently, inside one big
 *     try/catch that also swallowed the users load).
 *   - It downloaded every applicant's document to the browser to count them.
 *
 * Counting through the Admin SDK avoids both problems: `count()` is a server-side
 * aggregation, so no applicant data leaves the backend.
 */
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const db = getAdminDb();

    const [users, applications, communityPosts, orgRequests] = await Promise.all([
      db.collection("users").count().get(),
      db.collection("applications").count().get(),
      db.collection("community_posts").count().get(),
      db.collection("org_requests").count().get(),
    ]);

    return NextResponse.json({
      ok: true,
      totalUsers: users.data().count,
      totalApplications: applications.data().count,
      totalCommunityPosts: communityPosts.data().count,
      totalOrgRequests: orgRequests.data().count,
    });
  } catch (err) {
    console.error("[api/admin/overview] count failed:", err);
    return NextResponse.json({ error: "Could not load dashboard totals." }, { status: 500 });
  }
}