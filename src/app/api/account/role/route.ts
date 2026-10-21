import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { requireUser } from "@/lib/serverAuth";
import { enforceRateLimit, LIMITS } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

/**
 * Self-service role switch — deliberately limited to `user` and `organization`.
 *
 * The dashboard sidebar advertised a `user | organization | admin` switcher to
 * every visitor and wrote the choice straight from the client. `firestore.rules`
 * pins `role` on `users/{uid}` updates, so for every non-admin the write was
 * rejected and the failure was swallowed by a bare `console.error`: clicking
 * "admin" did nothing, with no error shown, while the UI kept advertising an
 * escalation path that could never work.
 *
 * This route makes the legitimate half of that control actually work and removes
 * the illegitimate half:
 *
 *   - `organization` is a real self-service upgrade (post opportunities, review
 *     applicants), so it is granted here through the Admin SDK, which is the only
 *     path that can write `role` at all.
 *   - `admin` is refused unconditionally. It is assigned exclusively by
 *     `POST /api/admin/resolve-role` from the server-side allow-list, and there
 *     is no code path by which a request body can produce it.
 */
const GRANTABLE = new Set(["user", "organization"]);

export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const { uid, isAdmin } = auth.user;

  const limited = enforceRateLimit(request, { ...LIMITS.roleChange, uid });
  if (!limited.ok) return limited.response;

  let requested: unknown;
  try {
    const body = await request.json();
    requested = body?.role;
  } catch {
    return NextResponse.json({ error: "Send a JSON body with a `role` field." }, { status: 400 });
  }

  if (typeof requested !== "string" || !GRANTABLE.has(requested)) {
    return NextResponse.json(
      {
        error:
          "That role cannot be set here. 'admin' is assigned by the platform and cannot be self-assigned.",
      },
      { status: 400 }
    );
  }

  const nextRole = requested;
  const docRef = getAdminDb().doc(`users/${uid}`);

  try {
    const snap = await docRef.get();
    const storedRole = typeof snap.data()?.role === "string" ? (snap.data()!.role as string) : null;

    // Never let this endpoint demote an admin, even an allow-listed one: the
    // sidebar offers a "persona" switch and a mis-click must not strip console
    // access. Admins who want to use an organization persona already have the
    // organization dashboard (it accepts admin as well as organization).
    if (storedRole === "admin" && !isAdmin) {
      return NextResponse.json({ uid, role: "admin", changed: false });
    }
    if (isAdmin && nextRole !== "admin") {
      console.warn(`[account/role] admin ${uid} switched persona to ${nextRole}; role field left as admin.`);
      return NextResponse.json({ uid, role: "admin", changed: false });
    }

    if (storedRole === nextRole) {
      return NextResponse.json({ uid, role: storedRole, changed: false });
    }

    await docRef.set(
      { role: nextRole, roleUpdatedAt: new Date().toISOString() },
      { merge: true }
    );

    return NextResponse.json({ uid, role: nextRole, changed: true });
  } catch (e) {
    console.error("[account/role]", (e as Error)?.message);
    return NextResponse.json({ error: "Could not update your role." }, { status: 500 });
  }
}