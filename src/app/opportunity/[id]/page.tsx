"use client";

import { use, useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Opportunity } from "@/lib/mockData";
import { useOpportunities, formatDeadline } from "@/hooks/useOpportunities";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  setDoc
} from "firebase/firestore";
import { trimSavedOpportunities } from "@/lib/savedOpportunities";
import {
  Calendar,
  MapPin,
  Bookmark,
  BookmarkCheck,
  Share2,
  FileText,
  AlertCircle,
  ExternalLink,
  Bell,
  ArrowLeft,
  Loader2,
  Check
} from "lucide-react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { seedOpportunityNotification } from "@/lib/automationEngine";

/* ── Animation Variants ─────────────────────────────────────── */
const pageVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.09, delayChildren: 0.05 },
  },
};

const sectionVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.42, ease: "easeOut" } },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 24, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.48, ease: [0.23, 1, 0.32, 1] } },
};

const checklistItemVariants: Variants = {
  hidden: { opacity: 0, x: -10 },
  show: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { duration: 0.28, delay: i * 0.06, ease: "easeOut" },
  }),
};

export default function OpportunityDetail({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const { currentUser } = useAuth();
  const { opportunities } = useOpportunities();

  const [opp, setOpp] = useState<Opportunity | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);
  const [reminderSaved, setReminderSaved] = useState(false);
  const [reminderLoading, setReminderLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const viewCountedRef = useRef<string | null>(null);

  // Real view-count tracking. Runs exactly ONCE per opportunity id per page
  // visit — deliberately NOT dependent on `opportunities` (which comes from
  // a live onSnapshot listener). The ref guard makes this a true one-shot.
  //
  // This used to write straight to Firestore from the browser, which is why
  // `org_opportunities` had to be world-writable in the rules. The increment is
  // now an Admin-SDK server call so the collection can stay locked down.
  useEffect(() => {
    if (viewCountedRef.current === id) return;
    viewCountedRef.current = id;
    fetch("/api/opportunities/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch((err) => console.warn("View count increment failed:", err));
  }, [id]);

  useEffect(() => {
    const fetchOpp = async () => {
      const match = opportunities.find((o) => o.id === id);
      if (!match) {
        setLoading(false);
        return;
      }
      setOpp(match);

      if (currentUser) {
        const snap = await getDoc(doc(db, "bookmarks", currentUser.uid));
        if (snap.exists()) {
          const ids = snap.data().opportunityIds || [];
          setIsSaved(ids.includes(id));
        }

        const remSnap = await getDoc(doc(db, "reminders", `${currentUser.uid}_${id}`));
        if (remSnap.exists()) {
          setReminderSaved(true);
        }
      }
      setLoading(false);
    };
    fetchOpp();
  }, [id, currentUser, opportunities]);

  const toggleBookmark = async () => {
    if (!currentUser) {
      router.push("/auth/login");
      return;
    }

    const docRef = doc(db, "bookmarks", currentUser.uid);

    try {
      const snap = await getDoc(docRef);
      const existing = snap.exists() ? snap.data() : { opportunityIds: [], items: [] };
      const ids: string[] = Array.isArray(existing.opportunityIds) ? existing.opportunityIds : [];
      const items: any[] = Array.isArray(existing.items) ? existing.items : [];
      const nextIds = isSaved ? ids.filter((i) => i !== id) : [...ids.filter((i) => i !== id), id];
      const nextItems = isSaved ? items.filter((it: any) => it?.id !== id) : items;
      // Keep the saved section within its limit: drop the oldest entries.
      const trimmed = trimSavedOpportunities(nextIds, nextItems);
      await setDoc(docRef, { opportunityIds: trimmed.opportunityIds, items: trimmed.items });
      const nowSaved = !isSaved;
      setIsSaved(nowSaved);

      // Fire save + deadline notifications when newly bookmarked
      if (nowSaved && opp?.deadline && opp?.title) {
        seedOpportunityNotification(
          currentUser.uid,
          opp.id,
          opp.title,
          opp.deadline
        ).catch((e) => console.warn("Notification seed failed:", e));
      }
    } catch (error) {
      console.error("Bookmarking error:", error);
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setShareSuccess(true);
    setTimeout(() => setShareSuccess(false), 3050);
  };

  const setDeadlineReminder = async () => {
    if (!currentUser) {
      router.push("/auth/login");
      return;
    }
    if (!opp) return;

    setReminderLoading(true);
    try {
      await setDoc(doc(db, "reminders", `${currentUser.uid}_${opp.id}`), {
        uid: currentUser.uid,
        opportunityId: opp.id,
        opportunityTitle: opp.title,
        deadline: opp.deadline,
        createdAt: new Date().toISOString(),
      });
      setReminderSaved(true);
    } catch (error) {
      console.error("Error setting reminder:", error);
      alert("Failed to save deadline reminder.");
    } finally {
      setReminderLoading(false);
    }
  };

  /* ── Loading State ──────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background transition-colors duration-300">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}
        >
          <Loader2 className="w-8 h-8 text-primary" />
        </motion.div>
      </div>
    );
  }

  /* ── Not Found State ───────────────────────────────────────── */
  if (!opp) {
    return (
      <>
        <Navbar />
        <motion.div
          className="max-w-xl mx-auto py-20 text-center px-4"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <motion.div
            initial={{ y: -8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <AlertCircle className="w-12 h-12 text-danger mx-auto mb-4" />
          </motion.div>
          <motion.h2
            className="text-xl font-bold text-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            Opportunity not found
          </motion.h2>
          <motion.p
            className="text-foreground-muted text-sm mt-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            The link may be broken or the opportunity has been archived.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <Link
              href="/explore"
              className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Explore
            </Link>
          </motion.div>
        </motion.div>
        <Footer />
      </>
    );
  }

  /* ── Main Page ─────────────────────────────────────────────── */
  return (
    <>
      <Navbar />

      <main className="flex-grow bg-background py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-300">
        <motion.div
          className="max-w-4xl mx-auto"
          variants={pageVariants}
          initial="hidden"
          animate="show"
        >
          {/* Back link */}
          <motion.div variants={sectionVariants}>
            <Link
              href="/explore"
              className="inline-flex items-center gap-1 text-xs font-semibold text-foreground-muted hover:text-foreground mb-6 transition-colors group"
            >
              <motion.span
                className="inline-flex"
                whileHover={{ x: -3 }}
                transition={{ type: "spring", stiffness: 400, damping: 20 }}
              >
                <ArrowLeft className="w-4 h-4" />
              </motion.span>
              Back to explore
            </Link>
          </motion.div>

          {/* Main card */}
          <motion.div
            variants={cardVariants}
            className="bg-surface border border-border shadow-xl dark:shadow-[0_8px_40px_rgba(255,60,110,0.08)] rounded-lg dark:shadow-[0_8px_40px_rgba(255,60,110,0.08)] overflow-hidden p-8 md:p-10 transition-colors duration-300"
          >
            {/* Top Bar actions */}
            <motion.div
              className="flex flex-wrap items-center justify-between gap-4 mb-6"
              variants={sectionVariants}
            >
              <motion.span
                className="text-xs font-bold uppercase tracking-wider bg-primary/10 text-primary px-3.5 py-1.5 rounded-full"
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.35, delay: 0.15 }}
              >
                {opp.category}
              </motion.span>

              <div className="flex gap-2">
                {/* Bookmark button */}
                <motion.button
                  onClick={toggleBookmark}
                  whileTap={{ scale: 0.92 }}
                  whileHover={{ scale: 1.04 }}
                  transition={{ type: "spring", stiffness: 400, damping: 18 }}
                  className={`p-2.5 rounded-xl border transition-all flex items-center gap-1.5 text-xs font-semibold ${
                    isSaved
                      ? "bg-primary/10 text-primary border-primary/20"
                      : "bg-surface-raised text-foreground-muted border-border hover:border-primary/30 hover:text-primary"
                  }`}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    {isSaved ? (
                      <motion.span
                        key="saved"
                        className="flex items-center gap-1.5"
                        initial={{ opacity: 0, scale: 0.7 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.7 }}
                        transition={{ duration: 0.18 }}
                      >
                        <BookmarkCheck className="w-4 h-4" /> Bookmarked
                      </motion.span>
                    ) : (
                      <motion.span
                        key="unsaved"
                        className="flex items-center gap-1.5"
                        initial={{ opacity: 0, scale: 0.7 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.7 }}
                        transition={{ duration: 0.18 }}
                      >
                        <Bookmark className="w-4 h-4" /> Bookmark
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>

                {/* Share button */}
                <motion.button
                  onClick={handleShare}
                  whileTap={{ scale: 0.92 }}
                  whileHover={{ scale: 1.04 }}
                  transition={{ type: "spring", stiffness: 400, damping: 18 }}
                  className="p-2.5 rounded-xl border border-border bg-surface-raised text-foreground-muted hover:border-primary/30 hover:text-primary transition-all flex items-center gap-1.5 text-xs font-semibold"
                >
                  <AnimatePresence mode="wait" initial={false}>
                    {shareSuccess ? (
                      <motion.span
                        key="copied"
                        className="flex items-center gap-1.5 text-success"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.2 }}
                      >
                        <Check className="w-4 h-4" /> Copied!
                      </motion.span>
                    ) : (
                      <motion.span
                        key="share"
                        className="flex items-center gap-1.5"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.2 }}
                      >
                        <Share2 className="w-4 h-4" /> Share
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
              </div>
            </motion.div>

            {/* Title / Org info */}
            <motion.div className="mb-8" variants={sectionVariants}>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground leading-tight">
                {opp.title}
              </h1>
              <p className="text-sm font-semibold text-primary mt-2">{opp.organization}</p>
            </motion.div>

            {/* Quick Metadata highlights */}
            <motion.div
              className="grid grid-cols-2 sm:grid-cols-3 gap-6 p-6 bg-surface-raised border border-border rounded-2xl mb-8"
              variants={sectionVariants}
            >
              {[
                {
                  label: "Location",
                  icon: <MapPin className="w-4 h-4 text-foreground-muted" />,
                  value: opp.country,
                },
                {
                  label: "Deadline",
                  icon: <Calendar className="w-4 h-4 text-foreground-muted" />,
                  value: formatDeadline(opp.deadline),
                },
                { label: "Target Field", icon: null, value: opp.field },
              ].map(({ label, icon, value }, i) => (
                <motion.div
                  key={label}
                  className={i === 2 ? "col-span-2 sm:col-span-1" : ""}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.08, duration: 0.3 }}
                >
                  <span className="block text-2xs uppercase font-bold text-foreground-muted tracking-wider mb-1">
                    {label}
                  </span>
                  <span className="flex items-center gap-1 text-xs font-bold text-foreground">
                    {icon}
                    {value}
                  </span>
                </motion.div>
              ))}
            </motion.div>

            {/* Main content grid */}
            <motion.div className="grid grid-cols-1 md:grid-cols-3 gap-10" variants={sectionVariants}>
              <div className="md:col-span-2 space-y-8">
                {/* Description */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35, duration: 0.38 }}
                >
                  <h3 className="text-base font-bold text-foreground border-b border-border pb-2 mb-3">
                    Program Description
                  </h3>
                  <p className="text-foreground-muted text-sm leading-relaxed whitespace-pre-line">
                    {opp.description}
                  </p>
                </motion.div>

                {/* Eligibility */}
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.44, duration: 0.38 }}
                >
                  <h3 className="text-base font-bold text-foreground border-b border-border pb-2 mb-3">
                    Eligibility Criteria
                  </h3>
                  <p className="text-foreground-muted text-sm leading-relaxed whitespace-pre-line bg-surface-raised border border-border p-4 rounded-xl">
                    {opp.eligibility}
                  </p>
                </motion.div>
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                {/* Required Documents */}
                <motion.div
                  className="p-6 bg-surface-raised border border-border rounded-2xl"
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.32, duration: 0.42 }}
                >
                  <h4 className="text-xs font-bold uppercase tracking-wider text-foreground-muted mb-4 flex items-center gap-1.5">
                    <FileText className="w-4 h-4" /> Required Documents
                  </h4>
                  <ul className="space-y-2.5">
                    {opp.requiredDocuments.map((docName, i) => (
                      <motion.li
                        key={docName}
                        variants={checklistItemVariants}
                        initial="hidden"
                        animate="show"
                        className="flex items-start gap-2 text-xs text-foreground-muted"
                      >
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.4 + i * 0.06, type: "spring", stiffness: 500 }}
                        >
                          <Check className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
                        </motion.span>
                        <span>{docName}</span>
                      </motion.li>
                    ))}
                  </ul>
                </motion.div>

                {/* Reminder */}
                <motion.div
                  className="p-6 border border-primary/20 bg-primary/5 rounded-2xl"
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.45, duration: 0.42 }}
                >
                  <h4 className="text-xs font-bold uppercase tracking-wider text-primary mb-2 flex items-center gap-1.5">
                    <Bell className="w-4 h-4 text-primary" /> Deadline Alert
                  </h4>
                  <p className="text-xs text-foreground-muted leading-relaxed mb-4">
                    Receive a priority reminder on your dashboard before applications close.
                  </p>

                  <motion.button
                    onClick={setDeadlineReminder}
                    disabled={reminderSaved || reminderLoading}
                    whileTap={!reminderSaved && !reminderLoading ? { scale: 0.95 } : {}}
                    whileHover={!reminderSaved && !reminderLoading ? { scale: 1.03 } : {}}
                    transition={{ type: "spring", stiffness: 380, damping: 18 }}
                    className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      reminderSaved
                        ? "bg-success text-white cursor-default"
                        : "bg-primary hover:bg-primary-hover text-primary-foreground shadow-sm hover:shadow-md dark:shadow-[0_4px_12px_rgba(255,60,110,0.25)] disabled:opacity-60"
                    }`}
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      {reminderLoading ? (
                        <motion.span
                          key="loading"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                        >
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        </motion.span>
                      ) : reminderSaved ? (
                        <motion.span
                          key="saved"
                          className="flex items-center gap-1.5"
                          initial={{ opacity: 0, scale: 0.7 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ type: "spring", stiffness: 500 }}
                        >
                          <Check className="w-3.5 h-3.5" /> Saved Reminder
                        </motion.span>
                      ) : (
                        <motion.span
                          key="set"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                        >
                          Set Reminder
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.button>
                </motion.div>
              </div>
            </motion.div>

            {/* Official Apply Footer */}
            <motion.div
              className="border-t border-border mt-10 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55, duration: 0.4 }}
            >
              <p className="text-xs text-foreground-muted max-w-sm text-center sm:text-left">
                Ensure you have all required documents updated on your NEXORA profile before applying.
              </p>
              <motion.a
                href={opp.applyLink}
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: "spring", stiffness: 350, damping: 18 }}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-8 py-4 bg-foreground hover:opacity-90 text-background font-semibold text-sm rounded-2xl shadow-md transition-all group"
              >
                Apply On Official Site
                <motion.span
                  className="inline-flex"
                  whileHover={{ x: 2, y: -2 }}
                  transition={{ type: "spring", stiffness: 400 }}
                >
                  <ExternalLink className="w-4 h-4" />
                </motion.span>
              </motion.a>
            </motion.div>
          </motion.div>
        </motion.div>
      </main>

      <Footer />
    </>
  );
}
