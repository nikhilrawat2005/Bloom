import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { requireUser } from "@/lib/serverAuth";
import { enforceRateLimit, LIMITS } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const APP_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{2,127}$/;
const ALLOWED_STATUSES = ["Shortlisted", "Rejected"] as const;
type AllowedStatus = (typeof ALLOWED_STATUSES)[number];

/**
 * POST /api/organization/applications/status  { applicationId, status }
 *
 * Lets the organization that posted a program move a candidate application to
 * "Shortlisted" or "Rejected".
 *
 * The browser used to do `updateDoc(doc(db, "applications", id), { status })`
 * directly. That write is another user's document, so the hardened rules
 * correctly refuse it -- which means the shortlist feature was silently broken.
 * Rather than widen the rules to let any signed-in user edit any application,
 * the decision is made server-side where it can be authorized: the caller must
 * own at least one **admin-approved** `org_opportunities` document whose
 * `organization`/`orgName` matches the target application. Only the two
 * decision fields are written.
 *
 * SECURITY: the approved-status constraint is load-bearing. Client-created
 * listings are forced to `status: "pending"` by the create rule and only an
 * admin can approve, so an attacker cannot create a pending listing named
 * after a victim org and pass the ownership check to reject/shortlist that
 * org's candidates.
 */
export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const uid = auth.user.uid;

  const limited = enforceRateLimit(request, { ...LIMITS.applicationStatus, uid });
  if (!limited.ok) return limited.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { applicationId, status } = (body ?? {}) as {
    applicationId?: unknown;
    status?: unknown;
  };

  if (typeof applicationId !== "string" || !APP_ID_RE.test(applicationId)) {
    return NextResponse.json({ error: "A valid applicationId is required." }, { status: 400 });
  }
  if (
    typeof status !== "string" ||
    !ALLOWED_STATUSES.includes(status as AllowedStatus)
  ) {
    return NextResponse.json(
      { error: `status must be one of: ${ALLOWED_STATUSES.join(", ")}.` },
      { status: 400 }
    );
  }

  try {
    const db = getAdminDb();
    const apps = db.collection("applications");
    const opps = db.collection("org_opportunities");

    const appSnap = await apps.doc(applicationId).get();
    if (!appSnap.exists) {
      return NextResponse.json({ error: "Application not found." }, { status: 404 });
    }

    const app = appSnap.data() ?? {};
    const targetOrg =
      typeof app.organization === "string"
        ? app.organization
        : typeof app.orgName === "string"
          ? app.orgName
          : "";

    if (!targetOrg) {
      return NextResponse.json(
        { error: "This application is not linked to an organization." },
        { status: 403 }
      );
    }

    // The caller must have posted an admin-approved program under that
    // organization. Both name fields are checked because writers set one or
    // the other (client create requires `orgName`, ingestion writes both).
    const ownership = await opps
      .where("postedByUid", "==", uid)
      .where("status", "==", "approved")
      .where("organization", "==", targetOrg)
      .limit(1)
      .get();

    let ownsOrg = !ownership.empty;
    if (!ownsOrg) {
      const byOrgName = await opps
        .where("postedByUid", "==", uid)
        .where("status", "==", "approved")
        .where("orgName", "==", targetOrg)
        .limit(1)
        .get();
      ownsOrg = !byOrgName.empty;
    }

    if (!ownsOrg) {
      return NextResponse.json(
        { error: "You do not have permission to manage applications for this organization." },
        { status: 403 }
      );
    }

    await apps.doc(applicationId).update({
      status,
      updatedAt: new Date().toISOString(),
      reviewedByUid: uid,
    });

    return NextResponse.json({ ok: true, applicationId, status });
  } catch (err) {
    console.error("organization/applications/status POST error:", err);
    return NextResponse.json(
      { error: "Failed to update application status." },
      { status: 500 }
    );
  }
}