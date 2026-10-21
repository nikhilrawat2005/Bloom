"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc, getDocs, collection, query, where, deleteDoc } from "firebase/firestore";
import { Opportunity } from "@/lib/mockData";
import { useOpportunities, formatDeadline } from "@/hooks/useOpportunities";
import {
  Bookmark,
  Calendar,
  Bell,
  Clock,
  ArrowRight,
  Trash2,
  Wallet,
  ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, Chip, EmptyState } from "@/components/ui";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/Reveal";

interface Reminder {
  id: string;
  opportunityId: string;
  opportunityTitle: string;
  deadline: string;
}

/**
 * These four cards were each given their own raw colour pair
 * (`text-blue-500`, `text-amber-500`, `text-emerald-500`, `text-purple-500`) on
 * a slate background, which is where the "generic template" read came from.
 * They now draw from one token per state, so the row reads as a set.
 */
const EASE = [0.22, 1, 0.36, 1] as const;

function SkeletonDashboard() {
  return (
    <div className="space-y-8">
      <div className="card flex items-center justify-between gap-4 p-8">
        <div className="space-y-3">
          <div className="skeleton h-3 w-40" />
          <div className="skeleton h-7 w-56" />
          <div className="skeleton h-3 w-32" />
        </div>
        <div className="skeleton hidden h-14 w-40 rounded-lg sm:block" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="skeleton h-36 rounded-lg" />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-20 rounded-md" />
          ))}
        </div>
        <div className="skeleton h-64 rounded-lg" />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { currentUser, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const { opportunities } = useOpportunities();

  const [savedOpps, setSavedOpps] = useState<Opportunity[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [docCount, setDocCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.push("/auth/login");
    }
  }, [currentUser, authLoading, router]);

  useEffect(() => {
    if (!currentUser) return;

    const fetchDashboardData = async () => {
      try {
        // 1. Fetch saved bookmarks
        const bookmarkSnap = await getDoc(doc(db, "bookmarks", currentUser.uid));
        if (bookmarkSnap.exists()) {
          const bData = bookmarkSnap.data();
          const snapshotItems: Opportunity[] = Array.isArray(bData.items) ? bData.items : [];
          const savedIds: string[] = bData.opportunityIds || [];
          if (snapshotItems.length > 0) {
            setSavedOpps(snapshotItems);
          } else {
            const matches = opportunities.filter((o) => savedIds.includes(o.id));
            setSavedOpps(matches);
          }
        }

        // 2. Fetch reminders
        const qReminders = query(collection(db, "reminders"), where("uid", "==", currentUser.uid));
        const querySnap = await getDocs(qReminders);
        const remsList: Reminder[] = [];
        querySnap.forEach((docSnap) => {
          const data = docSnap.data();
          remsList.push({
            id: docSnap.id,
            opportunityId: data.opportunityId,
            opportunityTitle: data.opportunityTitle,
            deadline: data.deadline,
          });
        });
        setReminders(remsList);

        // 3. Fetch wallet documents count
        const qDocs = query(collection(db, "wallet"), where("uid", "==", currentUser.uid));
        const docsSnap = await getDocs(qDocs);
        setDocCount(docsSnap.size);
      } catch (error) {
        console.error("Error loading dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [currentUser, opportunities]);

  const deleteReminder = async (reminderId: string) => {
    try {
      await deleteDoc(doc(db, "reminders", reminderId));
      setReminders((prev) => prev.filter((r) => r.id !== reminderId));
    } catch (error) {
      console.error("Error deleting reminder:", error);
    }
  };

  if (authLoading || loading) {
    return <SkeletonDashboard />;
  }

  // Calculate upcoming deadlines count (within next 30 days)
  const incomingDeadlinesCount = reminders.filter((r) => {
    const deadlineTime = new Date(r.deadline).getTime();
    const nowTime = new Date().getTime();
    const diffDays = (deadlineTime - nowTime) / (1000 * 60 * 60 * 24);
    return diffDays > 0 && diffDays <= 30;
  }).length;

  const tabSummaries = [
    {
      title: "Opportunity Wallet",
      metric: `${docCount} Documents`,
      subtext: docCount > 0 ? "Credentials & records synced" : "Upload resume & certificates",
      href: "/dashboard/wallet",
      icon: Wallet,
      pill: "Vault",
    },
    {
      title: "Calendar Hub",
      metric: `${reminders.length} Active Alerts`,
      subtext: incomingDeadlinesCount > 0 ? `${incomingDeadlinesCount} closing this month` : "Track deadlines & schedules",
      href: "/dashboard/calendar",
      icon: Calendar,
      pill: "Deadlines",
    },
  ];

  return (
    <div className="space-y-10">
      {/* Welcome + deadline summary */}
      <Reveal>
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div className="min-w-0">
            <span className="eyebrow text-secondary">Workspace Dashboard</span>
            <h1 className="mt-3 text-display-sm text-foreground">
              Hello,{" "}
              <span className="font-display italic text-secondary">
                {profile?.name || currentUser?.displayName || "NEXORA Scholar"}
              </span>
            </h1>
            <p className="mt-2 text-sm text-foreground-muted">
              {profile?.education ? `${profile.education} · ` : ""}
              {profile?.location || "NEXORA Platform"}
            </p>
          </div>

          <Link
            href="/dashboard/notifications"
            className="card flex shrink-0 items-center gap-3 p-4 transition-colors duration-base hover:bg-surface-raised"
          >
            <span className="relative">
              <Bell className="h-5 w-5 text-foreground" />
              {incomingDeadlinesCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-2xs font-semibold text-white">
                  {incomingDeadlinesCount}
                </span>
              )}
            </span>
            <span className="text-left">
              <span className="eyebrow block">Deadlines Pending</span>
              <span className="mt-1 block text-sm font-medium text-foreground">
                {incomingDeadlinesCount} closing this month
              </span>
            </span>
          </Link>
        </div>
      </Reveal>

      {/* Summary grid */}
      <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {tabSummaries.map((tab) => {
          const Icon = tab.icon;
          return (
            <StaggerItem key={tab.title}>
              <Link href={tab.href} className="card group block h-40 p-5" data-interactive="true">
                <div className="flex items-start justify-between gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-md border border-border bg-surface-raised text-secondary">
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <Chip className="transition-colors duration-base group-hover:text-secondary">
                    {tab.pill}
                  </Chip>
                </div>
                <div className="mt-5">
                  <span className="eyebrow">{tab.title}</span>
                  <p className="mt-1.5 truncate font-display text-lg leading-tight text-foreground">
                    {tab.metric}
                  </p>
                  <p className="mt-1.5 flex items-center justify-between gap-2 text-xs text-foreground-muted">
                    <span className="truncate">{tab.subtext}</span>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-foreground-subtle transition-transform duration-base group-hover:translate-x-0.5" />
                  </p>
                </div>
              </Link>
            </StaggerItem>
          );
        })}
      </Stagger>

      {/* Saved + reminders */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <section className="space-y-5 lg:col-span-2">
          <div className="flex items-center justify-between gap-4">
            <h2 className="flex items-center gap-2 font-display text-lg text-foreground">
              <Bookmark className="h-4.5 w-4.5 text-secondary" />
              Saved Opportunities
            </h2>
            <Link
              href="/explore"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-secondary transition-colors duration-base hover:text-secondary-hover"
            >
              Explore more <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {savedOpps.length === 0 ? (
            <EmptyState
              icon={<Bookmark className="h-5 w-5" />}
              title="No saved opportunities yet"
              description="Bookmark opportunities on the explore screen to view them here."
            />
          ) : (
            <ul className="space-y-3">
              <AnimatePresence initial={false}>
                {savedOpps.map((opp) => (
                  <motion.li
                    key={opp.id}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -12, transition: { duration: 0.18 } }}
                    transition={{ duration: 0.4, ease: EASE }}
                  >
                    <Card className="flex flex-col items-start justify-between gap-4 p-5 sm:flex-row sm:items-center">
                      <div className="min-w-0">
                        <Chip tone="gold">{opp.category}</Chip>
                        <h3 className="mt-2 font-display text-base leading-snug text-foreground">
                          <Link
                            href={`/opportunity/${opp.id}`}
                            className="transition-colors duration-base hover:text-secondary"
                          >
                            {opp.title}
                          </Link>
                        </h3>
                        <p className="mt-1 text-sm text-foreground-muted">{opp.organization}</p>
                      </div>
                      <div className="flex w-full items-center justify-between gap-4 sm:w-auto">
                        <span className="text-xs text-foreground-subtle">
                          {formatDeadline(opp.deadline)}
                        </span>
                        <Link
                          href={`/opportunity/${opp.id}`}
                          className="btn btn-sm btn-secondary"
                        >
                          Details
                        </Link>
                      </div>
                    </Card>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </section>

        <section className="space-y-5">
          <h2 className="flex items-center gap-2 font-display text-lg text-foreground">
            <Clock className="h-4.5 w-4.5 text-secondary" />
            Upcoming Reminders
          </h2>

          <Card className="p-5">
            {reminders.length === 0 ? (
              <EmptyState
                icon={<Bell className="h-5 w-5" />}
                title="No active alerts"
                description={'Click "Set Reminder" on any opportunity page to receive alerts.'}
                className="border-0 bg-transparent px-0 py-6"
              />
            ) : (
              <ul className="space-y-4">
                <AnimatePresence initial={false}>
                  {reminders.map((rem) => {
                    const daysLeft = Math.ceil(
                      (new Date(rem.deadline).getTime() - new Date().getTime()) /
                        (1000 * 60 * 60 * 24)
                    );
                    const isClosingSoon = daysLeft > 0 && daysLeft <= 30;

                    return (
                      <motion.li
                        key={rem.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -12, transition: { duration: 0.18 } }}
                        transition={{ duration: 0.4, ease: EASE }}
                        className="flex items-start justify-between gap-3 border-b border-border pb-4 last:border-0 last:pb-0"
                      >
                        <div className="min-w-0 space-y-1.5">
                          <h3 className="text-sm font-medium leading-snug text-foreground">
                            <Link
                              href={`/opportunity/${rem.opportunityId}`}
                              className="transition-colors duration-base hover:text-secondary"
                            >
                              {rem.opportunityTitle}
                            </Link>
                          </h3>
                          <Chip tone={isClosingSoon ? "danger" : "neutral"}>
                            {daysLeft > 0 ? `${daysLeft} days left` : "Deadline passed"}
                          </Chip>
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteReminder(rem.id)}
                          title="Remove Reminder"
                          aria-label={`Remove reminder for ${rem.opportunityTitle}`}
                          className="grid h-7 w-7 shrink-0 place-items-center rounded-sm text-foreground-subtle transition-colors duration-fast hover:bg-danger-surface hover:text-danger"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
            )}
          </Card>
        </section>
      </div>
    </div>
  );
}