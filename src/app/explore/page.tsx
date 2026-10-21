"use client";

import { useEffect, useState, Suspense, type ReactNode } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { trimSavedOpportunities } from "@/lib/savedOpportunities";
import { useOpportunities, formatDeadline } from "@/hooks/useOpportunities";
import {
  Search,
  Filter,
  Calendar,
  MapPin,
  Bookmark,
  BookmarkCheck,
  ChevronRight,
  Sparkles,
  Compass,
  Loader2,
  ExternalLink,
  Zap,
  RefreshCw,
  X,
  Globe,
  Monitor,
  Building2,
  Banknote,
  Users,
  GraduationCap,
  Trophy,
  Code2,
  Briefcase,
  Award,
  Layers,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { EmptyState, ErrorState } from "@/components/ui/EmptyState";
import { Select } from "@/components/ui/Field";
import { seedOpportunityNotification } from "@/lib/automationEngine";
import { authedFetch } from "@/lib/apiClient";

const CATEGORY_TABS = [
  { key: "Hackathons", label: "Hackathons" },
  { key: "Internships", label: "Internships" },
  { key: "Scholarships", label: "Scholarships" },
  { key: "Conferences", label: "Conferences" },
  { key: "Fellowships", label: "Fellowships" },
  { key: "Research", label: "Research" },
  { key: "Workshops", label: "Workshops" },
  { key: "Exchange Programs", label: "Exchange" },
];

/* ── Standard filter option sets ── */
const MODE_OPTIONS = [
  { value: "", label: "Any mode" },
  { value: "online", label: "Online / Virtual" },
  { value: "offline", label: "In Person / Onsite" },
  { value: "hybrid", label: "Hybrid" },
];
const COST_OPTIONS = [
  { value: "", label: "Any entry" },
  { value: "free", label: "Free Entry" },
  { value: "paid", label: "Paid / Registration Fee" },
];
const HACK_THEME_OPTIONS = [
  { value: "", label: "All Themes" },
  { value: "ai", label: "AI / Machine Learning" },
  { value: "web3", label: "Web3 / Blockchain" },
  { value: "open", label: "Open Ended / General" },
  { value: "social", label: "Social Good / Impact" },
  { value: "mobile", label: "Mobile / IoT" },
];
const HACK_PRIZE_OPTIONS = [
  { value: "", label: "Any Prize" },
  { value: "cash", label: "Cash Prize Pool" },
  { value: "certificates", label: "Certificates / Swag" },
];

const WORK_MODE_OPTIONS = [
  { value: "", label: "Any work mode" },
  { value: "remote", label: "Remote / WFH" },
  { value: "onsite", label: "In Office" },
  { value: "hybrid", label: "Hybrid" },
];
const STIPEND_OPTIONS = [
  { value: "", label: "Any stipend" },
  { value: "paid", label: "Paid Stipend" },
  { value: "unpaid", label: "Unpaid" },
];
const INTERN_DOMAIN_OPTIONS = [
  { value: "", label: "All Domains" },
  { value: "cs", label: "Software & Web Dev" },
  { value: "ai", label: "AI & Data Science" },
  { value: "hr", label: "HR & People Ops" },
  { value: "marketing", label: "Marketing & Content" },
  { value: "design", label: "Design & Media" },
  { value: "business", label: "Business & Management" },
];
const INTERN_DURATION_OPTIONS = [
  { value: "", label: "Any duration" },
  { value: "short", label: "1-2 Months" },
  { value: "medium", label: "3-6 Months" },
  { value: "long", label: "6+ Months" },
];

const WHOM_OPTIONS = [
  { value: "", label: "Anyone" },
  { value: "girls", label: "Girls / Women" },
  { value: "boys", label: "Boys" },
  { value: "all", label: "Open to all" },
];
const FUNDING_OPTIONS = [
  { value: "", label: "Any funding source" },
  { value: "gov", label: "Government" },
  { value: "private", label: "Corporate / Company" },
  { value: "ngo", label: "NGO / Trust" },
  { value: "university", label: "University / Institute" },
];
const SCHOLAR_TYPE_OPTIONS = [
  { value: "", label: "All Types" },
  { value: "merit", label: "Merit-Based" },
  { value: "means", label: "Need / Income-Based" },
  { value: "special", label: "Special Category / Girl Child" },
];
const DEGREE_OPTIONS = [
  { value: "", label: "Any education level" },
  { value: "school", label: "School (Class 9-12)" },
  { value: "bachelor", label: "Undergraduate / B.Tech / B.Sc" },
  { value: "master", label: "Postgraduate / M.Tech / M.Sc" },
  { value: "phd", label: "PhD / Research Scholar" },
];

const FELLOW_LEVEL_OPTIONS = [
  { value: "", label: "All Career Stages" },
  { value: "student", label: "Undergraduate / Graduate" },
  { value: "early_career", label: "Early-Career / Postdoc" },
  { value: "senior", label: "Senior Researcher / Faculty" },
];
const FELLOW_COVERAGE_OPTIONS = [
  { value: "", label: "Any coverage" },
  { value: "fully_funded", label: "Fully Funded / Travel & Stay" },
  { value: "partial", label: "Grant / Stipend Only" },
];

const CONF_TOPIC_OPTIONS = [
  { value: "", label: "All Domains" },
  { value: "tech", label: "Technology & Computing" },
  { value: "science", label: "Science & Engineering" },
  { value: "business", label: "Business & Management" },
  { value: "interdisciplinary", label: "Multidisciplinary / General" },
];
const CONF_CFP_OPTIONS = [
  { value: "", label: "Any status" },
  { value: "open", label: "Call for Papers (CFP) Open" },
  { value: "attend", label: "Attendee Registration" },
];

const RESEARCH_FIELD_OPTIONS = [
  { value: "", label: "All Research Fields" },
  { value: "cs", label: "Computer Science / AI" },
  { value: "bio", label: "Biology / Life Sciences" },
  { value: "physics", label: "Physics / Chemistry" },
  { value: "social", label: "Social Sciences" },
  { value: "general", label: "Multidisciplinary" },
];

const WORKSHOP_FORMAT_OPTIONS = [
  { value: "", label: "Any Format" },
  { value: "online", label: "Online / Webinar" },
  { value: "offline", label: "In-Person / Campus" },
  { value: "hybrid", label: "Hybrid" },
];

const EXCHANGE_REGION_OPTIONS = [
  { value: "", label: "Any Region" },
  { value: "usa", label: "USA / North America" },
  { value: "europe", label: "Europe" },
  { value: "asia", label: "Asia-Pacific" },
  { value: "global", label: "Global / Worldwide" },
];

const EXCHANGE_FUNDED_OPTIONS = [
  { value: "", label: "Any Funding" },
  { value: "fully_funded", label: "Fully Funded" },
  { value: "partial", label: "Partial / Stipend" },
];

/** The rail's field labels are all `Mode` / `Stipend` / `For Whom`-style words, so
    without the leading icon four adjacent <Select>s read as an undifferentiated
    stack. `.eyebrow` is display:block, hence the explicit inline alignment. */
function FilterLabel({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <>
      <Icon className="mr-1 inline-block h-3 w-3 align-[-1px]" />
      {children}
    </>
  );
}

const filterPanelVariants: Variants = {
  hidden: { opacity: 0, x: -16 },
  show: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.35, ease: "easeOut", staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

const filterFieldVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
};

const gridVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.32, ease: "easeOut" } },
  exit: { opacity: 0, scale: 0.97, transition: { duration: 0.15 } },
};

