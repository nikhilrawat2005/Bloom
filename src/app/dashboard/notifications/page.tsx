"use client";

import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/hooks/useNotifications";
import { db } from "@/lib/firebase";
import { doc, updateDoc, deleteDoc, writeBatch } from "firebase/firestore";
import { useState, useEffect } from "react";
import { refreshDeadlineAlerts } from "@/lib/automationEngine";
import {
  Bell,
  Check,
  CheckSquare,
  Clock,
  AlarmClock,
  Sparkles,
  Briefcase,
  Layers,
  Trash2,
  Inbox,
  Loader2,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Button, Card, Chip, EmptyState } from "@/components/ui";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/Reveal";
import type { NotificationCategory } from "@/lib/types";

const EASE = [0.22, 1, 0.36, 1] as const;

const FILTERS: { key: string; label: string }[] = [
  { key: "all", label: "All Alerts" },
  { key: "unread", label: "Unread" },
  { key: "deadline_alert", label: "Deadlines" },
  { key: "new_opportunity", label: "New Matches" },
  { key: "application_update", label: "Updates" },
  { key: "ai_suggestion", label: "AI Suggestions" },
];

/**
 * Each category used to carry its own hand-written colour pair
 * (`text-red-500`, `text-blue-500`, `text-amber-500`, …). That meant a red
 * alert on this page was not necessarily the same red as a red deadline
 * elsewhere. One tone per category, taken from the tokens.
 */
const CATEGORY_META: Record<
  NotificationCategory,
  { icon: typeof Bell; tone: "danger" | "info" | "neutral" | "warning" | "gold" }
> = {
  deadline_alert: { icon: Clock, tone: "danger" },
  interview_reminder: { icon: AlarmClock, tone: "warning" },
  new_opportunity: { icon: Briefcase, tone: "info" },
  application_update: { icon: Layers, tone: "neutral" },
  ai_suggestion: { icon: Sparkles, tone: "gold" },
};

const categoryLabel = (category: string) => category.replace("_", " ");

