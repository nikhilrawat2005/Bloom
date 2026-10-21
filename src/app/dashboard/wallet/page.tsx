"use client";

import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, addDoc, deleteDoc, updateDoc, doc, onSnapshot } from "firebase/firestore";
import { useState, useEffect, useRef, useMemo } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  Wallet,
  FileText,
  UploadCloud,
  Download,
  Trash2,
  Sparkles,
  Loader2,
  X,
  RefreshCw,
  Replace,
} from "lucide-react";
import { Link2, Copy, Check, ExternalLink } from "lucide-react";
import type { WalletDocument, WalletCategory, ProfileLink } from "@/lib/types";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { Lock, Unlock, AlertTriangle } from "lucide-react";
import { Button, Card, Chip, EmptyState, type ChipTone } from "@/components/ui";
import {
  WALLET_CATEGORIES,
  classifyDocument,
  classifyRemoteDocument,
  extractTextFromFile,
  fileToDataUrl,
  type CategorySource,
  type ClassificationResult,
} from "@/lib/wallet/documentClassifier";
import { extractInsights } from "@/lib/wallet/documentInsights";
import { authedFetch } from "@/lib/apiClient";
import {
  displayUrl,
  kindTone,
  kindLabel,
  LINK_SUGGESTIONS,
  needsProfilePath,
  parseProfileLink,
} from "@/lib/profileLinks";
import { addProfileLink, removeProfileLink, subscribeProfileLinks } from "@/lib/profileLinksClient";

/** How much of a document's text we store for AI classification and insights. */
const STORED_TEXT_CHARS = 3000;


/** Tab strip: "All" plus every real category. Derived once, never per render. */
const CATEGORY_TABS: Array<WalletCategory | "All"> = ["All", ...WALLET_CATEGORIES];

/** The category pickers never offer "All" — that is a filter, not a value. */
const CATEGORY_VALUES = WALLET_CATEGORIES;

/** One shared spring for every hover lift on this page. */
const SPRING = { type: "spring", stiffness: 400, damping: 18 } as const;

/**
 * How a queued file's classification source is badged. `reading` and `manual`
 * are both neutral on purpose: neither is a verdict, they are a state.
 */
function sourceTone(item: {
  reading?: boolean;
  manual?: boolean;
  source?: CategorySource;
}): ChipTone {
  if (item.reading || item.manual) return "neutral";
  return item.source === "unknown" ? "warning" : "success";
}

/* ── Animated Count-up ─────────────────────────────────────── */
function CountUp({ to, suffix = "" }: { to: number; suffix?: string }) {
  const [value, setValue] = useState(to);
  const prevToRef = useRef(to);

  useEffect(() => {
    const from = prevToRef.current;
    prevToRef.current = to;
    if (from === to) {
      setValue(to);
      return;
    }

    const start = performance.now();
    const duration = 600;
    const frame = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setValue(Math.round(from + (to - from) * eased));
      if (progress < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }, [to]);

  return <>{value}{suffix}</>;
}

/* ── Header stat pill ──────────────────────────────────────── */
const PILL_FRAME = {
  default: "border-border bg-surface",
  success: "border-success/25 bg-success-surface",
} as const;

const PILL_VALUE = {
  default: "text-primary",
  success: "text-success",
} as const;

interface StatPillProps {
  label: string;
  value: ReactNode;
  suffix?: ReactNode;
  tone?: keyof typeof PILL_FRAME;
  title?: string;
  href?: string;
}

/**
 * The header counters. Four of these used to be four separate inline copies of
 * the same padding/radius/shadow string, and the "Performance" one had drifted
 * to its own green border and hover colour.
 */
function StatPill({ label, value, suffix, tone = "default", title, href }: StatPillProps) {
  const body = (
    <>
      <span className="eyebrow block">{label}</span>
      <span className={`mt-0.5 block text-lg font-bold ${PILL_VALUE[tone]}`}>
        {value}
        {suffix == null ? null : <span className="text-2xs font-bold">{suffix}</span>}
      </span>
    </>
  );

  if (href) {
    return (
      <motion.div whileHover={{ scale: 1.04 }} transition={SPRING} title={title}>
        <Link
          href={href}
          className={`block rounded-md border px-4 py-2 text-center transition-colors duration-base hover:border-success/50 ${PILL_FRAME[tone]}`}
        >
          {body}
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div
      whileHover={{ scale: 1.04 }}
      transition={SPRING}
      title={title}
      className={`rounded-md border px-4 py-2 text-center ${PILL_FRAME[tone]}`}
    >
      {body}
    </motion.div>
  );
}

/* ── Animation Variants ─────────────────────────────────────── */
const containerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.06 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.36, ease: [0.23, 1, 0.32, 1] } },
  exit: { opacity: 0, x: -20, scale: 0.96, transition: { duration: 0.22 } },
};

