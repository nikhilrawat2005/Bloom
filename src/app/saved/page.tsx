"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useOpportunities, formatDeadline } from "@/hooks/useOpportunities";
import { Chip } from "@/components/ui/Chip";
import {
  Bookmark,
  BookmarkCheck,
  Calendar,
  MapPin,
  Loader2,
  Sparkles,
  ChevronRight,
  Trash2,
  ExternalLink,
  Bell,
  Clock,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
} from "lucide-react";

interface SavedItem {
  id: string;
  title: string;
  organization?: string;
  orgName?: string;
  description?: string;
  eligibility?: string;
  deadline?: string;
  country?: string;
  category?: string;
  field?: string;
  applyLink?: string;
  sourceUrl?: string;
  _source?: string;
}

// ── Timeline helpers ────────────────────────────────────────────

// Returns days until the deadline, or `null` when there is no parseable
// date at all — `null` must NOT be confused with "already expired".
function daysUntil(dateStr?: string): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  if (isNaN(target.getTime())) return null;
  const now = new Date();
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Returns how far along we are in the "tracking window" (0–100).
 * Tracking window = 90 days before deadline.
 */
function deadlineProgress(dateStr?: string): number {
  const days = daysUntil(dateStr);
  if (days === null) return 0;
  if (days < 0) return 100;
  const totalWindow = 90;
  return Math.max(0, Math.min(100, Math.round(((totalWindow - days) / totalWindow) * 100)));
}

type UrgencyLevel = "none" | "expired" | "critical" | "urgent" | "approaching" | "safe";

function getUrgency(days: number | null): UrgencyLevel {
  if (days === null) return "none";
  if (days < 0) return "expired";
  if (days <= 1) return "critical";
  if (days <= 3) return "urgent";
  if (days <= 7) return "approaching";
  return "safe";
}

const urgencyConfig: Record<
  UrgencyLevel,
  { label: string; bar: string; badge: string; text: string; icon: React.ReactNode }
> = {
  none: {
    label: "No deadline",
    bar: "bg-border",
    badge: "chip",
    text: "text-foreground-muted",
    icon: <Calendar className="w-3.5 h-3.5" />,
  },
  expired: {
    label: "Expired",
    bar: "bg-foreground-subtle",
    badge: "chip",
    text: "text-foreground-subtle",
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
  },
  critical: {
    label: "Last Day!",
    bar: "bg-danger",
    badge: "chip-danger",
    text: "text-danger",
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
  },
  urgent: {
    label: "Urgent",
    bar: "bg-warning",
    badge: "chip-warning",
    text: "text-warning",
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
  },
  approaching: {
    label: "Approaching",
    bar: "bg-info",
    badge: "chip-info",
    text: "text-info",
    icon: <Clock className="w-3.5 h-3.5" />,
  },
  safe: {
    label: "On Track",
    bar: "bg-success",
    badge: "chip-success",
    text: "text-success",
    icon: <TrendingUp className="w-3.5 h-3.5" />,
  },
};

function DeadlineTimeline({ deadline }: { deadline?: string }) {
  const days = daysUntil(deadline);
  const progress = deadlineProgress(deadline);
  const urgency = getUrgency(days);
  const cfg = urgencyConfig[urgency];

  const dayLabel =
    days === null
      ? "No deadline set"
      : days < 0
      ? "Deadline passed"
      : days === 0
      ? "Today!"
      : days === 1
      ? "1 day left"
      : `${days} days left`;

  return (
    <div className="mt-4 space-y-1.5">
      {/* Bar */}
      <div className="relative h-1.5 w-full bg-surface-raised rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${cfg.bar}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Labels row */}
      <div className="flex items-center justify-between text-xs">
        <span className={`flex items-center gap-1 font-bold ${cfg.text}`}>
          {cfg.icon} {dayLabel}
        </span>
        <Chip tone={urgency === "expired" ? "neutral" : urgency === "critical" ? "danger" : urgency === "urgent" ? "warning" : urgency === "approaching" ? "info" : "success"} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">
          {cfg.label}
        </Chip>
      </div>
    </div>
  );
}