function SkeletonCard() {
  return (
    <Card className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div className="skeleton h-5 w-20 rounded-full" />
        <div className="skeleton h-7 w-7 rounded-full" />
      </div>
      <div className="skeleton h-4 w-4/5" />
      <div className="skeleton h-3 w-2/5" />
      <div className="space-y-2 mt-2">
        <div className="skeleton h-3 w-full" />
        <div className="skeleton h-3 w-full" />
        <div className="skeleton h-3 w-3/5" />
      </div>
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
        <div className="skeleton h-3 w-24" />
        <div className="skeleton h-3 w-16" />
      </div>
    </Card>
  );
}

// ── Inference helpers for dynamic filtering (scrape all → filter client-side) ──

function inferMode(opp: any): "online" | "offline" | "hybrid" | "unknown" {
  const hay = `${opp.country || ""} ${opp.description || ""} ${opp.title || ""} ${opp.field || ""}`.toLowerCase();
  if (hay.includes("hybrid")) return "hybrid";
  if (hay.includes("online") || hay.includes("virtual") || hay.includes("remote") || opp.country === "Global") {
    // if explicitly says offline + online both → hybrid, already handled
    if (hay.includes("offline") || hay.includes("on-site") || hay.includes("onsite")) return "hybrid";
    return "online";
  }
  if (hay.includes("offline") || hay.includes("on-site") || hay.includes("onsite") || hay.includes("in-person") || hay.includes("campus")) return "offline";
  // default: Global = online, India locations = offline hint if not stated
  if (opp.country === "Global") return "online";
  return "unknown";
}

function inferCost(opp: any): "free" | "paid" | "unknown" {
  const hay = `${opp.description || ""} ${opp.title || ""} ${opp.eligibility || ""}`.toLowerCase();
  if (/free entry|no fee|free registration|free to join/i.test(hay)) return "free";
  if (/paid|registration fee|entry fee|₹\s*\d+|\$\s*\d+|fee:/i.test(hay)) return "paid";
  // hackathons are typically free
  if (opp.category === "Hackathons") return "free";
  return "unknown";
}

function inferWorkMode(opp: any): "remote" | "onsite" | "hybrid" | "unknown" {
  const hay = `${opp.country || ""} ${opp.description || ""} ${opp.title || ""}`.toLowerCase();
  if (hay.includes("work from home") || hay.includes("remote") || hay.includes("virtual")) {
    if (hay.includes("hybrid")) return "hybrid";
    return "remote";
  }
  if (hay.includes("hybrid")) return "hybrid";
  if (hay.includes("on-site") || hay.includes("onsite") || hay.includes("office")) return "onsite";
  if (opp.country === "India" && opp.category === "Internships") return "onsite";
  return "unknown";
}

function inferStipend(opp: any): "paid" | "unpaid" | "unknown" {
  const hay = `${opp.description || ""} ${opp.title || ""}`.toLowerCase();
  if (/unpaid|without stipend|no stipend/.test(hay)) return "unpaid";
  if (/stipend|paid|salary|₹\s*\d+/.test(hay)) return "paid";
  return "unknown";
}

