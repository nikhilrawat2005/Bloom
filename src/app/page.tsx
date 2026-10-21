"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/context/AuthContext";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/Reveal";
import {
  Search,
  ArrowUpRight,
  GraduationCap,
  Briefcase,
  Users,
  Compass,
  Trophy,
  Sparkles,
  ArrowRight,
  FlaskConical,
  BookOpen,
  Globe2,
  Zap,
  CheckCircle2,
  TrendingUp,
} from "lucide-react";
import { motion } from "framer-motion";

const EASE = [0.16, 1, 0.3, 1] as const;

const FACETS = [
  "Artificial Intelligence",
  "Computer Science",
  "Biotech & STEM",
  "Design & Product",
  "Data Science",
  "FinTech",
];

const CATEGORIES = [
  { name: "Scholarships", icon: GraduationCap, note: "Merit • Gov • Undergrad", color: "from-blue-500/20 to-indigo-500/20" },
  { name: "Fellowships", icon: Users, note: "Global Research • 12mo+", color: "from-purple-500/20 to-pink-500/20" },
  { name: "Internships", icon: Briefcase, note: "High-Growth • Paid", color: "from-emerald-500/20 to-teal-500/20" },
  { name: "Hackathons", icon: Trophy, note: "Offline & Global • Prizes", color: "from-amber-500/20 to-orange-500/20" },
  { name: "Conferences", icon: Compass, note: "Virtual & In-Person • CFP", color: "from-cyan-500/20 to-blue-500/20" },
  { name: "Research", icon: FlaskConical, note: "Labs • Grants • Papers", color: "from-violet-500/20 to-purple-500/20" },
  { name: "Workshops", icon: BookOpen, note: "Hands-on • Masterclasses", color: "from-rose-500/20 to-red-500/20" },
  { name: "Exchange Programs", icon: Globe2, note: "Semester Abroad • Immersive", color: "from-sky-500/20 to-indigo-500/20" },
];

const STATS = [
  { label: "Active Opportunities", val: "400+" },
  { label: "AI Career Roadmaps", val: "14 Paths" },
  { label: "Expiry Auto-Sweep", val: "Every 12h" },
  { label: "Verified Sponsors", val: "100%" },
];

const FEATURES = [
  {
    title: "AI Precision Matching",
    desc: "Bloom analyses your profile, education, and interests to highlight high-probability matches with instant gap analysis.",
    icon: Sparkles,
  },
  {
    title: "Interactive Career Roadmaps",
    desc: "14 full-stack, AI, cloud, and engineering career roadmaps with profile synchronization and progress tracking.",
    icon: TrendingUp,
  },
  {
    title: "Document & Resume Wallet",
    desc: "Store your credentials in private Cloudinary storage with one-click automatic qualification checks.",
    icon: CheckCircle2,
  },
];

const CURATED_PICKS = [
  { k: "Hackathon", t: "Smart India Hackathon 2026 — Finals", m: "Free Entry • ₹10,00,000 Prize Pool", tag: "Hackathons" },
  { k: "Fellowship", t: "WISE-KIRAN Research Mobility", m: "Government Funded • 12 Months Research", tag: "Fellowships" },
  { k: "Internship", t: "Machine Learning Research Intern", m: "Remote • Competitive Stipend", tag: "Internships" },
];

