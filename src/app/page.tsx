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
} from "lucide-react";
import { motion } from "framer-motion";

const EASE = [0.22, 1, 0.36, 1] as const;

const FACETS = ["Computer Science", "Engineering", "Data & AI", "Design", "Business", "Sciences"];

const CATEGORIES = [
  { name: "Scholarships", icon: GraduationCap, note: "Girls • Gov • Merit" },
  { name: "Fellowships", icon: Users, note: "Research • 12 mo" },
  { name: "Internships", icon: Briefcase, note: "Remote • Stipend" },
  { name: "Conferences", icon: Compass, note: "CFP • Virtual" },
  { name: "Hackathons", icon: Trophy, note: "Offline • Free" },
  { name: "Research", icon: FlaskConical, note: "Labs • Grants" },
  { name: "Workshops", icon: BookOpen, note: "Bootcamps • Skills" },
  { name: "Exchange Programs", icon: Globe2, note: "Global • Abroad" },
];

const PILLARS = [
  { t: "One calm ledger", d: "400 sources distilled into one scroll, no scattered blogs." },
  { t: "Smart, honest filters", d: "Each category owns its filters — not generic everywhere." },
  { t: "Expiry as feature", d: "Pending stays, expired auto-prunes every 12 hours." },
];

const VOICES = [
  { q: "NEXORA replaced 12 tabs with one ledger. I found WISE-KIRAN in two minutes.", n: "Arjun Verma", r: "CS & AI, IIT Delhi" },
  { q: "Expiry sweep is honest — if it’s closed, it’s gone. No ghost listings.", n: "Sneha Nair", r: "SE, BITS Pilani" },
  { q: "AI summary turns a messy CFP page into 6 clear facts. Huge time saver.", n: "Karan Mehta", r: "Robotics, DTU" },
];