function inferGender(opp: any): "girls" | "boys" | "all" {
  const hay = `${opp.title || ""} ${opp.description || ""} ${opp.eligibility || ""} ${opp.orgName || ""}`.toLowerCase();
  if (/girls|women only|female only|for women|for girls|she\s|her\s|women's/.test(hay)) return "girls";
  if (/boys|men only|male only/.test(hay)) return "boys";
  return "all";
}

function inferFunding(opp: any): "gov" | "private" | "ngo" | "university" | "unknown" {
  const hay = `${opp.orgName || ""} ${opp.organization || ""} ${opp.title || ""} ${opp.description || ""} ${opp.sourceUrl || ""}`.toLowerCase();
  if (/government|gov\.in|ministry|national |central gov|state gov|ugc|aicte|dst|daad|nsigse|kgbv|ssy|bbbp|vigyan jyoti|inspire|wise-kiran|serb power/.test(hay)) return "gov";
  if (/university|college|institute|iit|nit|aiims/.test(hay)) return "university";
  if (/ngo|trust|foundation|reliance foundation|azim premji|tata trust/.test(hay)) return "ngo";
  if (/private|corp|inc\.|ltd|company|buddy4study|unstop|internshala|devpost/.test(hay)) return "private";
  return "unknown";
}

function inferHackTheme(opp: any): "ai" | "web3" | "social" | "mobile" | "open" {
  const hay = `${opp.title || ""} ${opp.description || ""} ${opp.field || ""}`.toLowerCase();
  if (/ai|machine learning|deep learning|llm|agent|gpt|neural/i.test(hay)) return "ai";
  if (/web3|blockchain|crypto|solana|ethereum|smart contract/i.test(hay)) return "web3";
  if (/climate|health|education|social good|sustainability|women/i.test(hay)) return "social";
  if (/mobile|android|ios|flutter|iot|hardware/i.test(hay)) return "mobile";
  return "open";
}

function inferHackPrize(opp: any): "cash" | "certificates" {
  const hay = `${opp.title || ""} ${opp.description || ""}`.toLowerCase();
  if (/prize pool|\$|₹|inr|usd|cash prize|eur|chf/i.test(hay)) return "cash";
  return "certificates";
}

function inferInternDomain(opp: any): "cs" | "ai" | "hr" | "marketing" | "design" | "business" | "general" {
  const hay = `${opp.title || ""} ${opp.description || ""} ${opp.field || ""}`.toLowerCase();
  if (/human resources|\bhr\b|talent acquisition|recruitment/i.test(hay)) return "hr";
  if (/marketing|seo|social media|content writing|pr\b|public relations/i.test(hay)) return "marketing";
  if (/design|ui\/ux|graphic|video editing|media/i.test(hay)) return "design";
  if (/ai|machine learning|data science|analytics|deep learning/i.test(hay)) return "ai";
  if (/software|web dev|frontend|backend|full.?stack|developer|engineer|coding|python|java|react/i.test(hay)) return "cs";
  if (/business|operations|sales|finance|analyst|management/i.test(hay)) return "business";
  return "general";
}

function inferInternDuration(opp: any): "short" | "medium" | "long" | "unknown" {
  const hay = `${opp.title || ""} ${opp.description || ""}`.toLowerCase();
  if (/1 month|2 month|4 week|6 week|8 week/i.test(hay)) return "short";
  if (/3 month|4 month|5 month|6 month|semester/i.test(hay)) return "medium";
  if (/6\+ month|1 year|12 month|long term/i.test(hay)) return "long";
  return "unknown";
}

function inferScholarType(opp: any): "merit" | "means" | "special" | "unknown" {
  const hay = `${opp.title || ""} ${opp.description || ""} ${opp.eligibility || ""}`.toLowerCase();
  if (/girl|women|disability|minority|sc\/st|single girl/i.test(hay)) return "special";
  if (/income|means|below|poverty|economically|family income/i.test(hay)) return "means";
  if (/merit|rank|score|cgpa|academic excellence|top/i.test(hay)) return "merit";
  return "unknown";
}

function inferDegreeLevelClient(opp: any): "school" | "bachelor" | "master" | "phd" | "all" {
  const hay = `${opp.eligibility || ""} ${opp.description || ""} ${opp.title || ""}`.toLowerCase();
  if (/ph\.?d|doctorate|postdoctoral|pdf/i.test(hay)) return "phd";
  if (/master|m\.?tech|m\.?sc|mba|mca|postgraduate|pg/i.test(hay)) return "master";
  if (/bachelor|b\.?tech|b\.?e|b\.?sc|undergraduate|ug|college/i.test(hay)) return "bachelor";
  if (/school|class 9|class 10|class 11|class 12|10th|12th|secondary/i.test(hay)) return "school";
  return "all";
}

function inferFellowLevel(opp: any): "student" | "early_career" | "senior" | "all" {
  const hay = `${opp.title || ""} ${opp.eligibility || ""} ${opp.description || ""}`.toLowerCase();
  if (/faculty|senior scientist|principal investigator|pi\b/i.test(hay)) return "senior";
  if (/postdoc|post-doc|early.career|phd graduate|young researcher/i.test(hay)) return "early_career";
  if (/student|undergraduate|graduate|master|phd scholar/i.test(hay)) return "student";
  return "all";
}

function inferFellowCoverage(opp: any): "fully_funded" | "partial" | "unknown" {
  const hay = `${opp.title || ""} ${opp.description || ""}`.toLowerCase();
  if (/fully funded|travel allowance|airfare|accommodation|stipend.*travel/i.test(hay)) return "fully_funded";
  if (/grant|stipend|fellowship amount|chf|usd|\$/i.test(hay)) return "partial";
  return "unknown";
}

function inferConfTopic(opp: any): "tech" | "science" | "business" | "interdisciplinary" {
  const hay = `${opp.title || ""} ${opp.description || ""} ${opp.field || ""}`.toLowerCase();
  if (/ai|computing|software|robotics|data|cyber|iot|tech/i.test(hay)) return "tech";
  if (/science|physics|chemistry|bio|engineering|agri/i.test(hay)) return "science";
  if (/business|management|economics|finance|leadership/i.test(hay)) return "business";
  return "interdisciplinary";
}

function inferConfCfp(opp: any): "open" | "attend" {
  const hay = `${opp.title || ""} ${opp.description || ""}`.toLowerCase();
  if (/call for papers|cfp|abstract submission|paper submission|submit paper/i.test(hay)) return "open";
  return "attend";
}

function inferResearchField(opp: any): "cs" | "bio" | "physics" | "social" | "general" {
  const hay = `${opp.title || ""} ${opp.description || ""} ${opp.field || ""}`.toLowerCase();
  if (/computer science|software|ai|machine learning|data/i.test(hay)) return "cs";
  if (/biology|biotech|life science|medical|clinical/i.test(hay)) return "bio";
  if (/physics|chemistry|material|quantum/i.test(hay)) return "physics";
  if (/social science|economics|humanities|psychology|political/i.test(hay)) return "social";
  return "general";
}

function inferWorkshopFormat(opp: any): "online" | "offline" | "hybrid" | "unknown" {
  const hay = `${opp.title || ""} ${opp.description || ""} ${opp.country || ""}`.toLowerCase();
  if (hay.includes("hybrid")) return "hybrid";
  if (hay.includes("online") || hay.includes("virtual") || hay.includes("webinar")) return "online";
  if (hay.includes("offline") || hay.includes("in-person") || hay.includes("campus")) return "offline";
  return "unknown";
}

function inferExchangeRegion(opp: any): "asia" | "europe" | "usa" | "global" | "india" {
  const hay = `${opp.title || ""} ${opp.description || ""} ${opp.country || ""}`.toLowerCase();
  if (/usa|united states|america|us\b/i.test(hay)) return "usa";
  if (/europe|germany|france|uk|italy|netherlands|sweden|finland|norway|spain/i.test(hay)) return "europe";
  if (/asia|japan|korea|china|singapore|thailand|malaysia/i.test(hay)) return "asia";
  if (/india/i.test(hay)) return "india";
  return "global";
}

function toSnapshot(opp: any) {
  return {
    id: opp.id,
    title: opp.title,
    organization: opp.organization || opp.orgName,
    orgName: opp.orgName || opp.organization,
    description: opp.description,
    eligibility: opp.eligibility,
    deadline: opp.deadline,
    country: opp.country,
    category: opp.category,
    field: opp.field,
    applyLink: opp.applyLink,
    sourceUrl: opp.sourceUrl,
    requiredDocuments: opp.requiredDocuments || [],
    _source: opp._source || opp.scraperName || "",
  };
}

function ExploreContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { currentUser } = useAuth();
  const { opportunities, loading: oppsLoading } = useOpportunities();

  // Search & global filters
  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");
  const [searchFocused, setSearchFocused] = useState(false);
  const initialCategoryParam = searchParams.get("category");
  const [selectedCategory, setSelectedCategory] = useState(
    initialCategoryParam && CATEGORY_TABS.some((t) => t.key.toLowerCase() === initialCategoryParam.toLowerCase())
      ? (CATEGORY_TABS.find((t) => t.key.toLowerCase() === initialCategoryParam.toLowerCase())?.key || "Hackathons")
      : "Hackathons"
  );
  const [selectedField, setSelectedField] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("");
  const [selectedDegree, setSelectedDegree] = useState("");
  const [savedIds, setSavedIds] = useState<string[]>([]);

  useEffect(() => {
    const cat = searchParams.get("category");
    if (cat) {
      const match = CATEGORY_TABS.find((t) => t.key.toLowerCase() === cat.toLowerCase());
      if (match) setSelectedCategory(match.key);
    }
  }, [searchParams]);

  // ── Category-wise dynamic filter state ──
  // Hackathons
  const [hackMode, setHackMode] = useState(""); // online | offline | hybrid
  const [hackCost, setHackCost] = useState(""); // free | paid
  const [hackTheme, setHackTheme] = useState(""); // ai | web3 | social | mobile | open
  const [hackPrize, setHackPrize] = useState(""); // cash | certificates

  // Internships
  const [internWorkMode, setInternWorkMode] = useState(""); // remote | onsite | hybrid
  const [internStipend, setInternStipend] = useState(""); // paid | unpaid
  const [internDomain, setInternDomain] = useState(""); // cs | ai | hr | marketing | design | business
  const [internDuration, setInternDuration] = useState(""); // short | medium | long

  // Scholarships
  const [scholarGender, setScholarGender] = useState(""); // girls | boys | all
  const [scholarFunding, setScholarFunding] = useState(""); // gov | private | ngo | university
  const [scholarType, setScholarType] = useState(""); // merit | means | special
  const [scholarDegree, setScholarDegree] = useState(""); // school | bachelor | master | phd

  // Fellowships
  const [fellowFunding, setFellowFunding] = useState("");
  const [fellowGender, setFellowGender] = useState("");
  const [fellowLevel, setFellowLevel] = useState(""); // student | early_career | senior
  const [fellowCoverage, setFellowCoverage] = useState(""); // fully_funded | partial

  // Conferences
  const [confMode, setConfMode] = useState(""); // online | offline | hybrid
  const [confTopic, setConfTopic] = useState(""); // tech | science | business | interdisciplinary
  const [confCfp, setConfCfp] = useState(""); // open | attend

  // Research
  const [researchField, setResearchField] = useState("");
  const [researchDegree, setResearchDegree] = useState("");
  // Workshops
  const [workshopFormat, setWorkshopFormat] = useState("");
  // Exchange Programs
  const [exchangeRegion, setExchangeRegion] = useState("");
  const [exchangeFunded, setExchangeFunded] = useState("");

  // Live scrape
  const [liveOpps, setLiveOpps] = useState<any[]>([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveEnabled, setLiveEnabled] = useState(false);
  const [liveError, setLiveError] = useState("");

  // Summarize popup modal
  const [selectedOpp, setSelectedOpp] = useState<any | null>(null);
  const [summaryText, setSummaryText] = useState("");
  const [summarizing, setSummarizing] = useState(false);
  const [summaryError, setSummaryError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const fetchLive = async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) { setLiveLoading(true); setLiveError(""); }
    try {
      const res = await fetch("/api/scrape?preview=1");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch live data");
      const mapped = (data.opportunities || []).map((o: any) => ({
        id: o.id || `opp-${(o.title || "item").slice(0, 30).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        title: o.title,
        organization: o.orgName || o.organization,
        orgName: o.orgName || o.organization,
        description: o.description,
        eligibility: o.eligibility,
        deadline: o.deadline,
        country: o.country,
        category: o.category,
        field: o.field,
        applyLink: o.applyLink,
        requiredDocuments: o.requiredDocuments || [],
        sourceUrl: o.sourceUrl,
        _live: true,
        _source: o.scraperName || o.sourceUrl,
      }));
      setLiveOpps(mapped);
      if (mapped.length > 0) setLiveEnabled(true);
      if (data.mode) console.log(`[explore] scrape mode=${data.mode} cached=${data.cached} count=${data.count}`);
    } catch (e: any) {
      if (!opts?.silent) setLiveError(e.message);
      else console.warn("[explore] silent fetch failed", e.message);
    } finally {
      if (!opts?.silent) setLiveLoading(false);
    }
  };

  // ── Auto-load cached data on first mount (no re-scrape, instant)
  // Opportunities live in Firestore "org_opportunities"; AI summaries are
  // cached in Firestore "summary_cache" (src/lib/storage/summariesStore.ts) —
  // the old storage/scraped-opportunities.json file store is gone.
  // This call hits /api/scrape?preview=1 which serves cached if <2 days old.
  useEffect(() => {
    fetchLive({ silent: true });
  }, []);

  const openSummarize = async (opp: any) => {
    const targetUrl = opp.sourceUrl || opp.applyLink;
    if (!currentUser) {
      // The endpoint now requires a verified token; do not spend a round trip
      // on a guaranteed 401.
      setSelectedOpp(opp);
      setModalOpen(true);
      setSummarizing(false);
      setSummaryText("");
      setSummaryError("Sign in to get an AI summary of this opportunity.");
      return;
    }
    // Guard: no URL means the API will immediately reject with an SSRF error
    // that is confusing to users. Surface a clear message instead.
    if (!targetUrl) {
      setSelectedOpp(opp);
      setModalOpen(true);
      setSummarizing(false);
      setSummaryText("");
      setSummaryError("No source URL found for this opportunity. Visit the official page directly.");
      return;
    }
    setSelectedOpp(opp);
    setModalOpen(true);
    setSummarizing(true);
    setSummaryError("");
    setSummaryText("");
    try {
      const res = await authedFetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: targetUrl,
          title: opp.title,
          orgName: opp.organization || opp.orgName,
          category: opp.category,
          deadline: opp.deadline,
          country: opp.country,
          field: opp.field,
          eligibility: opp.eligibility,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        // 429 = rate limit, 401 = session expired — give friendly messages
        if (res.status === 429) throw new Error("Too many requests. Please wait a moment and try again.");
        if (res.status === 401) throw new Error("Session expired. Please refresh the page and sign in again.");
        throw new Error(data.error || "Summarize failed");
      }
      if (typeof data.summary !== "string" || !data.summary.trim()) {
        throw new Error("The AI did not return a summary for this opportunity.");
      }
      setSummaryText(data.summary);
    } catch (e: any) {
      setSummaryError(e.message || "Could not summarize this opportunity.");
    } finally {
      setSummarizing(false);
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedOpp(null);
    setSummaryText("");
    setSummaryError("");
    setSummarizing(false);
  };

  // Bookmarks
  useEffect(() => {
    if (!currentUser) return;
    const fetchBookmarks = async () => {
      const snap = await getDoc(doc(db, "bookmarks", currentUser.uid));
      if (snap.exists()) setSavedIds(snap.data().opportunityIds || []);
    };
    fetchBookmarks();
  }, [currentUser]);

  const toggleBookmark = async (oppId: string, opp?: any) => {
    if (!currentUser) {
      router.push("/auth/login");
      return;
    }
    const docRef = doc(db, "bookmarks", currentUser.uid);
    const isBookmarked = savedIds.includes(oppId);
    try {
      const snap = await getDoc(docRef);
      const existing = snap.exists() ? snap.data() : { opportunityIds: [], items: [] };
      const ids: string[] = Array.isArray(existing.opportunityIds) ? existing.opportunityIds : [];
      const items: any[] = existing.items && Array.isArray(existing.items) ? existing.items : [];
      let nextIds: string[];
      let nextItems: any[];
      if (isBookmarked) {
        nextIds = ids.filter((i) => i !== oppId);
        nextItems = items.filter((it: any) => it?.id !== oppId);
      } else {
        const resolved = opp || mergedOpportunities.find((o: any) => o.id === oppId);
        nextIds = [...ids, oppId];
        nextItems = [
          ...items.filter((it: any) => it?.id !== oppId),
          ...(resolved ? [toSnapshot(resolved)] : []),
        ];
        // Fire save + deadline notifications for this newly bookmarked opportunity
        if (resolved?.deadline && resolved?.title) {
          seedOpportunityNotification(
            currentUser.uid,
            oppId,
            resolved.title,
            resolved.deadline
          ).catch((e) => console.warn("Notification seed failed:", e));
        }
      }
      // Keep the saved section within its limit: drop the oldest entries.
      const trimmed = trimSavedOpportunities(nextIds, nextItems);
      await setDoc(docRef, { opportunityIds: trimmed.opportunityIds, items: trimmed.items });
      setSavedIds(trimmed.opportunityIds);
    } catch (error) {
      console.error("Bookmarking error:", error);
    }
  };

  // Merge Firestore + live (dedup by title)
  const mergedOpportunities = (() => {
    if (!liveEnabled || liveOpps.length === 0) return opportunities as any[];
    const seen = new Set(opportunities.map((o) => o.title.toLowerCase().trim()));
    const filteredLive = liveOpps.filter((o: any) => !seen.has(o.title.toLowerCase().trim()));
    return [...(opportunities as any[]), ...filteredLive];
  })();

  // Active filter count for badge
  const activeFilterCount = [
    selectedField, selectedCountry, selectedDegree,
    hackMode, hackCost, hackTheme, hackPrize,
    internWorkMode, internStipend, internDomain, internDuration,
    scholarGender, scholarFunding, scholarType, scholarDegree,
    fellowGender, fellowFunding, fellowLevel, fellowCoverage,
    confMode, confTopic, confCfp,
    researchField, researchDegree,
    workshopFormat,
    exchangeRegion, exchangeFunded,
  ].filter(Boolean).length + (searchQuery.trim() ? 1 : 0);

  const resetAll = () => {
    setSearchQuery("");
    setSelectedField(""); setSelectedCountry(""); setSelectedDegree("");
    setHackMode(""); setHackCost(""); setHackTheme(""); setHackPrize("");
    setInternWorkMode(""); setInternStipend(""); setInternDomain(""); setInternDuration("");
    setScholarGender(""); setScholarFunding(""); setScholarType(""); setScholarDegree("");
    setFellowGender(""); setFellowFunding(""); setFellowLevel(""); setFellowCoverage("");
    setConfMode(""); setConfTopic(""); setConfCfp("");
    setResearchField(""); setResearchDegree("");
    setWorkshopFormat("");
    setExchangeRegion(""); setExchangeFunded("");
  };

  // Filter logic — NO pre-filtering at scrape time; all filtering is client-side here
  const filteredOpportunities = mergedOpportunities.filter((opp: any) => {
    // Search (title/org/desc/field/category)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const hay = `${opp.title} ${opp.organization || opp.orgName || ""} ${opp.description} ${opp.category} ${opp.field} ${opp.country}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (selectedCategory && opp.category !== selectedCategory) return false;
    if (selectedField && opp.field?.toLowerCase() !== selectedField.toLowerCase()) return false;
    if (selectedCountry && opp.country?.toLowerCase() !== selectedCountry.toLowerCase()) return false;
    if (selectedDegree && (opp as any).degreeLevel && (opp as any).degreeLevel !== selectedDegree) return false;

    // Category-wise extra filters (only apply when that category is either selected or the opp belongs to it)
    if (opp.category === "Hackathons" || selectedCategory === "Hackathons") {
      if (hackMode) {
        const m = inferMode(opp);
        if (m !== "unknown" && m !== hackMode) return false;
      }
      if (hackCost) {
        const c = inferCost(opp);
        if (c !== "unknown" && c !== hackCost) return false;
      }
      if (hackTheme) {
        const t = inferHackTheme(opp);
        if (t !== hackTheme) return false;
      }
      if (hackPrize) {
        const p = inferHackPrize(opp);
        if (p !== hackPrize) return false;
      }
    }
    if (opp.category === "Internships") {
      if (internWorkMode) {
        const wm = inferWorkMode(opp);
        if (wm !== "unknown" && wm !== internWorkMode) return false;
      }
      if (internStipend) {
        const st = inferStipend(opp);
        if (st !== "unknown" && st !== internStipend) return false;
      }
      if (internDomain) {
        const dom = inferInternDomain(opp);
        if (dom !== internDomain) return false;
      }
      if (internDuration) {
        const dur = inferInternDuration(opp);
        if (dur !== "unknown" && dur !== internDuration) return false;
      }
    }
    if (opp.category === "Scholarships") {
      if (scholarGender && scholarGender !== "all") {
        const g = inferGender(opp);
        if (g !== "all" && g !== scholarGender) return false;
        if (scholarGender === "girls" && g === "boys") return false;
        if (scholarGender === "boys" && g === "girls") return false;
      }
      if (scholarFunding) {
        const f = inferFunding(opp);
        if (f !== "unknown" && f !== scholarFunding) return false;
      }
      if (scholarType) {
        const t = inferScholarType(opp);
        if (t !== "unknown" && t !== scholarType) return false;
      }
      if (scholarDegree) {
        const d = inferDegreeLevelClient(opp);
        if (d !== "all" && d !== scholarDegree) return false;
      }
    }
    if (opp.category === "Fellowships") {
      if (fellowGender && fellowGender !== "all") {
        const g = inferGender(opp);
        if (g !== "all" && g !== fellowGender) return false;
        if (fellowGender === "girls" && g === "boys") return false;
        if (fellowGender === "boys" && g === "girls") return false;
      }
      if (fellowFunding) {
        const f = inferFunding(opp);
        if (f !== "unknown" && f !== fellowFunding) return false;
      }
      if (fellowLevel) {
        const lvl = inferFellowLevel(opp);
        if (lvl !== "all" && lvl !== fellowLevel) return false;
      }
      if (fellowCoverage) {
        const cov = inferFellowCoverage(opp);
        if (cov !== "unknown" && cov !== fellowCoverage) return false;
      }
    }
    if (opp.category === "Conferences") {
      if (confMode) {
        const m = inferMode(opp);
        if (m !== "unknown" && m !== confMode) return false;
      }
      if (confTopic) {
        const top = inferConfTopic(opp);
        if (top !== confTopic) return false;
      }
      if (confCfp) {
        const cfp = inferConfCfp(opp);
        if (cfp !== confCfp) return false;
      }
    }
    if (opp.category === "Research") {
      if (researchField) {
        const rf = inferResearchField(opp);
        if (rf !== researchField) return false;
      }
      if (researchDegree) {
        const d = inferDegreeLevelClient(opp);
        if (d !== "all" && d !== researchDegree) return false;
      }
    }
    if (opp.category === "Workshops") {
      if (workshopFormat) {
        const wf = inferWorkshopFormat(opp);
        if (wf !== "unknown" && wf !== workshopFormat) return false;
      }
    }
    if (opp.category === "Exchange Programs") {
      if (exchangeRegion) {
        const er = inferExchangeRegion(opp);
        if (er !== exchangeRegion) return false;
      }
      if (exchangeFunded) {
        const ef = inferFellowCoverage(opp);
        if (ef !== "unknown" && ef !== exchangeFunded) return false;
      }
    }
    return true;
  });

  // Dynamic placeholder for search bar based on category
  const searchPlaceholder =
    selectedCategory === "Hackathons" ? "Search hackathons — e.g. Smart India Hackathon, prize, online..." :
    selectedCategory === "Internships" ? "Search internships — e.g. Google, remote, stipend..." :
    selectedCategory === "Scholarships" ? "Search scholarships — e.g. for girls, government, merit..." :
    selectedCategory === "Fellowships" ? "Search fellowships — e.g. research, DAAD, women..." :
    selectedCategory === "Conferences" ? "Search conferences — e.g. IEEE, CFP, virtual..." :
    selectedCategory === "Research" ? "Search research — e.g. AI lab, funded PhD, biology..." :
    selectedCategory === "Workshops" ? "Search workshops — e.g. online bootcamp, skill session..." :
    selectedCategory === "Exchange Programs" ? "Search exchange programs — e.g. Europe, Erasmus, fully funded..." :
    "Search by keywords — e.g. Google, Fellowship, Science, hackathon, remote...";


  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Title row */}
      <div className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="eyebrow text-primary">
              <Sparkles className="mr-1 inline-block h-3.5 w-3.5 align-[-1px]" /> Explore
            </span>
            <h1 className="mt-1 font-display text-display-sm text-foreground">Find Opportunities</h1>
            <p className="mt-1 text-sm text-foreground-muted text-pretty">
              Hackathons, internships, scholarships and more — all in one place.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => fetchLive()}
              disabled={liveLoading}
              leadingIcon={
                liveLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )
              }
            >
              {liveLoading ? "Refreshing…" : "Refresh"}
            </Button>
            {liveOpps.length > 0 && (
              <Button
                type="button"
                variant={liveEnabled ? "primary" : "secondary"}
                aria-pressed={liveEnabled}
                onClick={() => setLiveEnabled((v) => !v)}
                leadingIcon={<Zap className="h-3.5 w-3.5" />}
              >
                Live: {liveEnabled ? "ON" : "OFF"} ({liveOpps.length})
              </Button>
            )}
          </div>
        </div>
        {liveError && (
          <p role="alert" className="mt-2 text-xs text-danger">
            {liveError}
          </p>
        )}
      </div>

      {/* ── Prominent global search bar ── */}
      {/* The focus ring moved from an animated box-shadow to `ring-primary`. The
          old shadow interpolated from `var(--accent-glow)`, a token that does not
          exist in globals.css, so the whole declaration was dropped as invalid
          and the bar never actually glowed. Search itself is already live via
          onChange, so the button just commits/blurs instead of doing nothing. */}
      <motion.form
        onSubmit={(e) => {
          e.preventDefault();
          setSearchFocused(false);
        }}
        animate={{ scale: searchFocused ? 1.01 : 1, borderColor: searchFocused ? "var(--primary)" : "var(--border)" }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className={`card mb-6 flex p-2 ${searchFocused ? "ring-2 ring-primary/35" : ""}`}
      >
        <div className="flex grow items-center gap-2 pl-3">
          <motion.span
            animate={{
              scale: searchFocused ? 1.15 : 1,
              color: searchFocused ? "var(--primary)" : "var(--foreground-muted)",
            }}
            transition={{ duration: 0.2 }}
            className="flex shrink-0"
          >
            <Search className="h-5 w-5" />
          </motion.span>
          <input
            type="search"
            aria-label="Search opportunities"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            className="w-full bg-transparent text-sm text-foreground outline-none placeholder-foreground-muted"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              aria-label="Clear search"
              className="mr-1 grid h-7 w-7 place-items-center rounded-md text-foreground-muted hover:bg-surface-raised hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button type="submit" size="sm" className="ml-2 hidden sm:inline-flex" leadingIcon={<Search className="h-3.5 w-3.5" />}>
          Search
        </Button>
      </motion.form>

      {/* ── Category buttons (horizontal, below search bar) ── */}
      <div className="mb-6 flex flex-wrap gap-2">
        {CATEGORY_TABS.map((c) => {
          const isActive = selectedCategory === c.key;
          return (
            <button
              key={c.key}
              type="button"
              aria-pressed={isActive}
              onClick={() => setSelectedCategory(c.key)}
              className={`btn btn-sm rounded-full ${isActive ? "btn-primary" : "btn-secondary"}`}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 min-h-[calc(100vh-7rem)]">
        {/* ── Left: Self-adjustable filter panel (changes per category) ── */}
        <motion.div
          initial="hidden"
          animate="show"
          variants={filterPanelVariants}
          className="lg:col-span-1 lg:sticky lg:top-20 h-full max-h-[calc(100vh-7rem)]"
        >
        <Card className="h-full max-h-[inherit] space-y-5 overflow-y-auto p-6">
          <motion.div variants={filterFieldVariants} className="mb-6 flex items-center justify-between border-b border-border pb-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Filter className="h-4 w-4 text-primary" /> Filters
            </h2>
            {activeFilterCount > 0 && <Chip tone="gold">{activeFilterCount}</Chip>}
          </motion.div>

          {/* ── Hackathon filters ── */}
          {selectedCategory === "Hackathons" && (
              <>
                <motion.div variants={filterFieldVariants}>
                  <Select
                    label={<FilterLabel icon={Monitor}>Mode</FilterLabel>}
                    value={hackMode}
                    onChange={(e) => setHackMode(e.target.value)}
                    options={MODE_OPTIONS}
                  />
                </motion.div>
                <motion.div variants={filterFieldVariants}>
                  <Select
                    label={<FilterLabel icon={Code2}>Theme / Tech</FilterLabel>}
                    value={hackTheme}
                    onChange={(e) => setHackTheme(e.target.value)}
                    options={HACK_THEME_OPTIONS}
                  />
                </motion.div>
                <motion.div variants={filterFieldVariants}>
                  <Select
                    label={<FilterLabel icon={Trophy}>Prize Pool</FilterLabel>}
                    value={hackPrize}
                    onChange={(e) => setHackPrize(e.target.value)}
                    options={HACK_PRIZE_OPTIONS}
                  />
                </motion.div>
                <motion.div variants={filterFieldVariants}>
                  <Select
                    label={<FilterLabel icon={Banknote}>Entry Fee</FilterLabel>}
                    value={hackCost}
                    onChange={(e) => setHackCost(e.target.value)}
                    options={COST_OPTIONS}
                  />
                </motion.div>
              </>
            )}

            {/* ── Internship filters ── */}
            {selectedCategory === "Internships" && (
              <>
                <motion.div variants={filterFieldVariants}>
                  <Select
                    label={<FilterLabel icon={Briefcase}>Domain / Field</FilterLabel>}
                    value={internDomain}
                    onChange={(e) => setInternDomain(e.target.value)}
                    options={INTERN_DOMAIN_OPTIONS}
                  />
                </motion.div>
                <motion.div variants={filterFieldVariants}>
                  <Select
                    label={<FilterLabel icon={Building2}>Work Mode</FilterLabel>}
                    value={internWorkMode}
                    onChange={(e) => setInternWorkMode(e.target.value)}
                    options={WORK_MODE_OPTIONS}
                  />
                </motion.div>
                <motion.div variants={filterFieldVariants}>
                  <Select
                    label={<FilterLabel icon={Banknote}>Stipend</FilterLabel>}
                    value={internStipend}
                    onChange={(e) => setInternStipend(e.target.value)}
                    options={STIPEND_OPTIONS}
                  />
                </motion.div>
                <motion.div variants={filterFieldVariants}>
                  <Select
                    label={<FilterLabel icon={Calendar}>Duration</FilterLabel>}
                    value={internDuration}
                    onChange={(e) => setInternDuration(e.target.value)}
                    options={INTERN_DURATION_OPTIONS}
                  />
                </motion.div>
              </>
            )}

            {/* ── Scholarship filters ── */}
            {selectedCategory === "Scholarships" && (
              <>
                <motion.div variants={filterFieldVariants}>
                  <Select
                    label={<FilterLabel icon={Award}>Scholarship Type</FilterLabel>}
                    value={scholarType}
                    onChange={(e) => setScholarType(e.target.value)}
                    options={SCHOLAR_TYPE_OPTIONS}
                  />
                </motion.div>
                <motion.div variants={filterFieldVariants}>
                  <Select
                    label={<FilterLabel icon={GraduationCap}>Education Level</FilterLabel>}
                    value={scholarDegree}
                    onChange={(e) => setScholarDegree(e.target.value)}
                    options={DEGREE_OPTIONS}
                  />
                </motion.div>
                <motion.div variants={filterFieldVariants}>
                  <Select
                    label={<FilterLabel icon={Users}>Target Group</FilterLabel>}
                    value={scholarGender}
                    onChange={(e) => setScholarGender(e.target.value)}
                    options={WHOM_OPTIONS}
                  />
                </motion.div>
                <motion.div variants={filterFieldVariants}>
                  <Select
                    label={<FilterLabel icon={Building2}>Funding Provider</FilterLabel>}
                    value={scholarFunding}
                    onChange={(e) => setScholarFunding(e.target.value)}
                    options={FUNDING_OPTIONS}
                  />
                </motion.div>
              </>
            )}

            {/* ── Fellowship filters ── */}
            {selectedCategory === "Fellowships" && (
              <>
                <motion.div variants={filterFieldVariants}>
                  <Select
                    label={<FilterLabel icon={GraduationCap}>Career Stage</FilterLabel>}
                    value={fellowLevel}
                    onChange={(e) => setFellowLevel(e.target.value)}
                    options={FELLOW_LEVEL_OPTIONS}
                  />
                </motion.div>
                <motion.div variants={filterFieldVariants}>
                  <Select
                    label={<FilterLabel icon={Award}>Funding Coverage</FilterLabel>}
                    value={fellowCoverage}
                    onChange={(e) => setFellowCoverage(e.target.value)}
                    options={FELLOW_COVERAGE_OPTIONS}
                  />
                </motion.div>
                <motion.div variants={filterFieldVariants}>
                  <Select
                    label={<FilterLabel icon={Users}>Eligibility</FilterLabel>}
                    value={fellowGender}
                    onChange={(e) => setFellowGender(e.target.value)}
                    options={WHOM_OPTIONS}
                  />
                </motion.div>
                <motion.div variants={filterFieldVariants}>
                  <Select
                    label={<FilterLabel icon={Building2}>Institution / Sponsor</FilterLabel>}
                    value={fellowFunding}
                    onChange={(e) => setFellowFunding(e.target.value)}
                    options={FUNDING_OPTIONS}
                  />
                </motion.div>
              </>
            )}

            {/* ── Conference filters ── */}
            {selectedCategory === "Conferences" && (
              <>
                <motion.div variants={filterFieldVariants}>
                  <Select
                    label={<FilterLabel icon={Globe}>Mode</FilterLabel>}
                    value={confMode}
                    onChange={(e) => setConfMode(e.target.value)}
                    options={MODE_OPTIONS}
                  />
                </motion.div>
                <motion.div variants={filterFieldVariants}>
                  <Select
                    label={<FilterLabel icon={Layers}>Discipline / Topic</FilterLabel>}
                    value={confTopic}
                    onChange={(e) => setConfTopic(e.target.value)}
                    options={CONF_TOPIC_OPTIONS}
                  />
                </motion.div>
                <motion.div variants={filterFieldVariants}>
                  <Select
                    label={<FilterLabel icon={Award}>Participation</FilterLabel>}
                    value={confCfp}
                    onChange={(e) => setConfCfp(e.target.value)}
                    options={CONF_CFP_OPTIONS}
                  />
                </motion.div>
              </>
            )}

            {/* ── Research filters ── */}
            {selectedCategory === "Research" && (
              <>
                <motion.div variants={filterFieldVariants}>
                  <Select
                    label={<FilterLabel icon={Code2}>Research Field</FilterLabel>}
                    value={researchField}
                    onChange={(e) => setResearchField(e.target.value)}
                    options={RESEARCH_FIELD_OPTIONS}
                  />
                </motion.div>
                <motion.div variants={filterFieldVariants}>
                  <Select
                    label={<FilterLabel icon={GraduationCap}>Education Level</FilterLabel>}
                    value={researchDegree}
                    onChange={(e) => setResearchDegree(e.target.value)}
                    options={DEGREE_OPTIONS}
                  />
                </motion.div>
              </>
            )}

            {/* ── Workshop filters ── */}
            {selectedCategory === "Workshops" && (
              <>
                <motion.div variants={filterFieldVariants}>
                  <Select
                    label={<FilterLabel icon={Monitor}>Format</FilterLabel>}
                    value={workshopFormat}
                    onChange={(e) => setWorkshopFormat(e.target.value)}
                    options={WORKSHOP_FORMAT_OPTIONS}
                  />
                </motion.div>
              </>
            )}

            {/* ── Exchange Programs filters ── */}
            {selectedCategory === "Exchange Programs" && (
              <>
                <motion.div variants={filterFieldVariants}>
                  <Select
                    label={<FilterLabel icon={Globe}>Region</FilterLabel>}
                    value={exchangeRegion}
                    onChange={(e) => setExchangeRegion(e.target.value)}
                    options={EXCHANGE_REGION_OPTIONS}
                  />
                </motion.div>
                <motion.div variants={filterFieldVariants}>
                  <Select
                    label={<FilterLabel icon={Banknote}>Funding</FilterLabel>}
                    value={exchangeFunded}
                    onChange={(e) => setExchangeFunded(e.target.value)}
                    options={EXCHANGE_FUNDED_OPTIONS}
                  />
                </motion.div>
              </>
            )}

            <motion.div variants={filterFieldVariants}>
              <Button type="button" variant="secondary" block onClick={resetAll}>
                Clear filters
              </Button>
            </motion.div>
          </Card>
        </motion.div>

        {/* Right Grid */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-foreground-muted">
            <span>
              {oppsLoading ? "Loading opportunities…" : `Showing ${filteredOpportunities.length} opportunities${liveEnabled && liveOpps.length > 0 ? ` (incl. ${liveOpps.length} live)` : ""}`}
              {!oppsLoading && filteredOpportunities.length > 0 && activeFilterCount > 0 && ` · ${activeFilterCount} filter${activeFilterCount > 1 ? "s" : ""} active`}
            </span>
            {!oppsLoading && liveEnabled && liveOpps.length > 0 && (
              <Chip
                tone="success"
                icon={
                  <motion.span
                    animate={{ opacity: [1, 0.35, 1] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                    className="block h-1.5 w-1.5 rounded-full bg-success"
                  />
                }
              >
                Live: Devpost • Unstop • Internshala • Conf • Fellow
              </Chip>
            )}
          </div>

          {oppsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Array.from({ length: 4 }).map((_, i) => (<SkeletonCard key={i} />))}
            </div>
          ) : (
            <motion.div initial="hidden" animate="show" variants={gridVariants} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <AnimatePresence>
                {filteredOpportunities.map((opp: any) => {
                  const isSaved = savedIds.includes(opp.id);
                  const isLive = !!opp._live;
                  const applyLink: string = opp.applyLink || "";
                  const hrefId = isLive ? undefined : `/opportunity/${opp.id}`;
return (
                    <motion.div
                      key={opp.id}
                      layout
                      variants={cardVariants}
                      initial="hidden"
                      animate="show"
                      exit="exit"
                      className="flex"
                    >
                    {/* The whole card opens the AI summary, so `interactive` is honest
                        here. Its old `card-hover` class does not exist in globals.css
                        and its `dark:hover:shadow-[…rgba(255,60,110,…)]` was a hardcoded
                        crimson glow that ignored the theme and only appeared in dark. */}
                    <Card
                      interactive
                      onClick={() => openSummarize(opp)}
                      className={`flex w-full flex-col justify-between p-6 ${isLive ? "border-success/40" : ""}`}
                    >
                      <div>
                        <div className="mb-4 flex items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Chip tone="gold">{opp.category}</Chip>
                            {isLive && (
                              <Chip tone="success" icon={<Zap className="h-2.5 w-2.5" />}>
                                Live
                              </Chip>
                            )}
                            {opp._source && isLive && (
                              <span className="text-2xs font-medium text-foreground-muted">{opp._source}</span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); toggleBookmark(opp.id, opp); }}
                            title={isSaved ? "Saved" : "Save"}
                            aria-label={isSaved ? `Remove ${opp.title} from saved` : `Save ${opp.title}`}
                            aria-pressed={isSaved}
                            className={`grid h-7 w-7 shrink-0 place-items-center rounded-md transition-colors ${isSaved ? "bg-accent-gold-surface text-primary" : "bg-surface-raised text-foreground-muted hover:bg-accent-gold-surface hover:text-primary"}`}
                          >
                            {isSaved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
                          </button>
                        </div>
                        <h3 className="text-base font-semibold leading-snug text-foreground">{opp.title}</h3>
                        <p className="mt-1 text-xs font-medium text-foreground-muted">{opp.organization || opp.orgName}</p>
                        <p className="mt-4 line-clamp-3 text-xs leading-relaxed text-foreground-muted">{opp.description}</p>

                      </div>
                      <div className="mt-4 space-y-3 border-t border-border pt-4">
                        <div className="flex flex-wrap items-center gap-4 text-2xs text-foreground-muted">
                          <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{opp.country}</span>
                          <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{formatDeadline(opp.deadline)}</span>
                          {opp.field && <Chip>{opp.field}</Chip>}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            className="grow"
                            onClick={(e) => { e.stopPropagation(); openSummarize(opp); }}
                            leadingIcon={<Sparkles className="h-3.5 w-3.5" />}
                          >
                            AI Summary
                          </Button>
                          {applyLink ? (
                            <a
                              href={applyLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="btn btn-sm btn-secondary"
                            >
                              Apply <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          ) : hrefId ? (
                            <Link href={hrefId} onClick={(e) => e.stopPropagation()} className="btn btn-sm btn-secondary">
                              Details <ChevronRight className="h-3.5 w-3.5" />
                            </Link>
                          ) : null}
                        </div>
                      </div>
                    </Card>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </motion.div>
          )}

          {!oppsLoading && filteredOpportunities.length === 0 && (
            <EmptyState
              icon={<Compass className="h-5 w-5" />}
              title="No opportunities found"
              description="Try clearing filters or searching with fewer keywords."
              action={
                activeFilterCount > 0 ? (
                  <Button type="button" variant="secondary" onClick={resetAll}>
                    Reset all filters
                  </Button>
                ) : undefined
              }
              className="border-0 bg-transparent py-16"
            />
          )}
        </div>
      </div>

      {/* ── AI Full-Summarize Popup Modal ── */}
      <AnimatePresence>
        {modalOpen && selectedOpp && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeModal} className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]" />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.97 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-none"
            >
              <Card tone="raised" role="dialog" aria-modal="true" aria-label={`AI summary of ${selectedOpp.title}`} className="pointer-events-auto flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden p-0">
                <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border p-6">
                  <div className="min-w-0 flex-1">
                    <Chip tone="gold" className="mb-2">{selectedOpp.category}</Chip>
                    <h2 className="line-clamp-2 font-display text-lg leading-snug text-foreground">{selectedOpp.title}</h2>
                    <p className="mt-1 text-xs text-foreground-muted">{selectedOpp.organization || selectedOpp.orgName} • {selectedOpp.country}</p>
                    <a href={selectedOpp.sourceUrl || selectedOpp.applyLink} target="_blank" rel="noopener noreferrer" className="link-ink mt-2 inline-flex items-center gap-1 break-all text-xs">{(selectedOpp.sourceUrl || selectedOpp.applyLink || "").slice(0, 80)} <ExternalLink className="h-3 w-3 shrink-0" /></a>
                  </div>
                  <Button type="button" variant="quiet" size="icon" onClick={closeModal} aria-label="Close summary" className="shrink-0">
                    <X className="h-5 w-5" />
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                  {summarizing ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-16">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <p className="text-sm font-semibold text-foreground">Generating AI summary…</p>
                      <p className="text-center text-xs text-foreground-muted">
                        Fetching page content and summarising. This takes 5–15 seconds.<br />Main facts will appear at the end.
                      </p>
                    </div>
                  ) : summaryError ? (
                    <ErrorState
                      title="Failed to summarize"
                      description={summaryError}
                      action={
                        <Button type="button" size="sm" onClick={() => openSummarize(selectedOpp)}>
                          Retry
                        </Button>
                      }
                    />
                  ) : summaryText ? (
                    <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-foreground">{summaryText}</pre>
                  ) : (
                    <ErrorState
                      title="Summary not available"
                      description="Could not generate a summary for this opportunity. Try clicking Retry."
                      action={
                        <Button type="button" size="sm" onClick={() => openSummarize(selectedOpp)}>
                          Retry
                        </Button>
                      }
                    />
                  )}
                </div>
<div className="flex shrink-0 items-center justify-between gap-3 border-t border-border bg-surface-raised/50 p-4">
                  <span className="text-2xs text-foreground-muted">AI via OpenRouter key 1 (easy format • main facts at end)</span>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="secondary" size="sm" onClick={closeModal}>
                      Close
                    </Button>
                    {selectedOpp.applyLink && (
                      <a href={selectedOpp.applyLink} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-primary">
                        Apply Now <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              </Card>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Explore() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen grow bg-background transition-colors duration-slow">
        <Suspense fallback={<div className="grid min-h-screen place-items-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
          <ExploreContent />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
