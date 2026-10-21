"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, collection, addDoc, getDocs, query, where, orderBy, limit } from "firebase/firestore";
import { useOpportunities } from "@/hooks/useOpportunities";
import { authedFetch } from "@/lib/apiClient";
import { AIServiceClient, AIServiceUnavailableError, ResumeAnalysisResult } from "@/lib/aiServiceClient";
import {
  Sparkles,
  CheckCircle,
  AlertCircle,
  FileText,
  MessageSquare,
  Award,
  Send,
  Loader2,
  TrendingUp,
  UploadCloud,
  ArrowRight,
  X,
  Bookmark,
  FolderGit2,
  Link2,
  ExternalLink,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Paperclip,
  Download,
  Github,
  Star,
  GitFork,
  GitCommit,
  Trophy,
  GraduationCap,
  RefreshCw,
  Code2,
  Mic,
  Briefcase,
  HelpCircle,
  RotateCcw,
  Compass,
  CheckSquare,
  Square,
  Layers,
  Sparkle,
  Copy,
  Check,
  Type,
} from "lucide-react";
import type { WalletDocument, ProfileLink } from "@/lib/types";
import type { PerformanceAssessment, SavedOpportunityMatch } from "@/lib/performanceTypes";
import { normalizeSavedOpportunityMatches } from "@/lib/performanceTypes";
import type { ProfileEnrichment } from "@/lib/enrichmentTypes";
import { normalizeProfileEnrichment } from "@/lib/enrichmentTypes";
import { subscribeProfileLinks } from "@/lib/profileLinksClient";
import { trimSavedOpportunities, MAX_SAVED_OPPORTUNITIES } from "@/lib/savedOpportunities";
import { Button, Card, Chip, EmptyState, ErrorState, Textarea } from "@/components/ui";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/Reveal";
import { motion } from "framer-motion";
import MarkdownText from "@/components/ai/MarkdownText";
import { PRESET_ROADMAPS, type RoadmapData, type RoadmapItem } from "@/lib/roadmapData";


const EASE_OUT_EXPO = [0.22, 1, 0.36, 1] as const;

/* ==========================================================================
   Rich resume-audit shape. Mirrors the server's AuditResult so the full
   breakdown the analyzer produces can be rendered (and stored) verbatim.
   ========================================================================== */

interface RichBreakdown {
  impactAndMetrics: number;
  skillsRelevance: number;
  actionVerbs: number;
  formattingAndClarity: number;
  experienceDepth: number;
}

interface RichContactInfo {
  complete: boolean;
  present: { label: string; value: string }[];
  missing: string[];
  suggestion: string;
}

interface RichQuantifiedImpact {
  detected: number;
  bulletsWithoutMetrics: string[];
  suggestion: string;
}

interface RichSectionCheck {
  name: string;
  present: boolean;
}

interface RichJobMatch {
  score: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  summary: string;
}

interface RichAudit {
  atsScore: number;
  verdict?: string;
  breakdown: RichBreakdown;
  executiveSummary: string;
  strengths: string[];
  criticalNegatives: string[];
  atsKeywordsFound: string[];
  missingRecommendedKeywords: string[];
  bulletImprovements: { original: string; improved: string }[];
  actionPlan: string[];
  contactInfo?: RichContactInfo;
  quantifiedImpact?: RichQuantifiedImpact;
  sections?: RichSectionCheck[];
  talentGaps?: string[];
  interviewQuestions?: string[];
  jobMatch?: RichJobMatch;
  readabilityScore?: number;
}

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0;
}

function strList(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : [];
}

/** Coerce whatever the server sent into a render-safe RichAudit. */
function richAudit(raw: unknown): RichAudit {
  const a = (raw ?? {}) as Record<string, unknown>;
  const b = (a.breakdown ?? {}) as Record<string, unknown>;
  const bullets = Array.isArray(a.bulletImprovements)
    ? (a.bulletImprovements as unknown[]).filter(
        (x): x is { original: string; improved: string } =>
          !!x && typeof (x as { original?: unknown }).original === "string" &&
          typeof (x as { improved?: unknown }).improved === "string"
      )
    : [];
  const contactInfo = a.contactInfo as RichContactInfo | undefined;
  const quantifiedImpact = a.quantifiedImpact as RichQuantifiedImpact | undefined;
  const sections = Array.isArray(a.sections)
    ? (a.sections as unknown[]).filter(
        (s): s is RichSectionCheck =>
          !!s && typeof (s as { name?: unknown }).name === "string" && typeof (s as { present?: unknown }).present === "boolean"
      )
    : [];
  const jobMatch = a.jobMatch as RichJobMatch | undefined;
  return {
    atsScore: num(a.atsScore),
    verdict: typeof a.verdict === "string" ? a.verdict : undefined,
    breakdown: {
      impactAndMetrics: num(b.impactAndMetrics),
      skillsRelevance: num(b.skillsRelevance),
      actionVerbs: num(b.actionVerbs),
      formattingAndClarity: num(b.formattingAndClarity),
      experienceDepth: num(b.experienceDepth),
    },
    executiveSummary: typeof a.executiveSummary === "string" ? a.executiveSummary : "",
    strengths: strList(a.strengths),
    criticalNegatives: strList(a.criticalNegatives),
    atsKeywordsFound: strList(a.atsKeywordsFound),
    missingRecommendedKeywords: strList(a.missingRecommendedKeywords),
    bulletImprovements: bullets,
    actionPlan: strList(a.actionPlan),
    ...(contactInfo && typeof contactInfo === "object" ? { contactInfo } : {}),
    ...(quantifiedImpact && typeof quantifiedImpact === "object" ? { quantifiedImpact } : {}),
    ...(sections.length > 0 ? { sections } : {}),
    ...(Array.isArray(a.talentGaps) ? { talentGaps: strList(a.talentGaps) } : {}),
    ...(Array.isArray(a.interviewQuestions) ? { interviewQuestions: strList(a.interviewQuestions) } : {}),
    ...(jobMatch && typeof jobMatch === "object" ? { jobMatch } : {}),
    ...(typeof a.readabilityScore !== "undefined" ? { readabilityScore: num(a.readabilityScore) } : {}),
  };
}