export default function Home() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const [q, setQ] = useState("");

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(q.trim() ? `/explore?search=${encodeURIComponent(q.trim())}` : "/explore");
  };

  return (
    <>
      <Navbar />

      <main className="flex-grow">
        {/* Hero Section */}
        <section className="relative overflow-hidden pt-12 pb-20 sm:pt-16 sm:pb-28">
          {/* Subtle background ambient mesh */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[500px] pointer-events-none -z-10 bloom-glow opacity-60" />

          <div className="shell">
            <div className="mx-auto max-w-4xl text-center">
              {/* Badge */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: EASE }}
                className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-xs font-bold text-primary shadow-sm"
              >
                <Zap className="h-3.5 w-3.5 fill-primary" />
                <span>BLOOM INTELLIGENCE PLATFORM 2026</span>
              </motion.div>

              {/* Main Heading */}
              <motion.h1
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.08, ease: EASE }}
                className="mt-6 font-display text-display font-extrabold tracking-tight text-foreground"
              >
                Where Ambition Meets{" "}
                <span className="bg-gradient-to-r from-primary via-indigo-500 to-secondary bg-clip-text text-transparent">
                  Unfair Advantage.
                </span>
              </motion.h1>

              {/* Subheading */}
              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.16, ease: EASE }}
                className="mx-auto mt-6 max-w-2xl text-base sm:text-lg leading-relaxed text-foreground-muted"
              >
                Bloom cuts through internet clutter to connect ambitious students with top-tier scholarships,
                fellowships, high-growth internships, and AI-powered career roadmaps.
              </motion.p>

              {/* Interactive Search Bar */}
              <motion.form
                onSubmit={onSearch}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.22, ease: EASE }}
                className="mx-auto mt-9 flex max-w-2xl items-center gap-2 rounded-2xl border border-border bg-surface p-2 shadow-e3 transition-all focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3 pl-4">
                  <Search className="h-5 w-5 shrink-0 text-foreground-muted" />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search scholarships, AI fellowships, internships, hackathons..."
                    className="w-full bg-transparent py-2.5 text-sm font-medium text-foreground outline-none placeholder:text-foreground-subtle"
                  />
                </div>
                <button type="submit" className="btn btn-primary btn-md shrink-0">
                  Search Atlas <ArrowUpRight className="h-4 w-4" />
                </button>
              </motion.form>

              {/* Quick Filter Tags */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="mt-4 flex flex-wrap justify-center gap-2"
              >
                <span className="text-xs font-semibold text-foreground-muted self-center mr-1">Trending:</span>
                {FACETS.map((f) => (
                  <button
                    key={f}
                    onClick={() => router.push(`/explore?search=${encodeURIComponent(f)}`)}
                    className="rounded-lg border border-border bg-surface-raised px-2.5 py-1 text-xs font-medium text-foreground-muted transition-colors hover:border-primary/50 hover:text-primary"
                  >
                    {f}
                  </button>
                ))}
              </motion.div>

              {/* Action Buttons */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.34 }}
                className="mt-8 flex flex-wrap items-center justify-center gap-4"
              >
                <Link
                  href={currentUser ? "/dashboard" : "/auth/signup"}
                  className="btn btn-primary btn-lg"
                >
                  {currentUser ? "Open Bloom Dashboard" : "Get Started Free"}
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/ai-hub" className="btn btn-secondary btn-lg">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Explore AI Career Hub
                </Link>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Stats Strip */}
        <section className="border-y border-border bg-surface py-8">
          <div className="shell">
            <div className="grid grid-cols-2 gap-6 md:grid-cols-4 text-center">
              {STATS.map((s) => (
                <div key={s.label}>
                  <div className="font-display text-2xl sm:text-3xl font-extrabold text-foreground">
                    {s.val}
                  </div>
                  <div className="mt-1 text-xs sm:text-sm font-medium text-foreground-muted">
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Category Exploration Grid */}
        <section className="shell py-16 sm:py-20">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
            <div>
              <span className="eyebrow text-secondary">CURATED SECTORS</span>
              <h2 className="mt-1 font-display text-display-sm font-bold text-foreground">
                Explore by Track
              </h2>
            </div>
            <Link href="/explore" className="btn btn-ghost btn-sm text-primary font-semibold self-start sm:self-auto">
              View all tracks <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-4">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              return (
                <Link
                  key={cat.name}
                  href={`/explore?category=${cat.name}`}
                  className="card group relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-e2"
                >
                  <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl ${cat.color} rounded-bl-full pointer-events-none opacity-40 group-hover:opacity-100 transition-opacity`} />
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-surface-raised text-primary group-hover:bg-primary group-hover:text-white transition-colors duration-200">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 font-display text-base font-bold text-foreground group-hover:text-primary transition-colors">
                    {cat.name}
                  </h3>
                  <p className="mt-1 text-xs text-foreground-muted">{cat.note}</p>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Features / Why Bloom */}
        <section className="bg-surface border-y border-border py-16 sm:py-20">
          <div className="shell">
            <div className="max-w-2xl mb-12">
              <span className="eyebrow text-primary">INTELLIGENT WORKFLOW</span>
              <h2 className="mt-1 font-display text-display-sm font-bold text-foreground">
                Designed for Signal, Not Noise
              </h2>
              <p className="mt-3 text-sm text-foreground-muted">
                Bloom bridges discovery and execution. Every application, timeline, and prerequisite is verified.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {FEATURES.map((f) => {
                const Icon = f.icon;
                return (
                  <div key={f.title} className="card p-6 bg-surface-raised/50 border border-border hover:border-primary/40 transition-all">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-4 font-display text-lg font-bold text-foreground">{f.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-foreground-muted">{f.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Curated Feed Highlight */}
        <section className="shell py-16 sm:py-20">
          <div className="card overflow-hidden !p-0 border border-border shadow-e2">
            <div className="h-1.5 w-full bg-gradient-to-r from-primary via-indigo-500 to-secondary" />
            <div className="p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <span className="eyebrow text-secondary">LIVE FROM DATABASE</span>
                  <h3 className="font-display text-xl font-bold text-foreground">Featured Opportunities</h3>
                </div>
                <Link href="/explore" className="btn btn-primary btn-sm">
                  View All Live Listings <ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {CURATED_PICKS.map((item) => (
                  <div key={item.t} className="rounded-xl border border-border bg-surface-raised/40 p-4 hover:border-primary/30 transition-all">
                    <span className="inline-block rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                      {item.tag}
                    </span>
                    <h4 className="mt-2 text-sm font-bold text-foreground line-clamp-1">{item.t}</h4>
                    <p className="mt-1 text-xs text-foreground-muted">{item.m}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