const panelVariants: Variants = {
  hidden: { opacity: 0, x: -18 },
  show: { opacity: 1, x: 0, transition: { duration: 0.42, ease: "easeOut" } },
};

const listVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

export default function WalletPage() {
  const { currentUser } = useAuth();
  const [documents, setDocuments] = useState<WalletDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<WalletCategory | "All">("All");

  // Multiple files upload queue
  interface QueueItem {
    reading?: boolean;
    id: string;
    file: File;
    name: string;
    category: WalletCategory;
    /** "manual" once the user picks a category by hand, so auto-scan leaves it alone. */
    manual?: boolean;
    source?: CategorySource;
    confidence?: number;
    reason?: string;
    needsReview?: boolean;
    /** Text read from the file, stored with the document for scoring. */
    text?: string;
  }
  const [fileQueue, setFileQueue] = useState<QueueItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number; currentName: string } | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Re-scan state for existing documents
  const [rescanning, setRescanning] = useState(false);
  const [rescanProgress, setRescanProgress] = useState<{ current: number; total: number } | null>(null);
  const [updatingCatId, setUpdatingCatId] = useState<string | null>(null);

  // Public profile links — LinkedIn, GitHub, portfolio, anything the user wants
  // visible to recruiters. Stored in users/{uid}/profileLinks.
  const [profileLinks, setProfileLinks] = useState<ProfileLink[]>([]);
  const [linkInput, setLinkInput] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [savingLink, setSavingLink] = useState(false);
  const [deletingLinkId, setDeletingLinkId] = useState<string | null>(null);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);

  const linkPreview = useMemo(() => parseProfileLink(linkInput), [linkInput]);

  useEffect(() => {
    if (!currentUser) return;

    const q = query(collection(db, "wallet"), where("uid", "==", currentUser.uid));
    const unsub = onSnapshot(q, (snap) => {
      const items: WalletDocument[] = [];
      snap.forEach((d) => {
        items.push({ id: d.id, ...d.data() } as WalletDocument);
      });
      setDocuments(items);
      setLoading(false);
    });

    return () => unsub();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    return subscribeProfileLinks(
      currentUser.uid,
      setProfileLinks,
      () => setLinkError("Could not load your saved links.")
    );
  }, [currentUser]);

  const addFilesToQueue = async (files: FileList | File[]) => {
    const fileList = Array.from(files);

    // 1. Queue entries start unclassified; the file's own content decides.
    const initialItems: QueueItem[] = fileList.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      file,
      name: file.name.replace(/\.[^/.]+$/, ""),
      category: "Other",
      reading: true,
      source: "unknown",
      manual: false,
      needsReview: true,
    }));

    setFileQueue((prev) => [...prev, ...initialItems]);

    // 2. Read every file's actual content and classify from that, never the name.
    for (const item of initialItems) {
      try {
        const text = await extractTextFromFile(item.file);
        const imageDataUrl = text.trim() ? undefined : (await fileToDataUrl(item.file)) ?? undefined;

        const result: ClassificationResult = await classifyDocument({
          text,
          imageDataUrl,
          mimeType: item.file.type,
          name: item.file.name,
          // LLM-first as documentClassifier documents it; on any AI failure
          // (network, quota, categorize route unavailable) it falls back to the
          // local rules, so the queue never stalls. Categorize route is
          // authenticated + rate-limited.
          useAI: true,
          preferAI: true,
        });

        setFileQueue((prev) =>
          prev.map((q) =>
            q.id === item.id
              ? {
                  ...q,
                  category: result.category,
                  reading: false,
                  source: result.source,
                  confidence: result.confidence,
                  reason: result.reason,
                  needsReview: result.needsReview,
                  text: text.slice(0, STORED_TEXT_CHARS),
                }
              : q
          )
        );
      } catch (err) {
        console.error("Classification failed for", item.file.name, err);
        setFileQueue((prev) =>
          prev.map((q) => (q.id === item.id ? { ...q, reading: false } : q))
        );
      }
    }
  };

  const removeQueueItem = (id: string) => {
    setFileQueue((prev) => prev.filter((item) => item.id !== id));
  };

  const updateQueueItemName = (id: string, name: string) => {
    setFileQueue((prev) =>
      prev.map((item) => (item.id === id ? { ...item, name } : item))
    );
  };

  const updateQueueItemCategory = (id: string, category: WalletCategory) => {
    setFileQueue((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, category, manual: true, source: "manual", needsReview: false }
          : item
      )
    );
  };

  const handleUploadAll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || fileQueue.length === 0) return;
    // Snapshot the queue: files may be added while this loop is running, and
    // those must not be silently dropped when the queue is pruned at the end.
    const queue = [...fileQueue];
    if (queue.some((item) => item.reading)) {
      setUploadError("Wait for text extraction to finish before uploading.");
      return;
    }

    setUploading(true);
    setUploadError("");
    let successCount = 0;
    const failures: string[] = [];
    const failedIds = new Set<string>();

    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      setUploadProgress({
        current: i + 1,
        total: queue.length,
        currentName: item.name,
      });

      try {
        const formData = new FormData();
        formData.append("file", item.file);
        // The folder is derived from the verified token server-side. The client
        // used to send `wallet/${uid}`, which let it choose another user's path.

        const res = await authedFetch("/api/wallet/upload", {
          method: "POST",
          body: formData,
        });

        const resText = await res.text();
        let data: any = {};
        try {
          data = JSON.parse(resText);
        } catch {
          throw new Error(
            res.status === 413
              ? "File too large for server payload limit (max ~4.5MB on Vercel)."
              : `Server returned error (${res.status}): ${resText.slice(0, 100)}`
          );
        }

        if (!res.ok) {
          throw new Error(data.error || `Failed to upload ${item.file.name}`);
        }

        const downloadURL = data.secure_url;
        const filePath = data.public_id;

        const now = new Date().toISOString();
        // Facts parsed out of the text are what the performance engine scores on.
        const insights = extractInsights(item.text || "", item.category, item.name);
        const newDoc = {
          uid: currentUser.uid,
          name: item.name.trim() || item.file.name,
          category: item.category,
          storagePath: filePath,
          downloadURL,
          sizeBytes: item.file.size,
          mimeType: item.file.type,
          uploadedAt: now,
          categorySource: item.manual ? "manual" : "auto",
          categoryConfidence: item.manual ? 1 : item.confidence ?? 0,
          categoryReason: item.manual ? "Set manually before upload" : item.reason || "",
          categoryNeedsReview: item.manual ? false : !!item.needsReview,
          categoryUpdatedAt: now,
          extractedText: (item.text || "").slice(0, STORED_TEXT_CHARS),
          insights,
        };

        await addDoc(collection(db, "wallet"), newDoc);
        successCount++;
      } catch (err: any) {
        console.error("Upload error for file:", item.file.name, err);
        failedIds.add(item.id);
        failures.push(`${item.file.name}: ${err?.message || "Upload failed"}`);
      }
    }

    setUploading(false);
    setUploadProgress(null);
    // Only clear the rows that actually succeeded, so a failure is retryable
    // instead of vanishing.
    setFileQueue((prev) => prev.filter((item) => !queue.some((q) => q.id === item.id && !failedIds.has(q.id))));
    setUploadError(failures.length > 0 ? failures.join("\n") : "");

  };

  const handleDelete = async (id: string) => {
    const docToDelete = documents.find((d) => d.id === id);
    if (!docToDelete) return;
    setDeletingId(id);
    setActionError("");
    try {
      if (docToDelete.storagePath) {
        const res = await authedFetch("/api/wallet/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publicId: docToDelete.storagePath }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          // Deleting the Firestore record while the remote file survives leaves an
          // orphaned upload that the user can no longer see or remove, so stop.
          throw new Error(
            errData?.error || "Could not delete the stored file. Nothing was removed."
          );
        }
      }

      await deleteDoc(doc(db, "wallet", id));
    } catch (err: any) {
      console.error("Delete document error:", err);
      setActionError(err?.message || "Failed to delete this document.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleReplace = async (docId: string) => {
    const target = documents.find((d) => d.id === docId);
    if (!target) return;

    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.jpg,.jpeg,.png,.webp,.heic";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      setReplacingId(docId);
      setActionError("");
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("oldPublicId", target.storagePath || "");

        const res = await authedFetch("/api/wallet/replace", {
          method: "POST",
          body: formData,
        });

        const resText = await res.text();
        let data: any = {};
        try {
          data = JSON.parse(resText);
        } catch {
          throw new Error(`Server returned error (${res.status}): ${resText.slice(0, 100)}`);
        }

        if (!res.ok) {
          throw new Error(data.error || `Failed to replace ${target.name}`);
        }

        const now = new Date().toISOString();
        const text = await extractTextFromFile(file);
        const insights = extractInsights(text, target.category, target.name);

        await updateDoc(doc(db, "wallet", docId), {
          storagePath: data.public_id,
          downloadURL: data.secure_url,
          sizeBytes: file.size,
          mimeType: file.type,
          uploadedAt: now,
          extractedText: text.slice(0, STORED_TEXT_CHARS),
          insights,
        });
      } catch (err: any) {
        console.error("Replace document error:", err);
        setActionError(err?.message || "Failed to replace this document.");
      } finally {
        setReplacingId(null);
      }
    };
    input.click();
  };

  const handleUpdateDocCategory = async (docId: string, newCategory: WalletCategory) => {
    try {
      setUpdatingCatId(docId);
      // Marking it manual locks it: auto re-scan will never move this document again.
      const target = documents.find((d) => d.id === docId);
      await updateDoc(doc(db, "wallet", docId), {
        category: newCategory,
        categorySource: "manual",
        categoryConfidence: 1,
        categoryReason: "Set manually",
        categoryNeedsReview: false,
        categoryUpdatedAt: new Date().toISOString(),
        // Re-parse the facts against the new category so scores update too.
        ...(target?.extractedText
          ? { insights: extractInsights(target.extractedText, newCategory, target.name) }
          : {}),
      });
    } catch (err) {
      console.error("Failed to update category:", err);
      alert("Failed to update document category.");
    } finally {
      setUpdatingCatId(null);
    }
  };

  /** Release the manual lock so a future scan can re-detect this document. */
  const handleUnlockDocCategory = async (docId: string) => {
    try {
      setUpdatingCatId(docId);
      await updateDoc(doc(db, "wallet", docId), {
        categorySource: "auto",
        categoryUpdatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error("Failed to unlock category:", err);
      alert("Failed to unlock this document.");
    } finally {
      setUpdatingCatId(null);
    }
  };

  const handleRescanAll = async () => {
    if (documents.length === 0 || rescanning || !currentUser) return;
    const uid = currentUser.uid;
    setRescanning(true);
    let updatedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    try {
      for (let i = 0; i < documents.length; i++) {
        const d = documents[i];
        setRescanProgress({ current: i + 1, total: documents.length });

        // Respect manual choices: the user locked these on purpose.
        if (d.categorySource === "manual") {
          skippedCount++;
          continue;
        }

        if (!d.downloadURL) {
          failedCount++;
          continue;
        }

        // Re-read the stored file and classify from content (no LLM).
        const result = await classifyRemoteDocument(
          {
            url: d.downloadURL,
            name: d.name,
            mimeType: d.mimeType,
          },
          { useAI: false, preferAI: false }
        );

        if (result.source === "unknown") {
          failedCount++;
          continue;
        }

        const patch: Record<string, unknown> = {
          categorySource: "auto",
          categoryConfidence: result.confidence,
          categoryReason: result.reason,
          categoryNeedsReview: result.needsReview,
          categoryUpdatedAt: new Date().toISOString(),
        };
        if (result.category !== d.category) patch.category = result.category;
        // Refresh the facts too, so the profile reflects the new category.
        if (result.text) {
          patch.extractedText = result.text.slice(0, STORED_TEXT_CHARS);
          patch.insights = extractInsights(result.text, result.category, d.name);
        }

        await updateDoc(doc(db, "wallet", d.id), patch);
        if (result.category !== d.category) updatedCount++;

        // Small pause so AI-backed scans do not hammer the provider.
        await new Promise((r) => setTimeout(r, 250));
      }


      const parts = [
        updatedCount > 0 ? `${updatedCount} moved to a new category` : "No categories changed",
      ];
      if (skippedCount > 0) parts.push(`${skippedCount} manual choice(s) kept as-is`);
      if (failedCount > 0) parts.push(`${failedCount} could not be read`);
      alert(`Scan complete: ${parts.join(", ")}.`);
    } catch (err) {
      console.error("Re-scan error:", err);
      alert("Error occurred while re-scanning documents.");
    } finally {
      setRescanning(false);
      setRescanProgress(null);
    }
  };

  /* ── Public profile links ───────────────────────────────────── */
  const handleAddLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setLinkError(null);
    setSavingLink(true);
    try {
      const result = await addProfileLink(currentUser.uid, linkInput);
      if (!result.ok) {
        setLinkError(result.error);
      } else {
        setLinkInput("");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[profile-links] add failed:", msg);
      setLinkError(`Save failed: ${msg}`);
    } finally {
      setSavingLink(false);
    }
  };

  const handleRemoveLink = async (linkId: string) => {
    if (!currentUser) return;
    setDeletingLinkId(linkId);
    try {
      await removeProfileLink(currentUser.uid, linkId);
    } catch {
      setLinkError("That link could not be removed. Please try again.");
    } finally {
      setDeletingLinkId(null);
    }
  };

  const handleCopyLink = async (link: ProfileLink) => {
    try {
      await navigator.clipboard.writeText(link.url);
      setCopiedLinkId(link.id);
      setTimeout(() => setCopiedLinkId((id) => (id === link.id ? null : id)), 1600);
    } catch {
      setLinkError("Could not copy to the clipboard.");
    }
  };

  const filteredDocs =
    activeTab === "All" ? documents : documents.filter((d) => d.category === activeTab);

  const totalSizeKB = Math.round(documents.reduce((acc, d) => acc + d.sizeBytes, 0) / 1024);


  /* ── Loading ──────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}
        >
          <Loader2 className="w-8 h-8 text-primary" />
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div
      className="max-w-5xl mx-auto space-y-8"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      {/* Header + Stat pills */}
      <motion.div variants={itemVariants} className="space-y-4">
        <div className="flex items-start gap-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-surface-raised text-secondary">
            <Wallet className="h-5 w-5" />
          </span>
          <div>
            <span className="eyebrow">Career Documents</span>
            <h1 className="mt-1 font-display text-display-sm text-foreground">
              Opportunity Wallet
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-foreground-muted text-pretty">
              Store your career documents, achievements, and credentials in a secure sandbox. Use AI to scan resumes and auto-verify certificates.
            </p>
          </div>
        </div>

        {/* Stat pills + Action buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-3">
            <StatPill label="Total Documents" value={<CountUp to={documents.length} />} />
            <StatPill label="Storage Used" value={<CountUp to={totalSizeKB} />} suffix=" KB" />

            {profileLinks.length > 0 && (
              <StatPill
                label="Public Links"
                title="Public profile links saved in your wallet"
                value={<CountUp to={profileLinks.length} />}
              />
            )}

          </div>

          {/* Re-Scan existing button */}
          {documents.length > 0 && (
            <Button
              type="button"
              variant="secondary"
              onClick={handleRescanAll}
              disabled={rescanning}
              leadingIcon={
                <RefreshCw className={`h-3.5 w-3.5 ${rescanning ? "animate-spin" : ""}`} />
              }
              title="Re-reads every auto-classified file and moves it to the right category. Files you categorized manually are left untouched."
            >
              {rescanning && rescanProgress
                ? `Scanning ${rescanProgress.current}/${rescanProgress.total}…`
                : "Auto Re-Scan & Organize All"}
            </Button>
          )}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
{/* Upload Panel */}
        <motion.div variants={panelVariants}>
          <Card className="h-fit space-y-4 p-6">
            <h2 className="flex items-center gap-1.5 font-display text-lg text-foreground">
              <UploadCloud className="h-4 w-4 text-secondary" /> Upload Documents
            </h2>

          <form onSubmit={handleUploadAll} className="space-y-4">
            {/* Drag & Drop Box */}
            <motion.div
              animate={{
                borderColor: isDragging
                  ? "var(--primary)"
                  : fileQueue.length > 0
                  ? "var(--success)"
                  : "var(--border)",
              }}
              transition={{ duration: 0.2 }}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  addFilesToQueue(e.dataTransfer.files);
                }
              }}
              className={`cursor-pointer rounded-md border border-dashed p-4 text-center transition-colors duration-base ${
                isDragging ? "bg-primary/10" : "hover:bg-surface-raised"
              }`}
            >
              <input
                type="file"
                id="file-upload-multi"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    addFilesToQueue(e.target.files);
                    e.target.value = "";
                  }
                }}
              />
              <label htmlFor="file-upload-multi" className="block cursor-pointer space-y-1">
                <UploadCloud className="mx-auto h-8 w-8 text-foreground-muted" />
                <p className="text-sm font-semibold text-foreground">
                  {isDragging ? "Drop files to add" : "Click to select or drag & drop files"}
                </p>
                <p className="text-2xs text-foreground-muted">
                  Supports multiple PDFs, images, resumes at once
                </p>
              </label>
            </motion.div>

            {/* Queue Preview List */}
            {fileQueue.length > 0 && (              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="eyebrow">Upload Queue ({fileQueue.length})</span>
                  <button
                    type="button"
                    onClick={() => setFileQueue([])}
                    disabled={uploading}
                    className="text-2xs font-semibold text-danger hover:underline"
                  >
                    Clear All
                  </button>
                </div>

                <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                  <AnimatePresence>
                    {fileQueue.map((item) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="card-inset space-y-1.5 p-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <input
                            type="text"
                            value={item.name}
                            disabled={uploading}
                            onChange={(e) => updateQueueItemName(item.id, e.target.value)}
                            placeholder="Document name"
                            aria-label={`Name for ${item.file.name}`}
                            className="flex-1 border-b border-transparent bg-transparent text-sm font-semibold text-foreground outline-none transition-colors duration-fast focus:border-secondary"
                          />
                          <button
                            type="button"
                            disabled={uploading}
                            onClick={() => removeQueueItem(item.id)}
                            aria-label={`Remove ${item.file.name} from the queue`}
                            className="grid h-6 w-6 shrink-0 place-items-center rounded-sm text-foreground-muted transition-colors duration-fast hover:bg-danger-surface hover:text-danger"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div className="flex items-center justify-between text-2xs text-foreground-muted">
                          <div className="flex items-center gap-1.5">
                            <select
                              value={item.category}
                              disabled={uploading}
                              aria-label={`Category for ${item.file.name}`}
                              onChange={(e) =>
                                updateQueueItemCategory(item.id, e.target.value as WalletCategory)
                              }
                              className="rounded-sm border border-border bg-surface px-1.5 py-0.5 text-2xs text-foreground outline-none transition-colors duration-fast focus:border-secondary"
                            >
                              {CATEGORY_VALUES.map((cat) => (
                                <option key={cat} value={cat}>
                                  {cat}
                                </option>
                              ))}
                            </select>
                            {item.reading ? (
                              <Chip
                                tone={sourceTone(item)}
                                icon={<Loader2 className="h-2.5 w-2.5 animate-spin" />}
                                className="text-2xs"
                              >
                                Reading file…
                              </Chip>
                            ) : item.manual ? (
                              <Chip
                                tone={sourceTone(item)}
                                icon={<Lock className="h-2.5 w-2.5" />}
                                className="text-2xs"
                                title="You set this category, it will be kept as-is"
                              >
                                Manual
                              </Chip>
                            ) : item.source === "ai" ? (
                              <Chip
                                tone={sourceTone(item)}
                                icon={<Sparkles className="h-2.5 w-2.5" />}
                                className="text-2xs"
                                title={item.reason || "Classified by AI from the file content"}
                              >
                                AI read
                              </Chip>
                            ) : item.source === "content" ? (
                              <Chip
                                tone={sourceTone(item)}
                                icon={<Sparkles className="h-2.5 w-2.5" />}
                                className="text-2xs"
                                title={item.reason || "Classified from the file content"}
                              >
                                Read
                              </Chip>
                            ) : (
                              <Chip
                                tone={sourceTone(item)}
                                icon={<AlertTriangle className="h-2.5 w-2.5" />}
                                className="text-2xs"
                                title="No readable content found. Please pick a category."
                              >
                                Check
                              </Chip>
                            )}
                            {item.confidence !== undefined && !item.manual && !item.reading && (
                              <span>{Math.round(item.confidence * 100)}%</span>
                            )}
                          </div>
                          <span>{(item.file.size / 1024).toFixed(0)} KB</span>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {/* Upload Progress details */}
            {uploadProgress && (
              <div className="space-y-1 rounded-md border border-primary/25 bg-primary/10 p-2.5">
                <div className="flex justify-between text-xs font-bold text-primary">
                  <span>
                    Uploading {uploadProgress.current} of {uploadProgress.total}
                  </span>
                  <span>
                    {Math.round((uploadProgress.current / uploadProgress.total) * 100)}%
                  </span>
                </div>
                <p className="truncate text-2xs text-foreground-muted">
                  {uploadProgress.currentName}
                </p>
              </div>
            )}

            {/* Upload failures, kept visible so they can be retried */}
            {actionError && (
              <p role="alert" className="rounded-md border border-danger/30 bg-danger-surface p-2.5 text-xs text-danger">
                {actionError}
              </p>
            )}
            {uploadError && (
              <div
                role="alert"
                className="rounded-md border border-danger/30 bg-danger-surface p-2.5"
              >
                <p className="text-xs font-bold text-danger">Some files failed to upload</p>
                <ul className="mt-1 space-y-0.5">
                  {uploadError.split("\n").map((line, i) => (
                    <li key={i} className="break-words text-2xs text-danger/90">
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Button
              type="submit"
              block
              disabled={uploading || fileQueue.length === 0 || fileQueue.some((i) => i.reading)}
            >
              <AnimatePresence mode="wait" initial={false}>
                {uploading ? (
                  <motion.span
                    key="uploading"
                    className="flex items-center gap-1.5"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading to cloud…
                  </motion.span>
                ) : (
                  <motion.span
                    key="upload"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    {fileQueue.length > 0
                      ? `Upload ${fileQueue.length} Document${fileQueue.length > 1 ? "s" : ""}`
                      : "Upload Documents"}
                  </motion.span>
                )}
              </AnimatePresence>
            </Button>
          </form>
          </Card>
        </motion.div>

        {/* Public Profile Links Panel */}
        <motion.div variants={panelVariants}>
          <Card className="h-fit space-y-4 p-6">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-1.5 font-display text-lg text-foreground">
                <Link2 className="h-4 w-4 text-secondary" /> Public Profile Links
              </h2>
              {profileLinks.length > 0 && (
                <Chip tone="gold" className="text-2xs">
                  {profileLinks.length} saved
                </Chip>
              )}
            </div>

          <p className="text-xs leading-snug text-foreground-muted">
            Save the public pages recruiters should see — LinkedIn, GitHub, your portfolio, or
            anything else. These count as verified evidence in your profile.
          </p>

          <form onSubmit={handleAddLink} className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="url"
                value={linkInput}
                onChange={(e) => {
                  setLinkInput(e.target.value);
                  setLinkError(null);
                }}
                placeholder="linkedin.com/in/yourname"
                aria-label="Public profile URL"
                className="input min-w-0 flex-1 rounded-md text-xs"
              />
              <Button
                type="submit"
                size="sm"
                disabled={savingLink || !linkInput.trim()}
                leadingIcon={
                  savingLink ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Link2 className="h-3.5 w-3.5" />
                  )
                }
              >
                {savingLink ? "Saving…" : "Save"}
              </Button>
            </div>

            {/* Live validation feedback so the user knows what will be saved */}
            {linkInput.trim() && (
              <p
                className={`text-2xs leading-snug ${
                  linkPreview.ok ? "text-success" : "text-danger"
                }`}
              >
                {linkPreview.ok ? (
                  <>
                    Will save as <span className="font-bold">{kindLabel(linkPreview.kind)}</span>{" "}
                    — {displayUrl(linkPreview.url)}
                    {needsProfilePath(linkPreview.kind, linkPreview.url) && (
                      <span className="text-warning">
                        {" "}
                        Tip: add your /in/username so the link opens your profile.
                      </span>
                    )}
                  </>
                ) : (
                  linkPreview.error
                )}
              </p>
            )}
            {linkError && <p className="text-2xs leading-snug text-danger">{linkError}</p>}
          </form>

          {profileLinks.length === 0 ? (
            <div className="space-y-2">
              <p className="py-1 text-center text-2xs text-foreground-muted">
                Nothing saved yet. Quick-fill a common one:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {LINK_SUGGESTIONS.map((s) => (
                  <button
                    key={s.kind}
                    type="button"
                    onClick={() => {
                      setLinkInput(s.placeholder);
                      setLinkError(null);
                    }}
                    className="rounded-sm border border-border bg-surface-raised px-2 py-1 text-2xs font-bold text-foreground-muted transition-colors duration-fast hover:border-secondary/50 hover:text-secondary"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
              <AnimatePresence initial={false}>
                {profileLinks.map((link) => (
                  <motion.li
                    key={link.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="card-inset flex items-center gap-2 p-2.5"
                  >
                    <Chip tone={kindTone(link.kind)} className="shrink-0 text-2xs">
                      {link.label || kindLabel(link.kind)}
                    </Chip>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open in a new tab"
                      className="link-ink flex min-w-0 flex-1 items-center gap-1 text-2xs"
                    >
                      <span className="truncate">{displayUrl(link.url)}</span>
                      <ExternalLink className="h-2.5 w-2.5 flex-shrink-0 opacity-50" />
                    </a>
                    <button
                      type="button"
                      onClick={() => handleCopyLink(link)}
                      aria-label={`Copy the ${link.label || kindLabel(link.kind)} URL`}
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-sm text-foreground-muted transition-colors duration-fast hover:bg-surface-raised hover:text-secondary"
                    >
                      {copiedLinkId === link.id ? (
                        <Check className="h-3 w-3 text-success" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveLink(link.id)}
                      disabled={deletingLinkId === link.id}
                      aria-label={`Remove the ${link.label || kindLabel(link.kind)} link`}
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-sm text-foreground-muted transition-colors duration-fast hover:bg-danger-surface hover:text-danger disabled:opacity-50"
                    >
                      {deletingLinkId === link.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3" />
                      )}
                    </button>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
          </Card>
        </motion.div>

        {/* Documents Grid */}
        <motion.div className="lg:col-span-2 space-y-6" variants={itemVariants}>
          {/* Tab Navigation */}
          <div className="relative flex gap-2 overflow-x-auto border-b border-border pb-1">
            {CATEGORY_TABS.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveTab(cat)}
                aria-pressed={activeTab === cat}
                className={`relative whitespace-nowrap px-1 pb-3 text-sm font-semibold transition-colors duration-base ${
                  activeTab === cat
                    ? "text-primary"
                    : "text-foreground-muted hover:text-foreground"
                }`}
              >
                {cat}
                {activeTab === cat && (
                  <motion.span
                    layoutId="wallet-tab-indicator"
                    className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary"
                    transition={{ type: "spring", stiffness: 400, damping: 28 }}
                  />
                )}
              </button>
            ))}
          </div>

          {/* Documents List */}
          <motion.div className="space-y-4" variants={listVariants} initial="hidden" animate="show">
            <AnimatePresence mode="popLayout">
              {filteredDocs.map((document) => (
                <motion.article
                  key={document.id}
                  layout
                  variants={itemVariants}
                  initial="hidden"
                  animate="show"
                  exit="exit"
                  className="card flex flex-col gap-4 p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                        <FileText className="h-5 w-5" />
                      </span>
                      <div>
                        <h3 className="text-sm font-bold leading-snug text-foreground">
                          {document.name}
                        </h3>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <select
                            value={document.category}
                            disabled={updatingCatId === document.id}
                            aria-label={`Category for ${document.name}`}
                            onChange={(e) =>
                              handleUpdateDocCategory(document.id, e.target.value as WalletCategory)
                            }
                            title="Change document category"
                            className="rounded-sm border border-border bg-surface-raised px-2 py-0.5 text-2xs font-semibold text-primary outline-none transition-colors duration-fast focus:border-secondary"
                          >
                            {CATEGORY_VALUES.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                          <span className="text-2xs font-medium text-foreground-muted">
                            {(document.sizeBytes / 1024).toFixed(0)} KB
                          </span>
                          {document.categorySource === "manual" ? (
                            <button
                              type="button"
                              onClick={() => handleUnlockDocCategory(document.id)}
                              disabled={updatingCatId === document.id}
                              title="Category set by you. Click to unlock so Auto Re-Scan can re-detect it."
                              className="flex items-center gap-0.5 text-2xs font-bold text-foreground-muted transition-colors duration-fast hover:text-secondary disabled:opacity-50"
                            >
                              <Lock className="h-2.5 w-2.5" /> Manual <Unlock className="h-2.5 w-2.5" />
                            </button>
                          ) : document.categoryNeedsReview ? (
                            <Chip
                              tone="warning"
                              icon={<AlertTriangle className="h-2.5 w-2.5" />}
                              className="text-2xs"
                              title={
                                document.categoryReason ||
                                "Low confidence — please verify this category."
                              }
                            >
                              Verify
                            </Chip>
                          ) : document.categoryReason ? (
                            <span
                              className="max-w-[180px] truncate text-2xs font-medium text-foreground-muted"
                              title={document.categoryReason}
                            >
                              {document.categoryReason}
                            </span>
                          ) : null}
                          {updatingCatId === document.id && (
                            <Loader2 className="h-3 w-3 animate-spin text-primary" />
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleReplace(document.id)}
                        disabled={replacingId === document.id}
                        aria-label={`Replace ${document.name}`}
                        title="Replace this document with a new file"
                        className="grid h-8 w-8 place-items-center rounded-md text-foreground-muted transition-colors duration-fast hover:bg-surface-raised hover:text-foreground disabled:opacity-50"
                      >
                        {replacingId === document.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Replace className="h-4 w-4" />
                        )}
                      </button>
                      <a
                        href={document.downloadURL}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Download ${document.name}`}
                        title="Download document"
                        className="grid h-8 w-8 place-items-center rounded-md text-foreground-muted transition-colors duration-fast hover:bg-surface-raised hover:text-foreground"
                      >
                        <Download className="h-4 w-4" />
                      </a>
                      <button
                        type="button"
                        onClick={() => handleDelete(document.id)}
                        disabled={deletingId === document.id}
                        aria-label={`Delete ${document.name}`}
                        title="Delete"
                        className="grid h-8 w-8 place-items-center rounded-md text-foreground-muted transition-colors duration-fast hover:bg-danger-surface hover:text-danger disabled:opacity-50"
                      >
                        {deletingId === document.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                </motion.article>
              ))}

              {filteredDocs.length === 0 && (
                <EmptyState
                  key="empty-state"
                  icon={<FileText className="h-5 w-5" />}
                  title="No documents found"
                  description="Click the upload box on the left to add items to your Opportunity Wallet."
                />
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
}