function bytesLabel(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

const BREAKDOWN_LABELS: { key: keyof RichBreakdown; label: string }[] = [
  { key: "impactAndMetrics", label: "Impact & Metrics" },
  { key: "skillsRelevance", label: "Skills Relevance" },
  { key: "actionVerbs", label: "Action Verbs" },
  { key: "formattingAndClarity", label: "Formatting & Clarity" },
  { key: "experienceDepth", label: "Experience Depth" },
];





/** Hoisted so the nav does not rebuild the array on every render. */
const TABS = [
  { id: "recommendations", label: "Opportunity Matcher", icon: Award },
  { id: "performance", label: "Performance Tracker", icon: TrendingUp },
  { id: "resume", label: "ATS Resume Scan", icon: FileText },
  { id: "roadmap", label: "Career Roadmap", icon: Compass },
  { id: "advisor", label: "AI Assistant & Coach (Chatbot)", icon: MessageSquare },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function AIHub() {
  const { currentUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState<TabId>(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "performance") return "performance";
    if (tabParam === "resume") return "resume";
    if (tabParam === "roadmap") return "roadmap";
    if (tabParam === "advisor" || tabParam === "interview" || tabParam === "chat") return "advisor";
    return "recommendations";
  });

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "performance") {
      setActiveTab("performance");
    } else if (tabParam === "resume") {
      setActiveTab("resume");
    } else if (tabParam === "roadmap") {
      setActiveTab("roadmap");
    } else if (tabParam === "advisor" || tabParam === "interview" || tabParam === "chat") {
      setActiveTab("advisor");
    }
  }, [searchParams]);


  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.push("/auth/login");
    }
  }, [currentUser, authLoading, router]);

  if (authLoading || !currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-7 w-7 spin text-secondary" />
        <span className="sr-only">Loading your AI workspace</span>
      </div>
    );
  }

  return (
    <>
      <Navbar />
      <main className="flex-grow bg-background">
        <div className="shell py-16 lg:py-20">
          <Reveal>
            <span className="eyebrow text-secondary">AI Hub Workspace</span>
            <h1 className="mt-4 text-display-sm text-foreground">Intelligent Career Guidance</h1>
            <p className="mt-4 max-w-2xl text-base text-foreground-muted">
              Check opportunities, analyze your resume, and chat with our career assistant.
            </p>
            <div className="rule-accent mt-8" />
          </Reveal>

          <div className="mt-12 grid grid-cols-1 gap-8 lg:grid-cols-[16rem_1fr] lg:gap-10">
            {/* Instrument rail. Sticky so it stays reachable while a long tab
                scrolls; `h-fit` on a grid child is not enough for that. */}
            <nav aria-label="AI instruments" className="lg:sticky lg:top-24 lg:h-fit">
              <span className="eyebrow mb-4 px-3">AI Instruments</span>
              <ul className="space-y-1">
                {TABS.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <li key={tab.id}>
                      <button
                        type="button"
                        onClick={() => setActiveTab(tab.id as TabId)}
                        aria-current={isActive ? "page" : undefined}
                        className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors duration-base ${
                          isActive
                            ? "bg-surface-ink text-background shadow-e2"
                            : "text-foreground-muted hover:bg-surface-raised hover:text-foreground"
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className={isActive ? "font-semibold" : "font-medium"}>{tab.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>

            {/* Tab panel. Keyed so the entrance animation replays on switch —
                without the key the motion runs once and every later tab
                appears instantly, which felt like a broken transition. */}
            <div className="min-w-0">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              >
                {activeTab === "recommendations" && <RecommendationsTab />}
                {activeTab === "performance" && <PerformanceTab />}
                {activeTab === "resume" && <ResumeTab />}
                {activeTab === "roadmap" && <RoadmapTab />}
                {activeTab === "advisor" && <AdvisorInterviewHubTab />}
              </motion.div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

/* ==========================================================================
   TAB 1: OPPORTUNITY MATCHER
   ========================================================================== */

function RecommendationsTab() {
  const { currentUser, profile } = useAuth();
  const { opportunities } = useOpportunities();
  const [walletDocs, setWalletDocs] = useState<WalletDocument[]>([]);
  const [profileLinks, setProfileLinks] = useState<ProfileLink[]>([]);
  const [savedOpps, setSavedOpps] = useState<any[]>([]);
  const [enrichment, setEnrichment] = useState<ProfileEnrichment | null>(null);
  const [matches, setMatches] = useState<SavedOpportunityMatch[]>([]);
  const [matchRuns, setMatchRuns] = useState<{ createdAt: string; matches: SavedOpportunityMatch[] }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1. Wallet documents (resumes, projects, certificates, marksheets)
  useEffect(() => {
    if (!currentUser) return;
    const fetchWallet = async () => {
      try {
        const snap = await getDocs(
          query(collection(db, "wallet"), where("uid", "==", currentUser.uid))
        );
        const docs: WalletDocument[] = [];
        snap.forEach((d) => docs.push({ id: d.id, ...d.data() } as WalletDocument));
        setWalletDocs(docs);
      } catch (err) {
        console.error("Failed to load wallet docs for matcher:", err);
      }
    };
    fetchWallet();
  }, [currentUser]);

  // 2. Public profile links (GitHub, LinkedIn, LeetCode, portfolio)
  useEffect(() => {
    if (!currentUser) return;
    return subscribeProfileLinks(currentUser.uid, setProfileLinks);
  }, [currentUser]);

  // 3. Saved (bookmarked) opportunities — the ONLY ones the matcher analyses.
  useEffect(() => {
    if (!currentUser) return;
    const fetchSaved = async () => {
      try {
        const snap = await getDoc(doc(db, "bookmarks", currentUser.uid));
        if (!snap.exists()) {
          setSavedOpps([]);
          return;
        }
        const data = snap.data();
        const items: any[] = Array.isArray(data.items) ? data.items : [];
        const ids: string[] = Array.isArray(data.opportunityIds) ? data.opportunityIds : [];
        // Auto-remove the oldest saves once the limit is exceeded.
        const trimmed = trimSavedOpportunities(ids, items);
        if (trimmed.removedIds.length > 0) {
          console.warn(`[Saved] Removed ${trimmed.removedIds.length} oldest saved item(s) to stay within the ${MAX_SAVED_OPPORTUNITIES} limit.`);
          await setDoc(doc(db, "bookmarks", currentUser.uid), { opportunityIds: trimmed.opportunityIds, items: trimmed.items });
        }
        if (trimmed.items.length > 0) {
          setSavedOpps(trimmed.items);
          return;
        }
        // Fallback for older bookmark docs: resolve the id list against the feed.
        setSavedOpps(opportunities.filter((o) => trimmed.opportunityIds.includes(o.id)));
      } catch (err) {
        console.error("Failed to load saved opportunities:", err);
      }
    };
    fetchSaved();
  }, [currentUser, opportunities]);

  // 4. Enriched link data (GitHub repos + coding stats) for deeper evidence.
  useEffect(() => {
    if (!currentUser) return;
    const loadEnrichment = async () => {
      try {
        const snap = await getDoc(doc(db, "profile_enrichment", currentUser.uid));
        if (snap.exists()) setEnrichment(normalizeProfileEnrichment(snap.data()));
      } catch (err) {
        console.error("Failed to load profile enrichment:", err);
      }
    };
    loadEnrichment();
  }, [currentUser]);

  // 5. Previously stored matcher results (every run, newest first), so old
  // analyses remain viewable after a reload or a re-run.
  useEffect(() => {
    if (!currentUser) return;
    const loadMatches = async () => {
      try {
        const snap = await getDocs(
          query(collection(db, "opportunity_matches"), where("uid", "==", currentUser.uid))
        );
        const runs: { createdAt: string; matches: SavedOpportunityMatch[] }[] = [];
        snap.forEach((d) => {
          const data = d.data();
          const stored = normalizeSavedOpportunityMatches(data?.matches);
          if (stored.length > 0) runs.push({ createdAt: data?.createdAt || "", matches: stored });
        });
        runs.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
        if (runs.length > 0) {
          setMatchRuns(runs);
          setMatches(runs[0].matches);
        }
      } catch (err) {
        console.error("Failed to load stored opportunity matches:", err);
      }
    };
    loadMatches();
  }, [currentUser]);

  const hasGithub = profileLinks.some((l) => l.kind === "github" || l.url.includes("github.com"));

  const matchFor = (oppId: string | undefined) =>
    oppId ? matches.find((m) => m.opportunityId === oppId) : undefined;

  const runMatch = async () => {
    if (!currentUser || savedOpps.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const walletPayload = walletDocs.map((d) => ({
        name: d.name,
        category: d.category,
        insights: d.insights,
        extractedText: d.extractedText,
      }));
      const savedPayload = savedOpps.map((o) => ({
        id: o.id,
        title: o.title,
        organization: o.organization || o.orgName,
        category: o.category,
        field: o.field,
        description: o.description,
        eligibility: o.eligibility,
        deadline: o.deadline,
      }));
      const res = await AIServiceClient.analyzeSavedOpportunities({
        profile: profile || {},
        walletDocuments: walletPayload,
        savedOpportunities: savedPayload,
        enrichment,
      });
      setMatches(res);
      try {
        const createdAt = new Date().toISOString();
        await addDoc(collection(db, "opportunity_matches"), {
          uid: currentUser.uid,
          createdAt,
          updatedAt: createdAt,
          matches: res,
        });
        setMatchRuns((prev) => [{ createdAt, matches: res }, ...prev]);
      } catch (saveErr) {
        console.error("Failed to store opportunity matches:", saveErr);
      }
    } catch (err: any) {
      setError(
        err instanceof AIServiceUnavailableError
          ? err.message
          : err?.message || "Could not analyse your saved opportunities. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <span className="eyebrow">Instrument 01</span>
        <h2 className="mt-2 font-display text-2xl text-foreground">Saved Opportunity Matcher</h2>
        <p className="mt-2 max-w-2xl text-sm text-foreground-muted">
          This matcher only looks at the opportunities you have <strong>saved</strong>. For each one it reads your
          wallet documents, enriched GitHub / coding links and profile — then tells you which of your real strengths are
          a <strong>plus point</strong>, what is still missing, and exactly what to do to strengthen your case. No scores.
        </p>
      </div>

      {/* Evidence snapshot */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-surface-raised p-3 text-center">
          <span className="text-2xs font-semibold uppercase tracking-wider text-foreground-subtle">Saved Items</span>
          <p className="mt-1 font-display text-xl text-foreground">{savedOpps.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface-raised p-3 text-center">
          <span className="text-2xs font-semibold uppercase tracking-wider text-foreground-subtle">Wallet Docs</span>
          <p className="mt-1 font-display text-xl text-foreground">{walletDocs.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface-raised p-3 text-center">
          <span className="text-2xs font-semibold uppercase tracking-wider text-foreground-subtle">Public Links</span>
          <p className="mt-1 font-display text-xl text-foreground">{profileLinks.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface-raised p-3 text-center">
          <span className="text-2xs font-semibold uppercase tracking-wider text-foreground-subtle">GitHub Linked</span>
          <p className="mt-1 font-display text-xl text-foreground">{hasGithub ? "Yes" : "No"}</p>
        </div>
      </div>

      {savedOpps.length === 0 ? (
        <EmptyState
          icon={<Bookmark className="h-5 w-5" />}
          title="No saved opportunities yet"
          description="Bookmark a few opportunities and they will appear here for an evidence-backed plus-points and gaps analysis."
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-foreground-subtle">
              Analysing <span className="font-semibold text-foreground">{savedOpps.length}</span> saved{" "}
              {savedOpps.length === 1 ? "opportunity" : "opportunities"}
              {matches.length > 0 ? " · analysed below" : ""}
            </p>
            <Button
              variant="primary"
              onClick={runMatch}
              loading={loading}
              leadingIcon={!loading ? <Sparkles className="h-4 w-4" /> : undefined}
              disabled={loading}
            >
              {matches.length > 0 ? "Re-run analysis" : "Analyse my saved opportunities"}
            </Button>
          </div>

          {error ? (
            <ErrorState
              title="Analysis failed"
              description={error}
              action={
                <Button variant="outline" size="sm" onClick={runMatch}>
                  Try again
                </Button>
              }
            />
          ) : null}

          <div className="space-y-6">
            {savedOpps.map((opp) => {
              const match = matchFor(opp.id);
              return (
                <Card key={opp.id} className="overflow-hidden p-5 sm:p-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip tone="gold">{opp.category || "Opportunity"}</Chip>
                    {opp.field ? <span className="text-2xs text-foreground-subtle">{opp.field}</span> : null}
                    <span className="inline-flex items-center gap-1 rounded bg-secondary/10 px-2 py-0.5 text-2xs font-semibold text-secondary">
                      <Bookmark className="h-3 w-3 fill-current" />
                      Saved Item
                    </span>
                  </div>

                  <h3 className="mt-2 font-display text-lg leading-snug text-foreground">
                    <Link href={`/opportunity/${opp.id}`} className="transition-colors duration-base hover:text-secondary">
                      {opp.title}
                    </Link>
                  </h3>
                  <p className="mt-1 text-sm text-foreground-muted">
                    {[opp.organization || opp.orgName, opp.country].filter(Boolean).join(" · ")}
                  </p>

                  {match ? (
                    <div className="mt-4 space-y-4 border-t border-border/80 pt-4">
                      {match.summary ? (
                        <p className="text-sm leading-relaxed text-foreground-muted">{match.summary}</p>
                      ) : null}
                      {match.bestRole ? (
                        <p className="text-sm text-foreground">
                          <span className="text-foreground-subtle">Suggested role: </span>
                          <span className="font-medium">{match.bestRole}</span>
                        </p>
                      ) : null}

                      <div className="grid gap-4 md:grid-cols-2">
                        {match.plusPoints.length > 0 ? (
                          <div>
                            <span className="flex items-center gap-1.5 text-xs font-semibold text-success">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Your plus points
                            </span>
                            <ul className="mt-2 space-y-1.5">
                              {match.plusPoints.map((p, i) => (
                                <li key={i} className="flex gap-2 text-xs text-foreground-muted">
                                  <span className="text-success">+</span>
                                  <span>{p}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        {match.gaps.length > 0 ? (
                          <div>
                            <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-600">
                              <AlertCircle className="h-3.5 w-3.5" /> Gaps to close
                            </span>
                            <ul className="mt-2 space-y-1.5">
                              {match.gaps.map((g, i) => (
                                <li key={i} className="flex gap-2 text-xs text-foreground-muted">
                                  <span className="text-amber-600">–</span>
                                  <span>{g}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </div>

                      {match.actions.length > 0 ? (
                        <div>
                          <span className="text-xs font-semibold text-foreground">What to do next</span>
                          <ul className="mt-2 space-y-1.5">
                            {match.actions.map((a, i) => (
                              <li key={i} className="flex gap-1.5 text-xs text-foreground-subtle">
                                <ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-secondary" />
                                <span>{a}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-4 border-t border-border/80 pt-4 text-xs italic text-foreground-subtle">
                      Run the analysis to see your plus points, gaps and the role that fits you.
                    </p>
                  )}

                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4">
                    <span className="text-xs text-foreground-subtle">
                      Deadline{" "}
                      <span className="font-medium text-foreground">
                        {opp.deadline
                          ? new Date(opp.deadline).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })
                          : "Open"}
                      </span>
                    </span>
                    <Link
                      href={`/opportunity/${opp.id}`}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-secondary transition-colors duration-base hover:text-secondary-hover"
                    >
                      View Details
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </Card>
              );
            })}
          </div>

          {matchRuns.length > 1 ? (
            <div className="border-t border-border pt-6">
              <span className="eyebrow mb-3 block">Previous matcher runs (click to view)</span>
              <ul className="space-y-2">
                {matchRuns.map((run, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => setMatches(run.matches)}
                      className="flex w-full items-center justify-between gap-4 rounded-md bg-surface-raised px-4 py-3 text-left transition-colors hover:bg-surface"
                    >
                      <span className="flex items-center gap-2 text-sm text-foreground">
                        <Sparkles className="h-3.5 w-3.5 text-secondary" />
                        {run.matches.length} {run.matches.length === 1 ? "opportunity" : "opportunities"} analysed
                        {i === 0 ? <Chip tone="success">Latest</Chip> : null}
                      </span>
                      <span className="text-xs text-foreground-subtle">
                        {run.createdAt
                          ? new Date(run.createdAt).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}



/* ==========================================================================
   TAB 2: PERFORMANCE TRACKER
   Reads every document in the wallet, the opportunities the student saved,
   and their profile, then builds an evidence-backed profile of the person.
   ========================================================================== */

function StatPill({ label, value, icon }: { label: string; value: string | number; icon?: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface-raised p-3">
      <span className="flex items-center gap-1 text-2xs font-semibold uppercase tracking-wider text-foreground-subtle">
        {icon}
        {label}
      </span>
      <p className="mt-1 font-display text-lg text-foreground">{value}</p>
    </div>
  );
}

function PerformanceTab() {
  const { currentUser, profile } = useAuth();
  const [walletDocs, setWalletDocs] = useState<WalletDocument[]>([]);
  const [savedOpps, setSavedOpps] = useState<any[]>([]);
  const [profileLinks, setProfileLinks] = useState<ProfileLink[]>([]);
  const [enrichment, setEnrichment] = useState<ProfileEnrichment | null>(null);
  const [resumeScore, setResumeScore] = useState<number | null>(null);
  const [result, setResult] = useState<PerformanceAssessment | null>(null);
  const [assessments, setAssessments] = useState<{ createdAt: string; assessment: PerformanceAssessment }[]>([]);
  const [loading, setLoading] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enrichError, setEnrichError] = useState<string | null>(null);

  // Wallet documents — the raw evidence the assessment is built from.
  useEffect(() => {
    if (!currentUser) return;
    const fetchWallet = async () => {
      try {
        const snap = await getDocs(
          query(collection(db, "wallet"), where("uid", "==", currentUser.uid))
        );
        const docs: WalletDocument[] = [];
        snap.forEach((d) => docs.push({ id: d.id, ...d.data() } as WalletDocument));
        setWalletDocs(docs);
      } catch (err) {
        console.error("Failed to load wallet docs for performance tracker:", err);
      }
    };
    fetchWallet();
  }, [currentUser]);

  // Saved opportunities (bookmarked internships / hackathons / anything).
  useEffect(() => {
    if (!currentUser) return;
    const fetchSaved = async () => {
      try {
        const snap = await getDoc(doc(db, "bookmarks", currentUser.uid));
        if (snap.exists()) {
          const data = snap.data();
          const items: any[] = Array.isArray(data.items) ? data.items : [];
          const ids: string[] = Array.isArray(data.opportunityIds) ? data.opportunityIds : [];
          // Auto-remove the oldest saves once the limit is exceeded.
          const trimmed = trimSavedOpportunities(ids, items);
          if (trimmed.removedIds.length > 0) {
            console.warn(`[Saved] Removed ${trimmed.removedIds.length} oldest saved item(s) to stay within the ${MAX_SAVED_OPPORTUNITIES} limit.`);
            await setDoc(doc(db, "bookmarks", currentUser.uid), { opportunityIds: trimmed.opportunityIds, items: trimmed.items });
          }
          setSavedOpps(trimmed.items);
        }
      } catch (err) {
        console.error("Failed to load bookmarks for performance tracker:", err);
      }
    };
    fetchSaved();
  }, [currentUser]);

  // Public profile links (GitHub, coding platforms, portfolio).
  useEffect(() => {
    if (!currentUser) return;
    return subscribeProfileLinks(currentUser.uid, setProfileLinks);
  }, [currentUser]);

  // Enriched link data (GitHub repos + coding stats), if it was fetched before.
  useEffect(() => {
    if (!currentUser) return;
    const loadEnrichment = async () => {
      try {
        const snap = await getDoc(doc(db, "profile_enrichment", currentUser.uid));
        if (snap.exists()) setEnrichment(normalizeProfileEnrichment(snap.data()));
      } catch (err) {
        console.error("Failed to load profile enrichment:", err);
      }
    };
    loadEnrichment();
  }, [currentUser]);

  // Latest resume ATS score (a real fact, not an invented rating).
  useEffect(() => {
    if (!currentUser) return;
    const loadResume = async () => {
      try {
        const snap = await getDocs(
          query(collection(db, "resume_analyses"), where("uid", "==", currentUser.uid))
        );
        const rows: { ts: string; score: number }[] = [];
        snap.forEach((d) => {
          const data = d.data();
          if (typeof data?.atsScore === "number") rows.push({ ts: data.timestamp || "", score: data.atsScore });
        });
        rows.sort((a, b) => (a.ts < b.ts ? 1 : -1));
        if (rows.length > 0) setResumeScore(rows[0].score);
      } catch (err) {
        console.error("Failed to load resume score:", err);
      }
    };
    loadResume();
  }, [currentUser]);

  // Most recent stored assessment, so the page is not blank on return.
  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    const loadLatest = async () => {
      setLoadingHistory(true);
      try {
        const snap = await getDocs(
          query(collection(db, "performance_analyses"), where("uid", "==", currentUser.uid))
        );
        const rows: { createdAt: string; assessment: PerformanceAssessment }[] = [];
        snap.forEach((d) => {
          const data = d.data();
          if (data?.assessment) rows.push({ createdAt: data.createdAt || "", assessment: data.assessment });
        });
        rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
        if (!cancelled) {
          setAssessments(rows);
          if (rows.length > 0) setResult(rows[0].assessment);
        }
      } catch (err) {
        console.error("Failed to load latest performance assessment:", err);
      } finally {
        if (!cancelled) setLoadingHistory(false);
      }
    };
    loadLatest();
    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  const runEnrichment = async (): Promise<ProfileEnrichment | null> => {
    if (!currentUser) return null;
    const links = profileLinks.map((l) => ({ url: l.url, kind: l.kind, id: l.id }));
    if (links.length === 0) {
      setEnrichError("Add a GitHub or coding-platform link to your profile first.");
      return null;
    }
    setEnriching(true);
    setEnrichError(null);
    try {
      const res = await AIServiceClient.enrichProfile(links);
      setEnrichment(res.enrichment);
      try {
        await setDoc(doc(db, "profile_enrichment", currentUser.uid), { ...res.enrichment });
      } catch (saveErr) {
        console.error("Failed to store enrichment:", saveErr);
      }
      // Write the detected platform labels back onto the link documents.
      for (const label of res.labels) {
        const link = profileLinks.find((l) => l.url === label.url);
        if (link?.id) {
          try {
            await setDoc(
              doc(db, "users", currentUser.uid, "profileLinks", link.id),
              { label: label.label },
              { merge: true }
            );
          } catch (labelErr) {
            console.error("Failed to update link label:", labelErr);
          }
        }
      }
      return res.enrichment;
    } catch (err: any) {
      setEnrichError(
        err instanceof AIServiceUnavailableError
          ? err.message
          : err?.message || "Could not analyse your links. Please try again."
      );
      return null;
    } finally {
      setEnriching(false);
    }
  };

  const runAssessment = async () => {
    if (!currentUser) return;
    setLoading(true);
    setError(null);
    try {
      // Make the GitHub/coding analysis part of the same run so GitHub facts are
      // always included, even if the user never pressed "Analyse my links" first.
      const hasAnalysableLinks = profileLinks.some(
        (l) => l.kind === "github" || l.kind === "leetcode" || l.kind === "codeforces" || l.kind === "codechef" || l.kind === "hackerrank" || l.url.includes("github.com")
      );
      let activeEnrichment = enrichment;
      if (hasAnalysableLinks && !activeEnrichment) {
        activeEnrichment = await runEnrichment();
      }
      const walletPayload = walletDocs.map((d) => ({
        name: d.name,
        category: d.category,
        insights: d.insights,
        extractedText: d.extractedText,
      }));
      const savedPayload = savedOpps.map((o) => ({
        id: o.id,
        title: o.title,
        organization: o.organization || o.orgName,
        category: o.category,
        field: o.field,
        description: o.description,
        eligibility: o.eligibility,
        deadline: o.deadline,
      }));
      const assessment = await AIServiceClient.analyzePerformance({
        profile: profile || {},
        walletDocuments: walletPayload,
        savedOpportunities: savedPayload,
        enrichment: activeEnrichment,
      });
      setResult(assessment);
      // Store the full picture: the AI assessment plus a factual snapshot of
      // every extracted data point, so nothing we derived is ever lost.
      const ghSnapshot = activeEnrichment?.github || null;
      const codingSnapshot = activeEnrichment?.coding || [];
      const facts = {
        walletDocCount: walletDocs.length,
        savedCount: savedOpps.length,
        certificates: walletDocs.filter((d) => d.category === "Certificates").length,
        awards: walletDocs.filter((d) => d.category === "Awards").length,
        hackathons: walletDocs.filter((d) =>
          `${d.name} ${d.category} ${(d as any).extractedText || ""}`.toLowerCase().includes("hackathon")
        ).length,
        resumeScore,
        github: ghSnapshot
          ? {
              username: ghSnapshot.username,
              publicRepos: ghSnapshot.publicRepos,
              followers: ghSnapshot.followers,
              totalStars: ghSnapshot.totalStars,
              totalCommits: ghSnapshot.totalCommits,
            }
          : null,
        coding: codingSnapshot.map((c) => ({
          platform: c.platform,
          rating: c.rating,
          problemsSolved: c.problemsSolved,
        })),
      };
      const createdAt = new Date().toISOString();
      try {
        await addDoc(collection(db, "performance_analyses"), {
          uid: currentUser.uid,
          createdAt,
          profileTitle: assessment.profileTitle,
          assessment,
          facts,
        });
        setAssessments((prev) => [{ createdAt, assessment }, ...prev]);
      } catch (saveErr) {
        console.error("Failed to store performance assessment:", saveErr);
      }
    } catch (err: any) {
      setError(
        err instanceof AIServiceUnavailableError
          ? err.message
          : err?.message || "The assessment could not be completed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // Factual tallies, read straight from the records — no invented scores.
  const certs = walletDocs.filter((d) => d.category === "Certificates");
  const awards = walletDocs.filter((d) => d.category === "Awards");
  const hackathonDocs = walletDocs.filter((d) =>
    `${d.name} ${d.category} ${(d as any).extractedText || ""}`.toLowerCase().includes("hackathon")
  );
  const hackWins = hackathonDocs.filter((d) =>
    /winner|won|1st|first place|rank 1|prize|awarded|champion/i.test(`${d.name} ${(d as any).extractedText || ""}`)
  );
  const gh = enrichment?.github || null;
  const coding = enrichment?.coding || [];

  const evidenceCount = walletDocs.length + savedOpps.length + (gh ? 1 : 0) + coding.length;
  const canRun = evidenceCount > 0 || (profile?.skills?.length || 0) > 0 || !!profile?.education;

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl">
            <span className="eyebrow text-secondary">Performance Tracker</span>
            <h2 className="mt-2 font-display text-xl text-foreground">
              Your performance, personality &amp; proof
            </h2>
            <p className="mt-2 text-sm text-foreground-muted">
              We gather your real proof — wallet documents, every GitHub repository (stars, commits, a review each),
              coding-platform stats, your latest resume score, certificates and hackathons — then describe your
              personality, plus points, gaps and the career lines that fit you. We don&apos;t invent ratings.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Chip tone="neutral" icon={<FolderGit2 className="h-3 w-3" />}>{walletDocs.length} wallet documents</Chip>
              <Chip tone="neutral" icon={<Bookmark className="h-3 w-3" />}>{savedOpps.length} saved opportunities</Chip>
              <Chip tone="neutral" icon={<Github className="h-3 w-3" />}>{gh ? `${gh.publicRepos} repos` : "GitHub not analysed"}</Chip>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Button
              variant="outline"
              onClick={runEnrichment}
              loading={enriching}
              leadingIcon={!enriching ? <RefreshCw className="h-4 w-4" /> : undefined}
              disabled={enriching}
            >
              {enrichment ? "Refresh my links" : "Analyse my links"}
            </Button>
            <Button
              variant="primary"
              onClick={runAssessment}
              loading={loading}
              leadingIcon={!loading ? <Sparkles className="h-4 w-4" /> : undefined}
              disabled={!canRun || loading}
            >
              {result ? "Re-run personality" : "Run personality assessment"}
            </Button>
          </div>
        </div>
        {!canRun ? (
          <p className="mt-4 text-sm text-foreground-subtle">
            Upload documents to your wallet, save opportunities, or add a GitHub/coding link to enable the assessment.
          </p>
        ) : null}
      </Card>

      {enrichError ? (
        <ErrorState
          title="Link analysis failed"
          description={enrichError}
          action={
            <Button variant="outline" size="sm" onClick={runEnrichment}>
              Try again
            </Button>
          }
        />
      ) : null}

      {error ? (
        <ErrorState
          title="Assessment failed"
          description={error}
          action={
            <Button variant="outline" size="sm" onClick={runAssessment}>
              Try again
            </Button>
          }
        />
      ) : null}

      {loading ? (
        <Card className="p-10">
          <div className="flex flex-col items-center gap-3 text-center">
            <Loader2 className="h-7 w-7 spin text-secondary" />
            <p className="text-sm text-foreground-muted">
              Studying your wallet, links, saved opportunities and profile…
            </p>
          </div>
        </Card>
      ) : null}

      {/* GitHub analysis failure — shown so the user is never left guessing. */}
      {enrichment?.githubError ? (
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-warning" />
            <h3 className="font-display text-base text-foreground">GitHub analysis issue</h3>
          </div>
          <p className="mt-2 text-sm text-foreground-muted">{enrichment.githubError}</p>
          <p className="mt-2 text-xs text-foreground-subtle">
            GitHub allows only 60 requests/hour without a token (shared across everyone), versus 5,000/hour with one.
            Add <span className="font-mono">GITHUB_TOKEN</span> to your environment to fix rate-limit errors.
          </p>
        </Card>
      ) : null}

      {/* GitHub facts — every repo with stars, commits and a review. */}
      {gh ? (
        <Card className="p-6">
          <div className="flex flex-wrap items-center gap-3">
            <Github className="h-5 w-5 text-foreground" />
            <h3 className="font-display text-base text-foreground">GitHub — {gh.name || gh.username}</h3>
            <a
              href={gh.profileUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-medium text-secondary hover:underline"
            >
              @{gh.username}
            </a>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <StatPill label="Public Repos" value={gh.publicRepos} />
            <StatPill label="Total Stars" value={gh.totalStars} icon={<Star className="h-3 w-3" />} />
            <StatPill label="Total Forks" value={gh.totalForks} icon={<GitFork className="h-3 w-3" />} />
            <StatPill label="Commits (sampled)" value={gh.totalCommits ?? "—"} icon={<GitCommit className="h-3 w-3" />} />
            <StatPill label="Followers" value={gh.followers} />
          </div>
          {gh.topLanguages.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {gh.topLanguages.map((lang) => (
                <Chip key={lang} tone="info">{lang}</Chip>
              ))}
            </div>
          ) : null}
          {gh.repos.length > 0 ? (
            <div className="mt-4 space-y-2">
              {gh.repos.map((repo) => (
                <div key={repo.fullName} className="card-inset rounded-lg p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={repo.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-semibold text-foreground hover:text-secondary"
                    >
                      {repo.name}
                    </a>
                    {repo.language ? <Chip tone="neutral">{repo.language}</Chip> : null}
                    {repo.isFork ? <Chip tone="neutral">fork</Chip> : null}
                    <span className="ml-auto flex items-center gap-3 text-xs text-foreground-subtle">
                      <span className="inline-flex items-center gap-1"><Star className="h-3 w-3" />{repo.stars}</span>
                      <span className="inline-flex items-center gap-1"><GitFork className="h-3 w-3" />{repo.forks}</span>
                      {repo.commits != null ? (
                        <span className="inline-flex items-center gap-1"><GitCommit className="h-3 w-3" />{repo.commits}</span>
                      ) : null}
                    </span>
                  </div>
                  {repo.description ? (
                    <p className="mt-1 text-xs text-foreground-muted">{repo.description}</p>
                  ) : null}
                  {repo.review ? (
                    <p className="mt-1.5 text-xs italic text-foreground-subtle">{repo.review}</p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </Card>
      ) : null}

      {/* Coding platforms — real ratings and solved counts. */}
      {coding.length > 0 ? (
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <Code2 className="h-5 w-5 text-foreground" />
            <h3 className="font-display text-base text-foreground">Coding platforms</h3>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {coding.map((c, i) => (
              <div key={`${c.platform}-${i}`} className="card-inset rounded-lg p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold capitalize text-foreground">{c.platform}</span>
                  {c.handle ? <span className="text-xs text-foreground-subtle">@{c.handle}</span> : null}
                </div>
                {c.available ? (
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground-muted">
                    {c.rating != null ? <span>Rating: <span className="font-semibold text-foreground">{c.rating}</span>{c.maxRating != null ? ` (max ${c.maxRating})` : ""}</span> : null}
                    {c.rank ? <span>Rank: <span className="font-semibold text-foreground">{c.rank}</span></span> : null}
                    {c.problemsSolved != null ? <span>Solved: <span className="font-semibold text-foreground">{c.problemsSolved}</span></span> : null}
                    {c.contests != null ? <span>Contests: <span className="font-semibold text-foreground">{c.contests}</span></span> : null}
                    {c.stars != null ? <span>Stars: <span className="font-semibold text-foreground">{c.stars}</span></span> : null}
                  </div>
                ) : (
                  <p className="mt-2 text-xs italic text-foreground-subtle">{c.note || "No public stats available."}</p>
                )}
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {/* Latest resume ATS score (a real, computed fact). */}
      {resumeScore != null ? (
        <Card className="flex flex-wrap items-center justify-between gap-4 p-6">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-foreground" />
            <div>
              <h3 className="font-display text-base text-foreground">Latest resume ATS score</h3>
              <p className="text-xs text-foreground-subtle">From your most recent ATS Resume Scan.</p>
            </div>
          </div>
          <span className="font-display text-3xl text-foreground">{resumeScore}%</span>
        </Card>
      ) : null}

      {/* Certificates & achievements. */}
      <Card className="p-6">
        <div className="flex items-center gap-3">
          <Trophy className="h-5 w-5 text-foreground" />
          <h3 className="font-display text-base text-foreground">Certificates &amp; achievements</h3>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatPill label="Certificates" value={certs.length} icon={<GraduationCap className="h-3 w-3" />} />
          <StatPill label="Awards" value={awards.length} icon={<Trophy className="h-3 w-3" />} />
          <StatPill label="Hackathons" value={hackathonDocs.length} />
          <StatPill label="Hackathon wins" value={hackWins.length} />
        </div>
        {certs.length + awards.length > 0 ? (
          <ul className="mt-4 space-y-1.5">
            {[...certs, ...awards].slice(0, 12).map((d) => (
              <li key={d.id} className="flex items-center gap-2 text-sm text-foreground-muted">
                <GraduationCap className="h-3.5 w-3.5 shrink-0 text-secondary" />
                <span className="truncate">{d.name}</span>
                <span className="ml-auto text-2xs text-foreground-subtle">{d.category}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-foreground-subtle">
            Add certificates, awards and hackathon proofs to your wallet to build this list.
          </p>
        )}
      </Card>

      {!loading && !result && !loadingHistory ? (
        <EmptyState
          icon={<TrendingUp className="h-5 w-5" />}
          title="No personality assessment yet"
          description="Run your first assessment to see your traits, honed skills, plus points and best-fit career lines."
        />
      ) : null}

      {/* Qualitative assessment (no invented scores). */}
      {!loading && result ? (
        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="font-display text-lg text-foreground">{result.profileTitle || "Your Profile"}</h3>
            {result.summary ? (
              <p className="mt-2 text-sm leading-relaxed text-foreground-muted">{result.summary}</p>
            ) : null}
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            {result.traits.length > 0 ? (
              <Card className="p-6">
                <h3 className="font-display text-base text-foreground">Personality traits</h3>
                <ul className="mt-4 space-y-4">
                  {result.traits.map((t, i) => (
                    <li key={`${t.name}-${i}`}>
                      <p className="text-sm font-semibold text-foreground">{t.name}</p>
                      {t.evidence ? <p className="mt-0.5 text-xs text-foreground-muted">{t.evidence}</p> : null}
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}
            {result.skills.length > 0 ? (
              <Card className="p-6">
                <h3 className="font-display text-base text-foreground">Skills (hunars)</h3>
                <ul className="mt-4 space-y-4">
                  {result.skills.map((s, i) => (
                    <li key={`${s.name}-${i}`}>
                      <p className="text-sm font-semibold text-foreground">{s.name}</p>
                      {s.evidence ? <p className="mt-0.5 text-xs text-foreground-muted">{s.evidence}</p> : null}
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {result.plusPoints.length > 0 ? (
              <Card className="p-6">
                <h3 className="flex items-center gap-2 font-display text-base text-foreground">
                  <CheckCircle2 className="h-4 w-4 text-secondary" /> Plus points
                </h3>
                <ul className="mt-3 space-y-2">
                  {result.plusPoints.map((p, i) => (
                    <li key={i} className="flex gap-2 text-sm text-foreground-muted">
                      <span className="text-secondary">+</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}
            {result.gaps.length > 0 ? (
              <Card className="p-6">
                <h3 className="flex items-center gap-2 font-display text-base text-foreground">
                  <AlertCircle className="h-4 w-4 text-rose-500" /> Gaps to fix
                </h3>
                <ul className="mt-3 space-y-2">
                  {result.gaps.map((g, i) => (
                    <li key={i} className="flex gap-2 text-sm text-foreground-muted">
                      <span className="text-rose-500">–</span>
                      <span>{g}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}
          </div>

          {result.careerPaths.length > 0 ? (
            <Card className="p-6">
              <h3 className="font-display text-base text-foreground">Career lines that fit you</h3>
              <p className="mt-1 text-xs text-foreground-subtle">Which direction you can move into, best fit first.</p>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                {result.careerPaths.map((c, i) => (
                  <div key={`${c.title}-${i}`} className="card-inset rounded-lg p-4">
                    <span className="text-sm font-semibold text-foreground">{c.title}</span>
                    {c.reason ? <p className="mt-2 text-xs text-foreground-muted">{c.reason}</p> : null}
                    {c.steps.length > 0 ? (
                      <ul className="mt-3 space-y-1">
                        {c.steps.map((s, j) => (
                          <li key={j} className="flex gap-1.5 text-xs text-foreground-subtle">
                            <ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-secondary" />
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          {result.roleFit.length > 0 ? (
            <Card className="p-6">
              <h3 className="font-display text-base text-foreground">Role fit for your saved opportunities</h3>
              <p className="mt-1 text-xs text-foreground-subtle">
                How you slot into each internship, hackathon or program you saved — and the role that suits you.
              </p>
              <div className="mt-4 space-y-4">
                {result.roleFit.map((r, i) => (
                  <div key={`${r.title}-${i}`} className="card-inset rounded-lg p-4">
                    <p className="truncate text-sm font-semibold text-foreground">{r.title}</p>
                    <p className="text-xs text-foreground-subtle">
                      {[r.organization, r.category].filter(Boolean).join(" · ")}
                    </p>
                    {r.bestRole ? (
                      <p className="mt-2 text-sm text-foreground">
                        <span className="text-foreground-subtle">Best role: </span>
                        {r.bestRole}
                      </p>
                    ) : null}
                    {r.reason ? <p className="mt-1 text-xs text-foreground-muted">{r.reason}</p> : null}
                    {(r.matchedSkills.length > 0 || r.missingSkills.length > 0) ? (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {r.matchedSkills.map((s, j) => (
                          <Chip key={`m-${j}`} tone="success">{s}</Chip>
                        ))}
                        {r.missingSkills.map((s, j) => (
                          <Chip key={`x-${j}`} tone="danger">{s}</Chip>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          {result.evidenceHighlights.length > 0 ? (
            <Card className="p-6">
              <h3 className="font-display text-base text-foreground">Evidence from your wallet</h3>
              <div className="mt-4 space-y-3">
                {result.evidenceHighlights.map((e, i) => (
                  <div key={i} className="flex gap-3">
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{e.document}</p>
                      {e.highlight ? <p className="text-xs text-foreground-muted">{e.highlight}</p> : null}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          {result.nextActions.length > 0 ? (
            <Card className="p-6">
              <h3 className="font-display text-base text-foreground">Next actions</h3>
              <ol className="mt-4 space-y-2">
                {result.nextActions.map((a, i) => (
                  <li key={i} className="flex gap-3 text-sm text-foreground-muted">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-ink text-[0.7rem] font-semibold text-background">
                      {i + 1}
                    </span>
                    <span>{a}</span>
                  </li>
                ))}
              </ol>
            </Card>
          ) : null}
        </div>
      ) : null}

      {assessments.length > 1 ? (
        <div className="border-t border-border pt-6">
          <span className="eyebrow mb-3 block">Previous assessments (click to view)</span>
          <ul className="space-y-2">
            {assessments.map((a, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => setResult(a.assessment)}
                  className="flex w-full items-center justify-between gap-4 rounded-md bg-surface-raised px-4 py-3 text-left transition-colors hover:bg-surface"
                >
                  <span className="flex items-center gap-2 text-sm text-foreground">
                    <TrendingUp className="h-3.5 w-3.5 text-secondary" />
                    {a.assessment.profileTitle || "Assessment"}
                    {i === 0 ? <Chip tone="success">Latest</Chip> : null}
                  </span>
                  <span className="text-xs text-foreground-subtle">
                    {a.createdAt
                      ? new Date(a.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/* ==========================================================================
   TAB 3: RESUME ANALYZER (Scan)
   ========================================================================== */
function ResumeTab() {
  const { currentUser } = useAuth();
  const [resumeText, setResumeText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RichAudit | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [targetJob, setTargetJob] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState("");
  const [analysisError, setAnalysisError] = useState("");

  const fetchHistory = async () => {
    if (!currentUser) return;
    try {
      // Query without composite ordering so missing Firestore index doesn't throw
      const q = query(
        collection(db, "resume_analyses"),
        where("uid", "==", currentUser.uid)
      );
      const snap = await getDocs(q);
      const list: any[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      list.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
      setHistory(list.slice(0, 10));
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [currentUser]);

  // Extracts plain text from an uploaded PDF/DOCX/TXT resume file and drops
  // it into the same `resumeText` state the paste-box uses. Any failure
  // here is caught and surfaced as a friendly message — it never breaks the
  // rest of the tab, and the user can always fall back to pasting text
  // manually below.
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileUpload = async (file: File) => {
    setExtractError("");
    setExtracting(true);
    setUploadedFileName(file.name);
    setSelectedFile(file);

    try {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (ext === "txt") {
        const text = await file.text();
        setResumeText(text.trim());
      } else {
        // For PDF and DOCX, we send file directly to server-side parser
        setResumeText(`[Uploaded File: ${file.name}] (Server-side parser will analyze contents)`);
      }
    } catch (err: any) {
      console.error("Resume file preview failed:", err);
      setExtractError(err?.message || "Failed to read this file.");
    } finally {
      setExtracting(false);
    }
  };

  const flatToRich = (a: ResumeAnalysisResult): RichAudit =>
    richAudit({
      atsScore: a.atsScore,
      executiveSummary: a.formattingFeedback,
      strengths: a.strengths,
      criticalNegatives: a.weaknesses,
      missingRecommendedKeywords: a.missingSkills,
      actionPlan: a.improvementSuggestions,
    });

  const analyzeResume = async () => {
    if (!resumeText.trim() && !selectedFile) return;
    setLoading(true);
    setAnalysisError("");
    try {
      let audit: RichAudit;

      if (selectedFile) {
        const formData = new FormData();
        formData.append("file", selectedFile);
        if (targetJob.trim()) formData.append("targetJobDescription", targetJob.trim());
        const res = await authedFetch("/api/resume/analyze", {
          method: "POST",
          body: formData,
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          throw new Error(errData?.error || `Analysis failed with status ${res.status}`);
        }
        const data = await res.json();
        audit = richAudit(data.audit);
      } else {
        const body: Record<string, string> = { resumeText };
        if (targetJob.trim()) body.targetJobDescription = targetJob.trim();
        const res = await authedFetch("/api/resume/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          const data = await res.json();
          audit = richAudit(data.audit);
        } else {
          // Fallback to the legacy action when the server analyser is unavailable.
          const legacy = await AIServiceClient.analyzeResume(resumeText);
          audit = flatToRich(legacy);
        }
      }

      setResult(audit);

      if (currentUser) {
        await addDoc(collection(db, "resume_analyses"), {
          uid: currentUser.uid,
          atsScore: audit.atsScore,
          weaknesses: audit.criticalNegatives,
          missingSkills: audit.missingRecommendedKeywords,
          formattingFeedback: audit.executiveSummary,
          improvementSuggestions: audit.actionPlan,
          strengths: audit.strengths,
          audit,
          timestamp: new Date().toISOString(),
        });
        await fetchHistory();
      }
    } catch (error: any) {
      console.error(error);
      setResult(null);
      setAnalysisError(
        error?.message || "Could not analyze your resume right now. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const downloadPdf = async () => {
    if (!result) return;
    setAnalysisError("");
    try {
      const res = await authedFetch("/api/resume/download-audit-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audit: result, fileName: uploadedFileName || "Resume" }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || `PDF export failed with status ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${(uploadedFileName || "Resume").replace(/\.[^.]+$/, "")}_ATS_Report.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setAnalysisError(err?.message || "Could not generate the PDF report.");
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <span className="eyebrow">Instrument 02</span>
        <h2 className="mt-2 font-display text-2xl text-foreground">AI ATS Resume Scanner</h2>
        <p className="mt-2 max-w-xl text-sm text-foreground-muted">
          Paste your resume text to get formatting advice, ATS scoring, and skill addition
          templates from Gemini.
        </p>
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <span className="eyebrow">Upload resume file</span>
          <label
            className={`flex cursor-pointer items-center justify-center gap-3 rounded-lg border border-dashed px-5 py-8 text-sm transition-colors duration-base ${
              extracting
                ? "border-border bg-surface-sunken text-foreground-subtle"
                : "border-border-strong bg-surface-raised text-foreground-muted hover:border-secondary hover:bg-accent-gold-surface/50 hover:text-foreground"
            }`}
          >
            {extracting ? (
              <>
                <Loader2 className="h-4 w-4 spin text-secondary" /> Reading {uploadedFileName}…
              </>
            ) : uploadedFileName ? (
              <>
                <FileText className="h-4 w-4 text-secondary" /> {uploadedFileName}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setUploadedFileName("");
                    setSelectedFile(null);
                    setResumeText("");
                    setExtractError("");
                  }}
                  className="ml-1 rounded-sm p-1 transition-colors duration-fast hover:bg-surface hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                  <span className="sr-only">Remove uploaded file</span>
                </button>
              </>
            ) : (
              <>
                <UploadCloud className="h-4 w-4" /> Click to upload a .pdf, .docx, or .txt resume
              </>
            )}
            <input
              type="file"
              accept=".pdf,.docx,.txt"
              className="sr-only"
              disabled={extracting}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
                e.target.value = "";
              }}
            />
          </label>
          {extractError && <ErrorState description={extractError} className="py-4 text-left" />}
        </div>

        <div className="flex items-center gap-4">
          <div className="h-px flex-1 bg-border" />
          <span className="eyebrow">or paste manually</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <Textarea
          label="Paste resume plain text"
          rows={7}
          placeholder="Paste raw text of your resume here to analyze structure, skills, and formats…"
          value={resumeText}
          onChange={(e) => setResumeText(e.target.value)}
        />

        <Textarea
          label="Target job description (optional — enables Job Match %)"
          rows={3}
          placeholder="Paste the job posting you're targeting. Adds matched/missing keyword analysis and a match score…"
          value={targetJob}
          onChange={(e) => setTargetJob(e.target.value)}
        />

        <Button
          block
          onClick={analyzeResume}
          disabled={loading || !resumeText.trim()}
          leadingIcon={loading ? <Loader2 className="h-4 w-4 spin" /> : null}
        >
          {loading ? "Scanning…" : "Run AI Scan & ATS Grade"}
        </Button>
      </div>

      {analysisError && <ErrorState description={analysisError} />}

      {result && (
        <Reveal className="space-y-6 border-t border-border pt-8">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-surface-raised px-5 py-4">
            <div>
              <span className="eyebrow">ATS Score Estimation</span>
              <span className="mt-2 block font-display text-4xl leading-none text-foreground">
                {result.atsScore}
                <span className="text-lg text-foreground-subtle">/100</span>
              </span>
              <div className="mt-3 flex flex-wrap gap-2">
                {result.verdict && (
                  <Chip tone={result.atsScore >= 85 ? "success" : result.atsScore >= 70 ? "warning" : "danger"}>
                    {result.verdict}
                  </Chip>
                )}
                {typeof result.readabilityScore === "number" && (
                  <Chip tone="info">Readability {result.readabilityScore}/100</Chip>
                )}
                {result.atsScore >= 75 ? (
                  <Chip tone="success">Ready to Apply</Chip>
                ) : (
                  <Chip tone="warning">Needs Revision</Chip>
                )}
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              leadingIcon={<Download className="h-4 w-4" />}
              onClick={downloadPdf}
            >
              Download PDF Report
            </Button>
          </div>

          {result.jobMatch && (
            <Card tone="raised" className="p-5">
              <div className="flex items-center justify-between gap-4">
                <span className="eyebrow">Job match</span>
                <span className="font-display text-2xl text-foreground">{result.jobMatch.score}%</span>
              </div>
              {result.jobMatch.summary && (
                <p className="mt-2 text-sm leading-relaxed text-foreground">{result.jobMatch.summary}</p>
              )}
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                {result.jobMatch.matchedKeywords.length > 0 && (
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-success">Matched keywords</span>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {result.jobMatch.matchedKeywords.map((k, i) => (
                        <Chip key={i} tone="success">{k}</Chip>
                      ))}
                    </div>
                  </div>
                )}
                {result.jobMatch.missingKeywords.length > 0 && (
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-danger">Missing from resume</span>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {result.jobMatch.missingKeywords.map((k, i) => (
                        <Chip key={i} tone="danger">{k}</Chip>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}

          <Card tone="raised" className="p-5">
            <span className="eyebrow">Score breakdown</span>
            <div className="mt-4 space-y-3">
              {BREAKDOWN_LABELS.map(({ key, label }) => {
                const v = result.breakdown[key];
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-foreground-muted">{label}</span>
                      <span className="font-display text-foreground">{v}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-ink/10">
                      <div className="h-full rounded-full bg-secondary" style={{ width: `${v}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {result.executiveSummary && (
            <Card tone="inset" className="p-5">
              <span className="eyebrow">Executive summary</span>
              <p className="mt-2 text-sm leading-relaxed text-foreground">{result.executiveSummary}</p>
            </Card>
          )}

          {(result.contactInfo || result.quantifiedImpact) && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {result.contactInfo && (
                <Card tone="raised" className="p-5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="eyebrow">Contact info</span>
                    <Chip tone={result.contactInfo.complete ? "success" : "warning"}>
                      {result.contactInfo.complete ? "Complete" : "Incomplete"}
                    </Chip>
                  </div>
                  <ul className="mt-3 space-y-1.5">
                    {result.contactInfo.present.map((p, i) => (
                      <li key={i} className="flex gap-2 text-sm text-foreground">
                        <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                        <span className="text-foreground-muted">{p.label}:</span> {p.value}
                      </li>
                    ))}
                  </ul>
                  {result.contactInfo.missing.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {result.contactInfo.missing.map((m, i) => (
                        <Chip key={i} tone="danger">{m}</Chip>
                      ))}
                    </div>
                  )}
                  {result.contactInfo.suggestion && (
                    <p className="mt-3 text-sm text-foreground-muted">{result.contactInfo.suggestion}</p>
                  )}
                </Card>
              )}

              {result.quantifiedImpact && (
                <Card tone="raised" className="p-5">
                  <span className="eyebrow">Quantified impact</span>
                  <p className="mt-2 text-sm text-foreground">
                    <span className="font-display text-2xl">{result.quantifiedImpact.detected}</span>{" "}
                    <span className="text-foreground-muted">metric-backed bullets</span>
                  </p>
                  {result.quantifiedImpact.bulletsWithoutMetrics.length > 0 && (
                    <div className="mt-3">
                      <span className="text-xs font-semibold uppercase tracking-wider text-warning">Add numbers to</span>
                      <ul className="mt-2 space-y-1.5">
                        {result.quantifiedImpact.bulletsWithoutMetrics.map((b, i) => (
                          <li key={i} className="flex gap-2 text-sm text-foreground-muted">
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" /> {b}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {result.quantifiedImpact.suggestion && (
                    <p className="mt-3 text-sm text-foreground-muted">{result.quantifiedImpact.suggestion}</p>
                  )}
                </Card>
              )}
            </div>
          )}

          {result.sections && result.sections.length > 0 && (
            <Card tone="raised" className="p-5">
              <span className="eyebrow">Sections detected</span>
              <ul className="mt-3 flex flex-wrap gap-2">
                {result.sections.map((s, i) => (
                  <li key={i}>
                    <Chip tone={s.present ? "success" : "danger"}>
                      {s.present ? "✓" : "✗"} {s.name}
                    </Chip>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card tone="raised" className="p-5">
              <span className="eyebrow">Strengths identified</span>
              <ul className="mt-3 space-y-2">
                {result.strengths.map((s, i) => (
                  <li key={i} className="flex gap-2.5 text-sm text-foreground">
                    <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-success" /> {s}
                  </li>
                ))}
              </ul>
            </Card>

            <Card tone="raised" className="p-5">
              <span className="eyebrow">Areas of weakness</span>
              <ul className="mt-3 space-y-2">
                {result.criticalNegatives.map((w, i) => (
                  <li key={i} className="flex gap-2.5 text-sm text-foreground">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" /> {w}
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card tone="raised" className="p-5">
              <span className="eyebrow">ATS keywords found</span>
              {result.atsKeywordsFound.length > 0 ? (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {result.atsKeywordsFound.map((k, i) => (
                    <li key={i}><Chip tone="success">{k}</Chip></li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-foreground-muted">No keywords were detected.</p>
              )}
            </Card>

            <Card tone="raised" className="p-5">
              <span className="eyebrow">Missing recommended keywords</span>
              {result.missingRecommendedKeywords.length > 0 ? (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {result.missingRecommendedKeywords.map((k, i) => (
                    <li key={i}><Chip tone="gold">{k}</Chip></li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-foreground-muted">Nothing obvious is missing.</p>
              )}
            </Card>
          </div>

          {result.bulletImprovements.length > 0 && (
            <Card tone="raised" className="p-5">
              <span className="eyebrow">Bullet rewrites</span>
              <div className="mt-3 space-y-3">
                {result.bulletImprovements.map((b, i) => (
                  <div key={i} className="rounded-lg border border-border bg-surface p-4">
                    <span className="text-xs font-semibold uppercase tracking-wider text-danger">Original</span>
                    <p className="mt-1 text-sm text-foreground-muted">{b.original}</p>
                    <span className="mt-3 block text-xs font-semibold uppercase tracking-wider text-success">Improved</span>
                    <p className="mt-1 text-sm text-foreground">{b.improved}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {((result.talentGaps && result.talentGaps.length > 0) || (result.interviewQuestions && result.interviewQuestions.length > 0)) && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {result.talentGaps && result.talentGaps.length > 0 && (
                <Card tone="raised" className="p-5">
                  <span className="eyebrow">Talent gaps</span>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {result.talentGaps.map((g, i) => (
                      <li key={i}><Chip tone="warning">{g}</Chip></li>
                    ))}
                  </ul>
                </Card>
              )}
              {result.interviewQuestions && result.interviewQuestions.length > 0 && (
                <Card tone="raised" className="p-5">
                  <span className="eyebrow">Likely interview questions</span>
                  <ul className="mt-3 space-y-2">
                    {result.interviewQuestions.map((q, i) => (
                      <li key={i} className="flex gap-2.5 text-sm text-foreground">
                        <span className="font-display text-foreground-subtle">{i + 1}.</span> {q}
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </div>
          )}

          {result.actionPlan.length > 0 && (
            <Card tone="raised" className="p-5">
              <span className="eyebrow">Action plan</span>
              <ul className="mt-3 space-y-2">
                {result.actionPlan.map((s, i) => (
                  <li key={i} className="flex gap-2.5 text-sm text-foreground-muted">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-foreground-subtle" />
                    {s}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </Reveal>
      )}

      {history.length > 0 && (
        <div className="border-t border-border pt-8">
          <span className="eyebrow mb-4">Previous resume scans (click to view)</span>
          <ul className="space-y-2">
            {history.map((h, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => {
                    if (h.audit) {
                      setResult(richAudit(h.audit));
                    } else {
                      setResult(
                        richAudit({
                          atsScore: h.atsScore,
                          strengths: h.strengths || [],
                          criticalNegatives: h.weaknesses || [],
                          missingRecommendedKeywords: h.missingSkills || [],
                          executiveSummary: h.formattingFeedback || "",
                          actionPlan: h.improvementSuggestions || [],
                        })
                      );
                    }
                  }}
                  className="flex w-full items-center justify-between gap-4 rounded-md bg-surface-raised px-4 py-3 text-left transition-colors hover:border-secondary hover:bg-surface"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-display text-lg text-foreground">{h.atsScore}/100</span>
                    <Chip tone={h.atsScore >= 75 ? "success" : "warning"}>
                      {h.atsScore >= 75 ? "Ready" : "Needs Polish"}
                    </Chip>
                  </div>
                  <span className="text-xs text-foreground-subtle">
                    {new Date(h.timestamp).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ==========================================================================
   TAB 4: CAREER ROADMAP (INSPIRED BY ROADMAP.SH + NEXORA AI ENGINE)
   ========================================================================== */
function RoadmapTab() {
  const { currentUser, profile } = useAuth();
  const [selectedPreset, setSelectedPreset] = useState<string>("frontend");
  const [customRole, setCustomRole] = useState("");
  const [activeRoadmap, setActiveRoadmap] = useState<RoadmapData>(PRESET_ROADMAPS["frontend"]);
  const [loadingAI, setLoadingAI] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [completedItems, setCompletedItems] = useState<Record<string, boolean>>({});
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [scanningProfile, setScanningProfile] = useState(false);
  const [scanMessage, setScanMessage] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"all" | "role" | "skill">("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!currentUser) return;
    let isMounted = true;
    const fetchProgress = async () => {
      try {
        const snap = await getDoc(doc(db, "roadmap_progress", `${currentUser.uid}_${activeRoadmap.roleId}`));
        if (isMounted && snap.exists() && snap.data().completed) {
          setCompletedItems(snap.data().completed);
        } else if (isMounted) {
          setCompletedItems({});
        }
      } catch (err: any) {
        // If security rules or network stream is temporarily warming up, fallback smoothly
        if (isMounted) setCompletedItems({});
      }
    };
    fetchProgress();
    return () => { isMounted = false; };
  }, [currentUser, activeRoadmap.roleId]);

  const toggleItem = async (itemId: string) => {
    const updated = { ...completedItems, [itemId]: !completedItems[itemId] };
    setCompletedItems(updated);
    if (currentUser) {
      try {
        await setDoc(doc(db, "roadmap_progress", `${currentUser.uid}_${activeRoadmap.roleId}`), {
          completed: updated,
          updatedAt: new Date().toISOString(),
          roleTitle: activeRoadmap.roleTitle,
        });
      } catch (e) {
        console.error("Error saving progress:", e);
      }
    }
  };

  const toggleExpand = (itemId: string) => {
    setExpandedItems((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const handleSelectPreset = (key: string) => {
    setSelectedPreset(key);
    setActiveRoadmap(PRESET_ROADMAPS[key]);
    setErrorMsg("");
    setScanMessage("");
  };

  const handleGenerateCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customRole.trim() || loadingAI) return;
    setLoadingAI(true);
    setErrorMsg("");
    setScanMessage("");

    try {
      const generated = await AIServiceClient.generateRoadmap(customRole.trim());
      if (generated && generated.phases && Array.isArray(generated.phases)) {
        setActiveRoadmap(generated);
        setSelectedPreset("custom");
      } else {
        throw new Error("Invalid roadmap structure generated.");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Failed to generate custom roadmap. Please try a different title or try again.");
    } finally {
      setLoadingAI(false);
    }
  };

  const autoCheckFromProfile = async () => {
    if (!currentUser) return;
    setScanningProfile(true);
    setScanMessage("");

    try {
      const userSkills: string[] = Array.isArray(profile?.skills) ? profile.skills.map((s: string) => s.toLowerCase()) : [];

      const snap = await getDocs(query(collection(db, "wallet"), where("uid", "==", currentUser.uid)));
      snap.forEach((d) => {
        const data = d.data();
        if (data.insights?.skills && Array.isArray(data.insights.skills)) {
          data.insights.skills.forEach((s: string) => userSkills.push(String(s).toLowerCase()));
        }
      });

      const newlyCompleted: Record<string, boolean> = { ...completedItems };
      let matchedCount = 0;

      activeRoadmap.phases.forEach((phase) => {
        phase.items.forEach((item) => {
          const reqs = item.requiredSkills.map((r) => r.toLowerCase());
          const hasSkill = reqs.some((r) => userSkills.some((us) => us.includes(r) || r.includes(us)));
          if (hasSkill && !newlyCompleted[item.id]) {
            newlyCompleted[item.id] = true;
            matchedCount++;
          }
        });
      });

      setCompletedItems(newlyCompleted);
      if (currentUser) {
        await setDoc(doc(db, "roadmap_progress", `${currentUser.uid}_${activeRoadmap.roleId}`), {
          completed: newlyCompleted,
          updatedAt: new Date().toISOString(),
          roleTitle: activeRoadmap.roleTitle,
        });
      }

      setScanMessage(
        matchedCount > 0
          ? `✨ Auto-checked ${matchedCount} milestone(s) based on your verified skills & wallet documents!`
          : `Checked your profile — no additional milestones matched your current records. Keep learning!`
      );
    } catch (e) {
      console.error("Auto check error:", e);
      setScanMessage("Could not scan profile records at this moment.");
    } finally {
      setScanningProfile(false);
    }
  };

  const allItems = activeRoadmap.phases.flatMap((p) => p.items);
  const totalCount = allItems.length;
  const completedCount = allItems.filter((i) => completedItems[i.id]).length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="eyebrow">Module 04</span>
          <h2 className="mt-1 font-display text-2xl text-foreground">Interactive Career Roadmaps</h2>
          <p className="mt-1 max-w-xl text-xs text-foreground-muted">
            Step-by-step engineering curriculum with project blueprints, topic deep dives, and progress tracking.
          </p>
        </div>

        <Button
          size="sm"
          variant="secondary"
          onClick={autoCheckFromProfile}
          disabled={scanningProfile}
          leadingIcon={scanningProfile ? <Loader2 className="h-3.5 w-3.5 spin" /> : <Sparkles className="h-3.5 w-3.5 text-secondary" />}
        >
          {scanningProfile ? "Scanning Records…" : "Auto-Sync with My Profile"}
        </Button>
      </div>

      {scanMessage && (
        <div className="rounded-lg border border-secondary/30 bg-secondary/10 px-4 py-2.5 text-xs text-foreground">
          {scanMessage}
        </div>
      )}

      {/* ── Category Filter Tabs ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1.5 rounded-xl border border-border bg-surface p-1">
          {(["all", "role", "skill"] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => { setCategoryFilter(cat); setSearchQuery(""); }}
              className={`rounded-lg px-4 py-1.5 text-xs font-semibold capitalize transition-all ${
                categoryFilter === cat
                  ? "bg-secondary text-white shadow-sm"
                  : "text-foreground-muted hover:text-foreground"
              }`}
            >
              {cat === "all" ? "All Roadmaps" : cat === "role" ? "Role-Based" : "Skill-Based"}
            </button>
          ))}
        </div>

        {/* ── Search Input ─────────────────────────────────────────────────── */}
        <div className="relative max-w-xs w-full">
          <input
            type="text"
            placeholder="Search roadmaps…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input w-full pl-8 text-xs"
          />
          <svg
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground-subtle"
            fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
          >
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
        </div>
      </div>

      {/* ── Roadmap Cards Grid ───────────────────────────────────────────── */}
      {(() => {
        const filteredEntries = Object.entries(PRESET_ROADMAPS).filter(([, data]) => {
          const matchesCategory = categoryFilter === "all" || data.category === categoryFilter;
          const q = searchQuery.toLowerCase();
          const matchesSearch = !q
            || data.roleTitle.toLowerCase().includes(q)
            || data.overview.toLowerCase().includes(q)
            || data.category.includes(q);
          return matchesCategory && matchesSearch;
        });

        if (filteredEntries.length === 0) {
          return (
            <div className="rounded-xl border border-border bg-surface py-10 text-center text-sm text-foreground-muted">
              No roadmaps match your search. Try a different keyword or clear the filter.
            </div>
          );
        }

        return (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredEntries.map(([key, data]) => {
              const isActive = selectedPreset === key;
              const allRoadmapItems = data.phases.flatMap((p) => p.items);
              const doneCount = allRoadmapItems.filter((i) => completedItems[i.id]).length;
              const pct = allRoadmapItems.length > 0 ? Math.round((doneCount / allRoadmapItems.length) * 100) : 0;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleSelectPreset(key)}
                  className={`group relative flex flex-col gap-3 rounded-xl border p-4 text-left transition-all ${
                    isActive
                      ? "border-secondary/60 bg-secondary/5 shadow-sm ring-1 ring-secondary/30"
                      : "border-border bg-surface-raised hover:border-secondary/40 hover:bg-surface"
                  }`}
                >
                  {/* Category badge */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider ${
                        data.category === "role"
                          ? "bg-info/10 text-info"
                          : "bg-secondary/10 text-secondary"
                      }`}
                    >
                      {data.category === "role" ? "Role-Based" : "Skill-Based"}
                    </span>
                    <span className="text-[0.65rem] text-foreground-subtle">{data.targetTimeline}</span>
                  </div>

                  {/* Title */}
                  <div>
                    <h4 className="font-display text-sm font-semibold text-foreground leading-snug">
                      {data.roleTitle}
                    </h4>
                    <p className="mt-1 line-clamp-2 text-[0.72rem] leading-relaxed text-foreground-muted">
                      {data.overview}
                    </p>
                  </div>

                  {/* Mini progress bar (if any progress recorded) */}
                  {pct > 0 && (
                    <div>
                      <div className="flex items-center justify-between text-[0.65rem] text-foreground-subtle mb-1">
                        <span>Progress</span>
                        <span className="font-semibold text-foreground">{pct}%</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-ink/10">
                        <div
                          className="h-full rounded-full bg-secondary transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Phase count */}
                  <div className="flex items-center justify-between">
                    <span className="text-[0.68rem] text-foreground-subtle">
                      {data.phases.length} phases · {allRoadmapItems.length} milestones
                    </span>
                    {isActive && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary">
                        <CheckCircle2 className="h-3 w-3 text-white" />
                      </span>
                    )}
                  </div>
                </button>
              );
            })}

            {/* Custom roadmap card (shown only when active) */}
            {selectedPreset === "custom" && (
              <div className="relative flex flex-col gap-3 rounded-xl border border-secondary/60 bg-secondary/5 p-4 shadow-sm ring-1 ring-secondary/30">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 rounded-full bg-secondary/15 px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-secondary">
                    AI-Generated
                  </span>
                  <CheckCircle2 className="h-4 w-4 text-secondary" />
                </div>
                <h4 className="font-display text-sm font-semibold text-foreground">{activeRoadmap.roleTitle}</h4>
                <p className="line-clamp-2 text-[0.72rem] leading-relaxed text-foreground-muted">{activeRoadmap.overview}</p>
              </div>
            )}
          </div>
        );
      })()}

      <Card tone="raised" className="p-3.5">
        <form onSubmit={handleGenerateCustom} className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Or type any custom role (e.g. Blockchain Developer, iOS Engineer, Cloud Architect...)"
              value={customRole}
              onChange={(e) => setCustomRole(e.target.value)}
              disabled={loadingAI}
              className="input w-full text-xs"
            />
          </div>
          <Button
            type="submit"
            size="sm"
            disabled={loadingAI || !customRole.trim()}
            leadingIcon={loadingAI ? <Loader2 className="h-3.5 w-3.5 spin" /> : <Sparkle className="h-3.5 w-3.5" />}
          >
            {loadingAI ? "Designing Roadmap…" : "Generate with AI"}
          </Button>
        </form>
        {errorMsg && <p className="mt-2 text-xs text-danger">{errorMsg}</p>}
      </Card>

      <Card tone="raised" className="p-5 border-border">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Compass className="h-5 w-5 text-secondary" />
              <h3 className="font-display text-xl text-foreground">{activeRoadmap.roleTitle}</h3>
              <Chip tone="info">Target: {activeRoadmap.targetTimeline}</Chip>
            </div>
            <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-foreground-muted">
              {activeRoadmap.overview}
            </p>
          </div>

          <div className="flex items-center gap-4 min-w-[200px]">
            <div className="flex-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-foreground-muted font-medium">Curriculum Progress</span>
                <span className="font-display text-sm font-semibold text-foreground">{progressPercent}%</span>
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-surface-ink/10">
                <div
                  className="h-full rounded-full bg-secondary transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="mt-1 block text-[0.7rem] text-foreground-subtle">
                {completedCount} of {totalCount} milestones completed
              </span>
            </div>
          </div>
        </div>
      </Card>

      <div className="space-y-8 pt-2">
        {activeRoadmap.phases.map((phase, pIdx) => (
          <div key={pIdx} className="space-y-4">
            <div className="flex items-center gap-2.5 border-b border-border pb-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary/10 font-display text-xs font-bold text-secondary">
                {pIdx + 1}
              </span>
              <h4 className="font-display text-base font-semibold text-foreground">
                {phase.phaseTitle}
              </h4>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {phase.items.map((item) => {
                const isDone = !!completedItems[item.id];
                const isExpanded = !!expandedItems[item.id];

                return (
                  <div
                    key={item.id}
                    className={`group relative rounded-xl border p-4 transition-all ${
                      isDone
                        ? "border-success/40 bg-success/5"
                        : "border-border bg-surface-raised hover:border-secondary/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => toggleItem(item.id)}
                        className="mt-0.5 text-foreground-muted transition-colors hover:text-foreground"
                        title={isDone ? "Mark as incomplete" : "Mark as completed"}
                      >
                        {isDone ? (
                          <CheckSquare className="h-5 w-5 text-success" />
                        ) : (
                          <Square className="h-5 w-5 text-foreground-subtle group-hover:text-foreground" />
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h5
                            className={`font-display text-sm font-medium ${
                              isDone ? "text-foreground line-through opacity-80" : "text-foreground"
                            }`}
                          >
                            {item.title}
                          </h5>
                          <span className="text-[0.68rem] text-foreground-subtle whitespace-nowrap">
                            {item.estimatedWeeks}
                          </span>
                        </div>

                        <p className="mt-1 text-xs text-foreground-muted leading-relaxed">
                          {item.description}
                        </p>

                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          {item.requiredSkills.map((skill, sIdx) => (
                            <span
                              key={sIdx}
                              className="rounded-md bg-surface px-2 py-0.5 text-[0.68rem] font-medium text-foreground-muted border border-border"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>

                        <div className="mt-3 border-t border-border/50 pt-2.5">
                          <button
                            type="button"
                            onClick={() => toggleExpand(item.id)}
                            className="flex items-center gap-1 text-[0.72rem] font-semibold text-secondary hover:underline"
                          >
                            <span>{isExpanded ? "Hide Details" : "Key Topics & Portfolio Project"}</span>
                            {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          </button>

                          {isExpanded && (
                            <div className="mt-2 space-y-2 rounded-lg bg-surface p-3 text-xs border border-border/70">
                              <div>
                                <span className="font-semibold text-foreground text-[0.72rem] uppercase tracking-wider">
                                  Core Concepts:
                                </span>
                                <ul className="mt-1 list-disc pl-4 space-y-0.5 text-foreground-muted text-[0.72rem]">
                                  {item.keyTopics.map((t, tIdx) => (
                                    <li key={tIdx}>{t}</li>
                                  ))}
                                </ul>
                              </div>

                              <div className="pt-1.5 border-t border-border/50">
                                <span className="font-semibold text-secondary text-[0.72rem] uppercase tracking-wider">
                                  Recommended Project:
                                </span>
                                <p className="mt-0.5 text-foreground text-[0.72rem] leading-relaxed">
                                  {item.recommendedProject}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ==========================================================================
   TAB 5: COMBINED CAREER ADVISOR & AI INTERVIEW COACH (UNIFIED CHAT BOX)
   One unified chat box with instant mode switcher inside the header!
   ========================================================================== */
interface UnifiedChatMessage {
  role: "user" | "model";
  text: string;
  mode?: "advisor" | "interview";
  attachments?: { name: string; kind: "doc" | "image" }[];
}

interface ChatAttachment {
  id: string;
  name: string;
  kind: "doc" | "image";
  size: number;
  file: File;
}

function AdvisorInterviewHubTab() {
  const searchParams = useSearchParams();
  const { currentUser, profile } = useAuth();

  const [chatMode, setChatMode] = useState<"advisor" | "interview">(() => {
    const tabParam = searchParams.get("tab");
    return tabParam === "interview" ? "interview" : "advisor";
  });

  // Separate conversation histories for clean isolation
  const [advisorMessages, setAdvisorMessages] = useState<UnifiedChatMessage[]>([]);
  const [interviewMessages, setInterviewMessages] = useState<UnifiedChatMessage[]>([]);

  // Target job description for mock interview
  const [targetJob, setTargetJob] = useState("");
  const [interviewStarted, setInterviewStarted] = useState(false);

  // Input & state
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [fontSize, setFontSize] = useState<"sm" | "base" | "lg">("sm");
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const MAX_ATTACHMENTS = 5;
  const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;

  const currentMessages = chatMode === "interview" ? interviewMessages : advisorMessages;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentMessages, loading]);

  // Initial load of both histories
  useEffect(() => {
    if (!currentUser) return;

    const loadAllHistories = async () => {
      setLoading(true);
      setErrorMessage("");
      try {
        // Load Interview history
        const interviewSnap = await getDoc(doc(db, "interview_history", currentUser.uid));
        if (interviewSnap.exists() && interviewSnap.data().messages?.length > 0) {
          setInterviewMessages(interviewSnap.data().messages || []);
          setInterviewStarted(true);
        } else {
          setInterviewStarted(false);
          setInterviewMessages([
            {
              role: "model",
              mode: "interview",
              text: `### 🎯 Welcome to your AI Technical & Behavioral Interview Coach!\n\nI am connected to your **NEXORA Profile & Document Wallet** (your verified resume, projects, and certifications).\n\n**How this works:**\n1. Paste your target Job Description / Role details above (e.g. *SDE-1 at Amazon, Data Analyst, Research Fellow*).\n2. Click **Start Mock Interview**.\n3. I will ask you **one tailored question at a time**.\n4. When you answer, I will evaluate it with a qualitative **Judgement** (strengths, missing elements, and ideal sample answer), then ask the next question.\n\nReady? Enter your target role and hit start!`,
            },
          ]);
        }

        // Load Advisor history
        const advisorSnap = await getDoc(doc(db, "chat_history", currentUser.uid));
        if (advisorSnap.exists() && advisorSnap.data().messages?.length > 0) {
          setAdvisorMessages(advisorSnap.data().messages || []);
        } else {
          setAdvisorMessages([
            {
              role: "model",
              mode: "advisor",
              text: "Hello! I am your **AI Career Assistant** at NEXORA. How can I help you find target opportunities, optimize your resume, plan learning roadmaps, or prepare for applications today? You can also **drag & drop or paste multiple files** (PDF, DOCX, TXT, or images) and I will analyze them for you.",
            },
          ]);
        }
      } catch (err) {
        console.error("Failed to load chat history:", err);
      } finally {
        setLoading(false);
      }
    };

    loadAllHistories();
  }, [currentUser]);

  const fileKind = (name: string): "doc" | "image" => {
    const ext = name.split(".").pop()?.toLowerCase() || "";
    return ["png", "jpg", "jpeg", "webp", "gif", "bmp"].includes(ext) ? "image" : "doc";
  };

  const attachFiles = (files: Iterable<File>) => {
    setErrorMessage("");
    const incoming = Array.from(files).filter((f) => f.size > 0);
    if (incoming.length === 0) return;
    const combined = [...attachments];
    for (const file of incoming) {
      if (combined.length >= MAX_ATTACHMENTS) {
        setErrorMessage(`You can attach up to ${MAX_ATTACHMENTS} files at a time.`);
        break;
      }
      if (file.size > MAX_ATTACHMENT_BYTES) {
        setErrorMessage(`"${file.name}" is over 8 MB. Please attach a smaller file.`);
        continue;
      }
      combined.push({
        id: `${file.name}-${Date.now()}-${combined.length}`,
        name: file.name,
        kind: fileKind(file.name),
        size: file.size,
        file,
      });
    }
    setAttachments(combined);
  };

  // Clipboard Paste support for files & images
  const handlePaste = (e: React.ClipboardEvent) => {
    if (chatMode === "advisor" && e.clipboardData?.files && e.clipboardData.files.length > 0) {
      e.preventDefault();
      attachFiles(e.clipboardData.files);
    }
  };

  // Drag and Drop support
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (chatMode === "advisor") {
      setIsDraggingOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (chatMode === "advisor" && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      attachFiles(e.dataTransfer.files);
    }
  };

  const copyMessage = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const resetInterview = async () => {
    if (!currentUser) return;
    setInterviewStarted(false);
    const initialMsg: UnifiedChatMessage[] = [
      {
        role: "model",
        mode: "interview",
        text: `### 🎯 Interview Session Reset\n\nEnter your new Target Role or Opportunity details above and click **Start Mock Interview** to begin a fresh round!`,
      },
    ];
    setInterviewMessages(initialMsg);
    try {
      await setDoc(doc(db, "interview_history", currentUser.uid), { messages: initialMsg });
    } catch (e) {
      console.error(e);
    }
  };

  const startInterview = async () => {
    setInterviewStarted(true);
    setLoading(true);
    setErrorMessage("");

    const initialPrompt = targetJob.trim()
      ? `I am ready for the mock interview for this opportunity: "${targetJob.trim()}". Please review my profile and wallet documents, greet me briefly, and ask me QUESTION 1.`
      : `I am ready for the mock interview for roles matching my profile and wallet. Please review my profile, greet me briefly, and ask me QUESTION 1.`;

    const userMessage: UnifiedChatMessage = {
      role: "user",
      mode: "interview",
      text: `[Started Mock Interview: ${targetJob.trim() || "Profile-Matched Role"}]`,
    };
    const newMessages = [...interviewMessages, userMessage];
    setInterviewMessages(newMessages);

    try {
      const chatResponse = await AIServiceClient.chatWithFiles(
        initialPrompt,
        newMessages,
        profile || {},
        [],
        { mode: "interview", targetJobDescription: targetJob.trim() }
      );

      const finalMessages: UnifiedChatMessage[] = [
        ...newMessages,
        { role: "model", mode: "interview", text: chatResponse.reply },
      ];
      setInterviewMessages(finalMessages);

      if (currentUser) {
        await setDoc(doc(db, "interview_history", currentUser.uid), { messages: finalMessages });
      }
    } catch (err) {
      console.error(err);
      setErrorMessage(
        err instanceof AIServiceUnavailableError
          ? err.message
          : "The interview coach is unavailable right now. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && attachments.length === 0) || loading) return;

    const userMsg = input.trim();
    const files = attachments.map((a) => a.file);
    const meta = attachments.map((a) => ({ name: a.name, kind: a.kind }));
    setInput("");
    setAttachments([]);
    setErrorMessage("");

    const userMessage: UnifiedChatMessage = {
      role: "user",
      mode: chatMode,
      text: userMsg,
      ...(meta.length > 0 ? { attachments: meta } : {}),
    };

    if (chatMode === "interview") {
      const newMessages = [...interviewMessages, userMessage];
      setInterviewMessages(newMessages);
      setLoading(true);

      try {
        const chatResponse = await AIServiceClient.chatWithFiles(
          userMsg,
          newMessages,
          profile || {},
          [],
          {
            mode: "interview",
            targetJobDescription: targetJob.trim(),
          }
        );
        const finalMessages: UnifiedChatMessage[] = [
          ...newMessages,
          { role: "model", mode: "interview", text: chatResponse.reply },
        ];
        setInterviewMessages(finalMessages);
        if (currentUser) {
          await setDoc(doc(db, "interview_history", currentUser.uid), { messages: finalMessages });
        }
      } catch (err) {
        console.error(err);
        setErrorMessage(
          err instanceof AIServiceUnavailableError
            ? err.message
            : "The AI assistant is temporarily unavailable. Please try again."
        );
      } finally {
        setLoading(false);
      }
    } else {
      const newMessages = [...advisorMessages, userMessage];
      setAdvisorMessages(newMessages);
      setLoading(true);

      try {
        const chatResponse = await AIServiceClient.chatWithFiles(
          userMsg,
          newMessages,
          profile || {},
          files,
          { mode: "advisor" }
        );
        const finalMessages: UnifiedChatMessage[] = [
          ...newMessages,
          { role: "model", mode: "advisor", text: chatResponse.reply },
        ];
        setAdvisorMessages(finalMessages);
        if (currentUser) {
          await setDoc(doc(db, "chat_history", currentUser.uid), { messages: finalMessages });
        }
      } catch (err) {
        console.error(err);
        setErrorMessage(
          err instanceof AIServiceUnavailableError
            ? err.message
            : "The AI assistant is temporarily unavailable. Please try again."
        );
      } finally {
        setLoading(false);
      }
    }
  };

  const fontSizeClass =
    fontSize === "lg" ? "text-base" : fontSize === "base" ? "text-[0.925rem]" : "text-sm";

  return (
    <div className="flex h-[calc(100dvh-22rem)] min-h-[30rem] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-xs">
      {/* ── Mode Switcher & Status Bar (Integrated Directly on Top of Chat) ── */}
      <div className="flex flex-col gap-3 border-b border-border bg-surface-raised p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-colors duration-base ${
              chatMode === "interview" ? "bg-amber-500/15 text-amber-500" : "bg-secondary/15 text-secondary"
            }`}
          >
            {chatMode === "interview" ? <Mic className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-sm font-bold text-foreground">
                {chatMode === "interview" ? "AI Mock Interview Session" : "AI Career Assistant"}
              </h2>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider ${
                  chatMode === "interview" ? "bg-amber-500/10 text-amber-500" : "bg-secondary/10 text-secondary"
                }`}
              >
                {chatMode === "interview" ? "Evaluation Mode" : "Advisory Mode"}
              </span>
            </div>
            <p className="text-[0.72rem] text-foreground-muted">
              {chatMode === "interview"
                ? "Simulated 1-on-1 interview round with instant qualitative scoring & answers"
                : "Ask anything about opportunities, scholarships, resume improvements & advice"}
            </p>
          </div>
        </div>

        {/* ── Top Controls: Font Size & Interactive Switch Buttons ── */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Font Size Toggle */}
          <div className="flex items-center rounded-lg border border-border bg-surface px-1.5 py-1 text-xs">
            <Type className="mr-1 h-3 w-3 text-foreground-muted" />
            <button
              type="button"
              onClick={() => setFontSize(fontSize === "sm" ? "base" : fontSize === "base" ? "lg" : "sm")}
              className="text-[0.7rem] font-semibold text-foreground-muted hover:text-foreground transition-colors"
              title="Change reading font size"
            >
              {fontSize === "sm" ? "1x" : fontSize === "base" ? "1.2x" : "1.4x"}
            </button>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center gap-1 rounded-xl border border-border bg-surface p-1 shadow-xs">
            <button
              type="button"
              onClick={() => {
                setChatMode("advisor");
                setErrorMessage("");
              }}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-base ${
                chatMode === "advisor"
                  ? "bg-secondary text-white shadow-xs"
                  : "text-foreground-muted hover:text-foreground"
              }`}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Career Assistant</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setChatMode("interview");
                setErrorMessage("");
              }}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-base ${
                chatMode === "interview"
                  ? "bg-amber-500 text-white shadow-xs"
                  : "text-foreground-muted hover:text-foreground"
              }`}
            >
              <Mic className="h-3.5 w-3.5" />
              <span>AI Interview Coach</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Target Role Bar for Interview Mode ── */}
      {chatMode === "interview" && (
        <div className="border-b border-amber-500/30 bg-amber-500/5 p-3">
          <div className="flex flex-col gap-2.5 md:flex-row md:items-center">
            <div className="flex-1">
              <div className="flex items-center gap-1.5 text-[0.7rem] font-semibold uppercase tracking-wider text-amber-500">
                <Briefcase className="h-3.5 w-3.5" /> Target Role / Job Description
              </div>
              <input
                type="text"
                placeholder="e.g. SDE-1 Intern at Google / AI Engineer at OpenAI / Research Fellow..."
                value={targetJob}
                onChange={(e) => setTargetJob(e.target.value)}
                disabled={loading}
                className="input mt-1 w-full text-xs"
              />
            </div>
            <div className="flex items-center gap-2 pt-1 md:pt-3">
              <Button
                size="sm"
                variant={interviewStarted ? "secondary" : "primary"}
                onClick={startInterview}
                disabled={loading}
                leadingIcon={loading ? <Loader2 className="h-3.5 w-3.5 spin" /> : <Mic className="h-3.5 w-3.5" />}
              >
                {interviewStarted ? "Restart Interview" : "Start Mock Interview"}
              </Button>
              {interviewStarted && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={resetInterview}
                  disabled={loading}
                  leadingIcon={<RotateCcw className="h-3.5 w-3.5" />}
                >
                  Reset Round
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Single Unified Chat Box with Drag & Drop & Paste ── */}
      <div
        className={`card-inset relative flex min-h-0 flex-1 flex-col overflow-hidden transition-colors ${
          isDraggingOver ? "border-2 border-dashed border-secondary bg-secondary/5" : ""
        }`}
        onPaste={handlePaste}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Drag Overlay visual cue */}
        {isDraggingOver && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/80 backdrop-blur-xs pointer-events-none">
            <UploadCloud className="h-10 w-10 text-secondary animate-bounce" />
            <p className="mt-2 text-sm font-semibold text-foreground">Drop files here to attach to chat</p>
            <p className="text-xs text-foreground-muted">PDF, DOCX, TXT, images up to 8 MB</p>
          </div>
        )}

        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
          {currentMessages.map((m, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className={`group flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`relative max-w-[85%] rounded-xl px-4 py-3 leading-relaxed ${fontSizeClass} ${
                  m.role === "user"
                    ? "bg-surface-ink text-background"
                    : "border border-border bg-surface text-foreground shadow-xs"
                }`}
              >
                {/* Header indicator and copy button */}
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  {m.mode && (
                    <div className="flex items-center gap-1.5 text-[0.65rem] font-semibold uppercase tracking-wider text-foreground-muted">
                      {m.mode === "interview" ? (
                        <span className="flex items-center gap-1 text-amber-500">
                          <Mic className="h-3 w-3" /> Interview Coach
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-secondary">
                          <Sparkles className="h-3 w-3" /> Career Advisor
                        </span>
                      )}
                    </div>
                  )}

                  {/* Copy button */}
                  {m.text && (
                    <button
                      type="button"
                      onClick={() => copyMessage(m.text, idx)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md text-foreground-muted hover:text-foreground hover:bg-muted text-[0.65rem] flex items-center gap-1"
                      title="Copy response"
                    >
                      {copiedIdx === idx ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-500" />
                          <span className="text-emerald-500 font-medium">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {m.role === "model" && m.text ? (
                  <MarkdownText text={m.text} />
                ) : (
                  <div className="whitespace-pre-wrap">{m.text}</div>
                )}

                {m.attachments && m.attachments.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {m.attachments.map((a, ai) => (
                      <span
                        key={ai}
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[0.7rem] font-medium ${
                          m.role === "user" ? "bg-white/15 text-white" : "bg-muted text-foreground-muted"
                        }`}
                      >
                        <FileText className="h-3 w-3" /> {a.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground-muted shadow-xs">
                <Loader2 className="h-3.5 w-3.5 spin text-secondary" />
                <span>
                  {chatMode === "interview"
                    ? "AI Interview Coach is evaluating your answer and formulating the next question…"
                    : "NEXORA Advisor is analyzing your query and formulating advice…"}
                </span>
              </div>
            </div>
          )}

          {errorMessage && <ErrorState description={errorMessage} className="items-start py-4 text-left" />}
          <div ref={messagesEndRef} />
        </div>

        {/* Attachment chips in Advisor Mode */}
        {chatMode === "advisor" && attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 border-t border-border px-4 pt-3">
            {attachments.map((a) => (
              <span
                key={a.id}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-raised px-2 py-1 text-xs text-foreground"
              >
                <FileText className="h-3 w-3 text-secondary" />
                {a.name}
                <span className="text-foreground-subtle">· {bytesLabel(a.size)}</span>
                <button
                  type="button"
                  onClick={() => setAttachments(attachments.filter((x) => x.id !== a.id))}
                  className="rounded-sm p-0.5 transition-colors hover:bg-surface hover:text-foreground"
                  aria-label={`Remove ${a.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Unified Bottom Input Bar */}
        <form onSubmit={handleSend} className="flex gap-2 border-t border-border p-3 sm:p-4">
          {chatMode === "advisor" && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.txt,.md,.csv,.tsv,.json,.xml,.yaml,.yml,.png,.jpg,.jpeg,.webp"
                className="sr-only"
                disabled={loading}
                onChange={(e) => {
                  if (e.target.files) attachFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Attach files"
                disabled={loading}
                onClick={() => fileInputRef.current?.click()}
                title="Attach resume, portfolio, or documents (PDF, DOCX, Images, drag & drop supported)"
              >
                <Paperclip className="h-4 w-4" />
              </Button>
            </>
          )}

          <input
            type="text"
            aria-label={chatMode === "interview" ? "Submit interview answer" : "Ask career assistant"}
            placeholder={
              chatMode === "interview"
                ? "Type your answer to the interviewer's question..."
                : "Ask about scholarships, resumes, careers (drag & drop or paste files)…"
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            className="input flex-1"
          />

          <Button
            type="submit"
            size="icon"
            aria-label="Send message"
            disabled={loading || (!input.trim() && attachments.length === 0)}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}