export default function SavedOpportunities() {
  const { currentUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const { opportunities } = useOpportunities();
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.push("/auth/login");
    }
  }, [currentUser, authLoading, router]);

  useEffect(() => {
    if (!currentUser) return;

    const fetchSaved = async () => {
      try {
        const snap = await getDoc(doc(db, "bookmarks", currentUser.uid));
        if (snap.exists()) {
          const data = snap.data();
          const snapshotItems: SavedItem[] =
            data.items && Array.isArray(data.items) ? (data.items as SavedItem[]) : [];
          const ids: string[] = data.opportunityIds || [];

          // Merge snapshots first, then fill in any legacy id-only bookmarks
          // that still resolve to an approved Firestore opportunity.
          const existingIds = new Set(snapshotItems.map((i) => i.id));
          const fallback = opportunities
            .filter((o) => ids.includes(o.id) && !existingIds.has(o.id))
            .map((o) => ({
              id: o.id,
              title: o.title,
              organization: o.organization,
              orgName: o.organization,
              description: o.description,
              deadline: (o as any).deadline,
              country: (o as any).country,
              category: (o as any).category,
              field: (o as any).field,
              applyLink: (o as any).applyLink,
            }));
          setSavedItems([...snapshotItems, ...fallback]);
        }
      } catch (err) {
        console.error("Error loading saved opportunities:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSaved();
  }, [currentUser, opportunities]);

  const removeBookmark = async (oppId: string) => {
    if (!currentUser) return;
    try {
      const snap = await getDoc(doc(db, "bookmarks", currentUser.uid));
      const existing = snap.exists() ? snap.data() : { opportunityIds: [], items: [] };
      const ids: string[] = existing.opportunityIds || [];
      const items: SavedItem[] = existing.items || [];
      await setDoc(doc(db, "bookmarks", currentUser.uid), {
        opportunityIds: ids.filter((i) => i !== oppId),
        items: items.filter((i) => i.id !== oppId),
      });
      setSavedItems((prev) => prev.filter((o) => o.id !== oppId));
    } catch (err) {
      console.error("Error removing bookmark:", err);
    }
  };

  // Sort by urgency: most urgent first
  const sortedItems = [...savedItems].sort((a, b) => {
    const da = daysUntil(a.deadline);
    const db_ = daysUntil(b.deadline);
    // Undated items go to the very bottom (expired sits above them)
    if (da === null && db_ === null) return 0;
    if (da === null) return 1;
    if (db_ === null) return -1;
    // Expired at the bottom
    if (da < 0 && db_ >= 0) return 1;
    if (db_ < 0 && da >= 0) return -1;
    if (da < 0 && db_ < 0) return 0;
    return da - db_;
  });

  // Stats
  const totalSaved = savedItems.length;
  const criticalCount = savedItems.filter((i) => {
    const d = daysUntil(i.deadline);
    return d !== null && d >= 0 && d <= 3;
  }).length;
  const expiredCount = savedItems.filter((i) => {
    const d = daysUntil(i.deadline);
    return d !== null && d < 0;
  }).length;
  const activeCount = totalSaved - expiredCount;

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background transition-colors duration-300">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <>
      <Navbar />

      <main className="flex-grow bg-background min-h-screen py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-300">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
              <Bookmark className="w-3.5 h-3.5" /> Saved Collection
            </span>
            <h1 className="text-3xl font-extrabold text-foreground mt-2">
              Your Bookmarked Opportunities
            </h1>
            <p className="text-sm text-foreground-muted mt-1">
              {totalSaved > 0
                ? `${totalSaved} opportunit${totalSaved !== 1 ? "ies" : "y"} saved — sorted by deadline urgency.`
                : "Your bookmarked opportunities will appear here."}
            </p>
          </div>

          {/* Stats strip */}
          {totalSaved > 0 && (
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="bg-surface border border-border rounded-2xl p-4 text-center">
                <p className="text-2xl font-extrabold text-foreground">{activeCount}</p>
                <p className="text-2xs font-semibold text-foreground-muted uppercase tracking-wide">Active</p>
                <Chip tone={activeCount > 0 ? "success" : "neutral"} className="mt-1"/>
              </div>
              <div className={`${criticalCount > 0 ? "border-red-300 dark:border-red-800" : "border-border"} rounded-2xl p-4 text-center ${criticalCount > 0 ? "bg-red-100/20" : ""}`}>
                <p className={`${criticalCount > 0 ? "text-red-500" : "text-foreground"} text-2xl font-extrabold`}>
                  {criticalCount}
                </p>
                <p className="text-2xs font-semibold text-foreground-muted uppercase tracking-wide">Critical (≤3d)</p>
                <Chip tone="danger" className="mt-1"/>
              </div>
              <div className="bg-surface border border-border rounded-2xl p-4 text-center">
                <p className="text-2xl font-extrabold text-foreground-muted">{expiredCount}</p>
                <p className="text-2xs font-semibold text-foreground-muted uppercase tracking-wide">Expired</p>
                <Chip tone="neutral" className="mt-1"/>
              </div>
            </div>
          )}

          {/* Grid */}
          {sortedItems.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {sortedItems.map((opp) => {
                const applyLink: string = (opp as any).applyLink || "";
                const liveOpp = (opp as any)._source || false;
                const days = daysUntil(opp.deadline);
                const urgency = getUrgency(days);
                const isExpired = urgency === "expired";

                return (
                  <div
                    key={opp.id}
                    className={`bg-surface border rounded-3xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group card-hover ${
                      urgency === "critical"
                        ? "border-red-300 dark:border-red-800/60 dark:hover:shadow-[0_4px_20px_rgba(239,68,68,0.15)]"
                        : urgency === "urgent"
                        ? "border-orange-300 dark:border-orange-800/60"
                        : "border-border hover:border-primary/25 dark:hover:shadow-[0_4px_20px_rgba(255,60,110,0.12)]"
                    } ${isExpired ? "opacity-60" : ""}`}
                  >
                    <div>
                      {/* Header */}
                      <div className="flex items-start justify-between gap-3 mb-4">
<div className="flex items-center gap-2 flex-wrap">
                          <Chip tone="gold" className="text-xs uppercase">
                            {opp.category || "Opportunity"}
                          </Chip>
                          {liveOpp && (
                            <span className="text-[10px] text-foreground-muted font-medium">
                              {opp._source}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeBookmark(opp.id)}
                          aria-label={`Remove bookmark for ${opp.title}`}
                          title="Remove bookmark"
                          className="inline-flex items-center p-1.5 rounded-full flex-shrink-0 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Title */}
                      <h3 className="font-bold text-foreground text-base leading-snug group-hover:text-primary transition-colors">
                        {applyLink ? <a href={applyLink} target="_blank" rel="noopener noreferrer">{opp.title}</a> : <span>{opp.title}</span>}
                      </h3>
                      <p className="text-foreground-muted text-xs mt-1 font-medium">{opp.organization || opp.orgName}</p>

                      {/* Description */}
                      <p className="text-foreground-muted text-xs mt-4 leading-relaxed line-clamp-2">
                        {opp.description}
                      </p>

                      {/* ── Deadline Timeline ── */}
                      <DeadlineTimeline deadline={opp.deadline} />
                    </div>

                    {/* Footer Metadata */}
                    <div className="border-t border-border mt-5 pt-4 flex items-center justify-between text-2xs text-foreground-muted">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          {opp.country || "—"}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {formatDeadline(opp.deadline || "")}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Notification reminder link */}
                        <Link
                          href="/dashboard/notifications"
                          className="p-1.5 rounded-full text-foreground-muted hover:text-primary hover:bg-primary/10 transition-all"
                          title="View notifications"
                        >
                          <Bell className="w-3.5 h-3.5" />
                        </Link>

                        {applyLink ? (
                          <a href={applyLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-0.5 text-primary font-semibold hover:translate-x-0.5 transition-transform">
                            Apply <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        ) : (
                          <Link href={`/opportunity/${opp.id}`} className="flex items-center gap-0.5 text-primary font-semibold hover:translate-x-0.5 transition-transform">
                            Details <ChevronRight className="w-3.5 h-3.5" />
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Empty State */
            <div className="text-center py-24 bg-surface border border-border rounded-3xl shadow-sm transition-colors">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <BookmarkCheck className="w-10 h-10 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">No saved opportunities</h3>
              <p className="text-foreground-muted text-2xs max-w-sm mx-auto mb-8">
                Bookmark opportunities from the Explore page to track them here and receive deadline
                reminders.
              </p>
              <Link
                href="/explore"
                className="inline-flex items-center gap-2 px-6 py-3.5 bg-primary hover:bg-primary/25 text-white font-semibold text-sm rounded-full shadow-md transition-all dark:shadow-[0_4px_12px_rgba(255,60,110,0.3)]"
              >
                <Sparkles className="w-4 h-4" />
                Explore Opportunities
              </Link>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </>
  );
}
