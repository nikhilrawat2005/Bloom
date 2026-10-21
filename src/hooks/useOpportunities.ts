"use client";

import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Opportunity, normalizeOpportunityDoc } from "@/lib/mockData";

/**
 * Loads real, approved opportunities from Firestore's "org_opportunities"
 * collection. This includes both organization-posted listings and
 * automated-ingestion listings (trusted-feed entries are auto-approved;
 * scraped entries only appear here once an admin approves them).
 *
 * Only status === "approved" listings are shown to end users — "pending"
 * and "rejected" stay hidden until/unless approved via the admin panel.
 */
export function useOpportunities() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "org_opportunities"),
      where("status", "==", "approved")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const items: Opportunity[] = [];
        const now = Date.now();
        snap.forEach((d) => {
          const data = d.data();
          const deadline = data.deadline;
          // Check if expired
          if (deadline && typeof deadline === "string") {
            const lower = deadline.toLowerCase();
            const isEvergreen = lower.includes("rolling") || lower.includes("check official") || lower.includes("tbd") || lower.includes("open until");
            if (!isEvergreen) {
              const dt = new Date(deadline);
              if (!isNaN(dt.getTime())) {
                const endOfDay = new Date(dt);
                endOfDay.setHours(23, 59, 59, 999);
                if (endOfDay.getTime() < now) return; // Skip expired
              }
            }
          }
          items.push(normalizeOpportunityDoc(d.id, data));
        });
        setOpportunities(items);
        setLoading(false);
      },
      (err) => {
        console.error("Failed to load org_opportunities:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  return { opportunities, loading };
}

/**
 * Safely formats a deadline that might be a real ISO date OR a placeholder
 * string like "Rolling — check official site" (from real-world data that
 * doesn't have an exact date yet).
 */
export function formatDeadline(deadline: string): string {
  const date = new Date(deadline);
  if (isNaN(date.getTime())) {
    return deadline; // show the raw placeholder text instead of "Invalid Date"
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
