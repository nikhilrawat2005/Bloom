import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { requireUser } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

/**
 * Resolves the caller's canonical role.
 *
 * The client used to self-assign `role: "admin"` (three separate places in
 * AuthContext) based on an email allow-list that was bundled into the public JS
 * via `adminConfig.ts`. Role is now decided here, on the server, from the email
 * claim of a *verified* ID token, and written through the Admin SDK — so the
 * client never needs the allow-list at all.
 *
 * Safe to call on every sign-in: it only writes when the computed role differs
 * from the stored one.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireUser(request);
    if (!auth.ok) return auth.response;

    const uid = auth.user.uid;
    const docRef = getAdminDb().doc(`users/${uid}`);

    const snap = await docRef.get();
    const existing = snap.data() as Record<string, unknown> | undefined;

    // A brand-new user: nothing to reconcile yet.
    if (!snap.exists) {
      return NextResponse.json({ uid, role: null, created: false });
    }

    const storedRole = typeof existing?.role === "string" ? existing.role : null;
    const computedRole: string = auth.user.isAdmin ? "admin" : "user";

    if (storedRole === computedRole) {
      return NextResponse.json({ uid, role: storedRole, changed: false });
    }

    // Never silently demote a privileged role that this deployment's allow-list
    // no longer contains — that would lock an operator out of their own console.
    if (storedRole === "admin" && computedRole !== "admin") {
      console.warn(`[admin/resolve] ${uid} holds admin but is not on the allow-list; leaving role unchanged.`);
      return NextResponse.json({ uid, role: storedRole, changed: false });
    }

    // The user explicitly chose "organization" via /api/account/role. That
    // choice is not derivable from the token, so this route must never rewrite
    // it back to "user" on sign-in (an admin allow-list match still wins).
    if (storedRole === "organization" && computedRole !== "admin") {
      return NextResponse.json({ uid, role: storedRole, changed: false });
    }

    const patch: Record<string, unknown> = { role: computedRole, roleUpdatedAt: new Date().toISOString() };
    // Bind the stored email to the verified token email on first resolution, so
    // the profile can never be created with a forged address.
    if (typeof existing?.email !== "string" && auth.user.email) {
      patch.email = auth.user.email;
    }

    await docRef.set(patch, { merge: true });
    return NextResponse.json({ uid, role: computedRole, changed: true });
  } catch (e) {
    const msg = (e as Error)?.message || String(e);
    console.error("[admin/resolve] Crash:", msg, (e as Error)?.stack);
    return NextResponse.json({ error: "Could not resolve role", details: msg }, { status: 500 });
  }
}
