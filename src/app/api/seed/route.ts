import { NextResponse } from "next/server";
import { seedOpportunities } from "@/lib/seedOpportunitiesData";
import { syncOpportunitiesToFirestore, getActiveOpportunitiesFromFirestore } from "@/lib/firestoreSync";
import { requireAdmin } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

// Writes the curated seed dataset into org_opportunities and then prunes expired
// documents. Admin-only: this was previously an unauthenticated GET, which meant
// any anonymous client (or an <img> tag) could bulk-write and bulk-delete the
// entire opportunity dataset.
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    console.log(`[api/seed] Seeding ${seedOpportunities.length} opportunities into Firestore...`);
    const syncResult = await syncOpportunitiesToFirestore(seedOpportunities);
    const active = await getActiveOpportunitiesFromFirestore();

    return NextResponse.json({
      success: true,
      message: "Firestore seeded successfully",
      syncResult,
      totalActiveInFirestore: active.length,
    });
  } catch (error: any) {
    console.error("[api/seed] Error seeding Firestore:", error);
    return NextResponse.json(
      { success: false, error: "Failed to seed Firestore" },
      { status: 500 }
    );
  }
}
