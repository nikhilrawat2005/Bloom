import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { requireUser } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/admin/clean-descriptions
 *
 * Scans all org_opportunities in Firestore and strips any residual
 * HTML tags from their description and eligibility fields.
 * Targets specifically Devpost-style HTML like:
 *   "$<span data-currency-value>0</span>"
 * Admin only.
 */

function stripHtml(text: string): string {
  if (!text || typeof text !== "string") return text;
  return text
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "")          // strip all HTML tags
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasHtml(text: string): boolean {
  return /<[a-z][\s\S]*?>/i.test(text);
}

export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const db = getAdminDb();
  const userDoc = await db.collection("users").doc(auth.user.uid).get();
  if (userDoc.data()?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden: admins only." }, { status: 403 });
  }

  try {
    const snap = await db.collection("org_opportunities").get();

    let cleaned = 0;
    let skipped = 0;
    const CHUNK = 250;
    const toUpdate: Array<{ id: string; description: string; eligibility: string }> = [];

    snap.forEach((d) => {
      const data = d.data();
      const desc = data.description || "";
      const elig = data.eligibility || "";

      const descHasHtml = hasHtml(desc);
      const eligHasHtml = hasHtml(elig);

      if (descHasHtml || eligHasHtml) {
        toUpdate.push({
          id: d.id,
          description: descHasHtml ? stripHtml(desc) : desc,
          eligibility: eligHasHtml ? stripHtml(elig) : elig,
        });
      } else {
        skipped++;
      }
    });

    // Batch update in chunks of 250
    for (let i = 0; i < toUpdate.length; i += CHUNK) {
      const chunk = toUpdate.slice(i, i + CHUNK);
      const batch = db.batch();
      for (const item of chunk) {
        batch.update(db.collection("org_opportunities").doc(item.id), {
          description: item.description,
          eligibility: item.eligibility,
        });
      }
      await batch.commit();
      cleaned += chunk.length;
    }

    return NextResponse.json({
      ok: true,
      cleaned,
      skipped,
      total: snap.size,
      message: `✅ ${cleaned} posts cleaned (HTML stripped). ${skipped} were already clean.`,
    });
  } catch (err: any) {
    console.error("[clean-descriptions] Error:", err);
    return NextResponse.json({ error: err.message || "Cleanup failed." }, { status: 500 });
  }
}