export default function NotificationsPage() {
  const { currentUser } = useAuth();
  const { notifications, loading } = useNotifications(currentUser?.uid);
  const [filter, setFilter] = useState<string>("all");

  // Refresh deadline milestone alerts every time the user opens this page
  useEffect(() => {
    if (!currentUser?.uid) return;
    refreshDeadlineAlerts(currentUser.uid).catch((e) =>
      console.warn("Deadline refresh failed:", e)
    );
  }, [currentUser?.uid]);

  const markAsRead = async (id: string) => {
    if (!currentUser) return;
    try {
      await updateDoc(doc(db, "notifications", currentUser.uid, "items", id), {
        isRead: true,
      });
    } catch (err) {
      console.error("Error marking read:", err);
    }
  };

  const deleteNotification = async (id: string) => {
    if (!currentUser) return;
    try {
      await deleteDoc(doc(db, "notifications", currentUser.uid, "items", id));
    } catch (err) {
      console.error("Error deleting notification:", err);
    }
  };

  const markAllRead = async () => {
    if (!currentUser || notifications.length === 0) return;
    try {
      const batch = writeBatch(db);
      notifications.forEach((n) => {
        if (!n.isRead) {
          const ref = doc(db, "notifications", currentUser.uid, "items", n.id);
          batch.update(ref, { isRead: true });
        }
      });
      await batch.commit();
    } catch (err) {
      console.error("Error marking all read:", err);
    }
  };

  const clearAll = async () => {
    if (!currentUser || notifications.length === 0) return;
    try {
      const batch = writeBatch(db);
      notifications.forEach((n) => {
        const ref = doc(db, "notifications", currentUser.uid, "items", n.id);
        batch.delete(ref);
      });
      await batch.commit();
    } catch (err) {
      console.error("Error clearing notifications:", err);
    }
  };

  // Filter logic
  const filtered = notifications.filter((n) => {
    if (filter === "all") return true;
    if (filter === "unread") return !n.isRead;
    return n.category === filter;
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-secondary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <Reveal>
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <span className="eyebrow text-secondary">Inbox</span>
            <h1 className="mt-3 text-display-sm text-foreground">Notification Center</h1>
            <p className="mt-2 text-sm text-foreground-muted">
              Stay updated with deadline alerts, status updates, and personalized AI suggestions.
            </p>
          </div>

          {notifications.length > 0 && (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={markAllRead}>
                <CheckSquare className="h-3.5 w-3.5" />
                Mark all read
                {unreadCount > 0 && (
                  <span className="ml-1 text-foreground-subtle">{unreadCount}</span>
                )}
              </Button>
              <Button size="sm" variant="danger" onClick={clearAll}>
                <Trash2 className="h-3.5 w-3.5" />
                Clear all
              </Button>
            </div>
          )}
        </div>
      </Reveal>

      {/* Filter tabs */}
      <Reveal delay={0.05}>
        <div
          role="tablist"
          aria-label="Filter notifications"
          className="scrollbar-none flex gap-2 overflow-x-auto pb-1"
        >
          {FILTERS.map((tab) => {
            const isActive = filter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setFilter(tab.key)}
                className={`whitespace-nowrap rounded-full border px-4 py-1.5 text-xs font-medium transition-all duration-base ${
                  isActive
                    ? "border-transparent bg-surface-ink text-background"
                    : "border-border bg-surface text-foreground-muted hover:bg-surface-raised hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </Reveal>

      {/* Notification list */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Inbox className="h-5 w-5" />}
          title="Inbox is empty"
          description={
            filter === "all"
              ? "No alerts generated yet."
              : `No alerts match the category: "${filter}".`
          }
        />
      ) : (
        <Stagger as="ul" className="space-y-3">
          <AnimatePresence initial={false}>
            {filtered.map((item) => {
              const meta = CATEGORY_META[item.category] ?? {
                icon: Bell,
                tone: "neutral" as const,
              };
              const Icon = meta.icon;

              return (
                <StaggerItem as="li" key={item.id}>
                  <motion.div
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -12, transition: { duration: 0.18 } }}
                    transition={{ duration: 0.4, ease: EASE }}
                  >
                    <Card
                      className={`flex items-start gap-4 p-4 transition-opacity duration-base ${
                        item.isRead ? "opacity-70" : "border-l-2 border-l-secondary"
                      }`}
                    >
                      <span
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-border bg-surface-raised"
                      >
                        <Icon className="h-4 w-4 text-secondary" />
                      </span>

                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <Chip tone={meta.tone}>{categoryLabel(item.category)}</Chip>
                          <span className="text-xs font-medium text-foreground-subtle">
                            {new Date(item.createdAt).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <h3
                          className={`text-sm text-foreground ${
                            item.isRead ? "font-medium" : "font-semibold"
                          }`}
                        >
                          {item.title}
                        </h3>
                        <p className="text-xs leading-relaxed text-foreground-muted">{item.message}</p>

                        {item.linkedRoute && (
                          <Link
                            href={item.linkedRoute}
                            className="inline-flex items-center gap-1 text-xs font-medium text-secondary transition-colors duration-base hover:text-secondary-hover"
                          >
                            View Details <ChevronRight className="h-3 w-3" />
                          </Link>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        {!item.isRead && (
                          <button
                            type="button"
                            onClick={() => markAsRead(item.id)}
                            title="Mark as read"
                            aria-label={`Mark "${item.title}" as read`}
                            className="grid h-7 w-7 place-items-center rounded-sm text-secondary transition-colors duration-fast hover:bg-accent-gold-surface hover:text-secondary-hover"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => deleteNotification(item.id)}
                          title="Delete alert"
                          aria-label={`Delete alert "${item.title}"`}
                          className="grid h-7 w-7 place-items-center rounded-sm text-foreground-subtle transition-colors duration-fast hover:bg-danger-surface hover:text-danger"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </Card>
                  </motion.div>
                </StaggerItem>
              );
            })}
          </AnimatePresence>
        </Stagger>
      )}
    </div>
  );
}