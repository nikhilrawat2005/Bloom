import Link from "next/link";
import { Sparkles } from "lucide-react";

const COLUMNS = [
  {
    heading: "Platform",
    links: [
      { name: "Explore Opportunities", href: "/explore" },
      { name: "Student Dashboard", href: "/dashboard" },
      { name: "Bookmarks & Saved", href: "/saved" },
      { name: "AI Career Hub", href: "/ai-hub" },
    ],
  },
  {
    heading: "Resources",
    links: [
      { name: "Help Center", href: "/help" },
      { name: "Privacy Policy", href: "/privacy" },
      { name: "Terms of Service", href: "/terms" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="bg-surface-footer border-t border-border/20 text-white/70">
      <div className="shell py-14">
        <div className="grid gap-10 md:grid-cols-[1.4fr_0.7fr_0.7fr]">
          <div>
            <Link href="/" className="inline-flex items-center gap-3">
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-tr from-primary to-secondary text-white shadow-md">
                <Sparkles className="h-4 w-4" />
              </div>
              <span className="font-display text-xl font-bold tracking-tight text-white">Bloom</span>
              <span className="rounded-full bg-secondary/20 px-2.5 py-0.5 text-[10px] font-bold text-secondary uppercase tracking-widest border border-secondary/30">
                Ecosystem
              </span>
            </Link>
            <p className="mt-4 max-w-[420px] text-sm leading-relaxed text-slate-400 text-pretty">
              Smart, clutter-free discovery for ambitious students. Verified scholarships, fellowships,
              internships, hackathons, and AI career acceleration.
            </p>
            <p className="mt-5 text-xs font-medium tracking-wide text-slate-500">
              © 2026 Bloom Platform • Discover • Accelerate • Flourish
            </p>
          </div>

          {COLUMNS.map((col) => (
            <nav key={col.heading} aria-label={col.heading}>
              <div className="text-xs font-bold tracking-wider text-slate-200 uppercase font-display">
                {col.heading}
              </div>
              <ul className="mt-4 space-y-2.5 text-sm text-slate-400">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="transition-colors hover:text-white hover:underline underline-offset-4"
                    >
                      {l.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>
    </footer>
  );
}