const TONIGHT = [
  { k: "Hackathon", t: "Smart India Hackathon 2026 — Finals", m: "Offline • Free • Prize ₹10L", c: "Hackathons" },
  { k: "Fellowship", t: "WISE-KIRAN Research Mobility", m: "Gov • Girls • 12 months", c: "Fellowships" },
  { k: "Internship", t: "Remote ML Intern — Eduversity", m: "Remote • Paid • 3 mo", c: "Internships" },
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
        {/* ── Masthead ─────────────────────────────────────────────── */}
        <section className="shell pb-12 pt-8 sm:pt-10">
          <div className="flex items-center justify-between border-y border-border py-2.5 text-2xs font-semibold tracking-[0.14em] text-foreground-muted">
            <span className="hidden sm:inline">EST. 2026 — CURATED BY NEXORA EDITORS</span>
            <span>VOL. I — ATLAS OF OPPORTUNITY</span>
            <span className="hidden items-center gap-2 sm:inline">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" /> 400 LIVE LISTINGS
            </span>
          </div>

          <div className="grid items-start gap-8 pt-8 sm:pt-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-12">
            <div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: EASE }}
                className="inline-flex items-center gap-2 rounded-full border border-accent-gold-surface bg-accent-gold-surface px-3 py-1.5 text-2xs font-semibold tracking-[0.14em] text-secondary"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-secondary" /> DISCOVER • PREPARE • GROW
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.08, ease: EASE }}
                className="mt-5 font-display text-display font-bold tracking-[-0.04em] text-balance"
              >
                Every student
                <br />
                <span className="font-light italic tracking-[-0.03em] text-foreground/85">
                  opportunity.
                </span>
                <br />
                One{" "}
                <span className="underline decoration-[3px] decoration-secondary underline-offset-[10px]">
                  intelligent
                </span>
                <br />
                atlas.
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.16, duration: 0.5, ease: EASE }}
                className="mt-6 max-w-[560px] text-base leading-relaxed text-foreground-muted text-pretty"
              >
                NEXORA is a parchment-calm, ink-precise atlas of scholarships, fellowships,
                internships and hackathons — scraped from 400 sources, summarized by AI, filtered
                with intent.
              </motion.p>

              {/* Search — an editorial inset rather than a pill */}
              <motion.form
                onSubmit={onSearch}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.22, ease: EASE }}
                className="mt-7 flex max-w-[560px] items-center gap-2 rounded-lg border border-border bg-surface p-1.5 shadow-e1 transition-[border-color,box-shadow] duration-base focus-within:border-foreground focus-within:shadow-e3"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3 pl-4">
                  <Search className="h-[18px] w-[18px] shrink-0 text-foreground-muted" />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Try “Girls Go Circular, DAAD, or remote ML intern”"
                    aria-label="Search opportunities"
                    className="w-full bg-transparent py-2.5 text-sm text-foreground outline-none placeholder:text-foreground-subtle"
                  />
                </div>
                <button type="submit" className="btn btn-primary shrink-0">
                  Explore <ArrowUpRight className="h-4 w-4" />
                </button>
              </motion.form>

              <div className="mt-4 flex max-w-[560px] flex-wrap gap-2">
                {FACETS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => router.push(`/explore?search=${encodeURIComponent(f)}`)}
                    className="chip transition-colors duration-fast hover:border-foreground-subtle hover:bg-surface"
                  >
                    {f}
                  </button>
                ))}
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href={currentUser ? "/dashboard" : "/auth/signup"}
                  className="btn btn-primary btn-lg"
                >
                  {currentUser ? "Open dashboard" : "Start free — no clutter"}
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/ai-hub" className="btn btn-ghost btn-lg">
                  <Sparkles className="h-4 w-4 text-secondary" /> Try AI Career Hub
                </Link>
              </div>

              <p className="mt-3 text-xs tracking-[0.04em] text-foreground-subtle">
                No spam. No purple gradients. Just verified pathways.
              </p>
            </div>

            {/* Artifact stack — deliberately off-centre */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18, duration: 0.6, ease: EASE }}
              className="relative lg:sticky lg:top-[84px]"
            >
              <div className="card overflow-hidden !p-0">
                <div className="h-1.5 w-full bg-gradient-to-r from-foreground via-secondary to-foreground/40" />
                <div className="p-5 sm:p-6">
                  <div className="flex items-center justify-between">
                    <span className="eyebrow">Tonight’s curation</span>
                    <span className="chip chip-success">● LIVE</span>
                  </div>

                  <Stagger className="mt-4 space-y-3" amount={0.4}>
                    {TONIGHT.map((it) => (
                      <StaggerItem key={it.t}>
                        <div className="flex gap-3 rounded-md border border-border bg-surface-raised/60 p-3.5 transition-colors duration-fast hover:bg-surface-raised">
                          <span
                            aria-hidden
                            className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-foreground text-2xs font-bold tracking-[0.06em] text-background"
                          >
                            {it.k[0]}
                          </span>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold leading-snug tracking-[-0.01em]">
                              {it.t}
                            </div>
                            <div className="mt-0.5 text-xs text-foreground-muted">{it.m}</div>
                            <span className="mt-2 inline-flex border border-border bg-surface px-2 py-1 text-2xs font-semibold tracking-[0.08em] text-foreground-muted">
                              {it.c}
                            </span>
                          </div>
                        </div>
                      </StaggerItem>
                    ))}
                  </Stagger>

                  <Link href="/explore" className="btn btn-primary btn-lg mt-4 w-full justify-center">
                    Open full atlas <ArrowUpRight className="h-4 w-4" />
                  </Link>
                  <p className="mt-3 text-center text-xs text-foreground-subtle">
                    Scrape cadence: every 2 days • Expiry sweep: every 12h
                  </p>
                </div>
              </div>
            </motion.div>
          </div>

          <hr className="hr-brass mt-12" />
        </section>

        {/* ── Index ─────────────────────────────────────────────────── */}
        <section className="shell py-12">
          <Reveal className="flex flex-wrap items-end justify-between gap-6">
            <h2 className="font-display text-display-sm font-bold tracking-[-0.03em]">Index</h2>
            <p className="max-w-[520px] text-sm text-foreground-muted text-pretty">
              Six ledgers, each with its own filters — paid/unpaid, online/offline, gov/private,
              girls/boys — not one generic dropdown.
            </p>
          </Reveal>

          <Stagger className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-4">
            {CATEGORIES.map((cat) => {
              const I = cat.icon;
              return (
                <StaggerItem key={cat.name}>
                  <Link
                    href={`/explore?category=${cat.name}`}
                    className="card group block p-4 transition-[border-color,box-shadow,transform] duration-base hover:-translate-y-0.5 hover:border-foreground-subtle hover:shadow-e2"
                  >
                    <span className="grid h-9 w-9 place-items-center rounded-md border border-border bg-surface-raised transition-colors duration-base group-hover:border-foreground group-hover:bg-foreground group-hover:text-background">
                      <I className="h-4 w-4" />
                    </span>
                    <span className="mt-3 block text-sm font-semibold tracking-[-0.01em]">
                      {cat.name}
                    </span>
                    <span className="mt-0.5 block text-xs text-foreground-muted">{cat.note}</span>
                  </Link>
                </StaggerItem>
              );
            })}
          </Stagger>
        </section>

        {/* ── Why ───────────────────────────────────────────────────── */}
        <section className="border-y border-border bg-surface">
          <div className="shell py-12 sm:py-14">
            <div className="grid items-start gap-8 lg:grid-cols-[0.95fr_1.05fr]">
              <Reveal as="h2" className="font-display text-display-sm font-bold tracking-[-0.03em]">
                Built for signal,
                <br />
                <span className="font-normal italic">not noise.</span>
              </Reveal>

              <Stagger className="grid gap-4 sm:grid-cols-3">
                {PILLARS.map((b) => (
                  <StaggerItem key={b.t}>
                    <div className="card-inset h-full p-4">
                      <span className="block h-1 w-7 rounded-full bg-secondary" />
                      <div className="mt-3 text-sm font-semibold tracking-[-0.01em]">{b.t}</div>
                      <p className="mt-1 text-sm leading-relaxed text-foreground-muted text-pretty">
                        {b.d}
                      </p>
                    </div>
                  </StaggerItem>
                ))}
              </Stagger>
            </div>
          </div>
        </section>

        {/* ── Voices ────────────────────────────────────────────────── */}
        <section className="shell py-12">
          <Stagger className="grid gap-4 md:grid-cols-3">
            {VOICES.map((t) => (
              <StaggerItem key={t.n}>
                <figure className="card h-full p-5">
                  <blockquote className="text-sm leading-relaxed text-pretty">“{t.q}”</blockquote>
                  <figcaption className="mt-3 text-sm font-semibold">{t.n}</figcaption>
                  <div className="text-xs text-foreground-muted">{t.r}</div>
                </figure>
              </StaggerItem>
            ))}
          </Stagger>
        </section>
      </main>

      <Footer />
    </>
  );
}