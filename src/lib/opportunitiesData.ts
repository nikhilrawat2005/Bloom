/**
 * opportunitiesData.ts
 *
 * Non-hook, one-shot async helper that fetches real, approved opportunities
 * from Firestore's "org_opportunities" collection (organization-posted +
 * automated-ingestion listings).
 *
 * Use this in plain async functions (server utilities, automation engine,
 * etc.) where React hooks (useOpportunities) are not available.
 */

import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Opportunity, normalizeOpportunityDoc } from "@/lib/mockData";

export async function getAllOpportunitiesOnce(): Promise<Opportunity[]> {
  try {
    const q = query(
      collection(db, "org_opportunities"),
      where("status", "==", "approved")
    );
    const snap = await getDocs(q);
    const items: Opportunity[] = [];
    snap.forEach((d) => {
      items.push(normalizeOpportunityDoc(d.id, d.data() as Record<string, unknown>));
    });
    return items;
  } catch (err) {
    console.error("getAllOpportunitiesOnce: Firestore fetch failed:", err);
    return [];
  }
}
