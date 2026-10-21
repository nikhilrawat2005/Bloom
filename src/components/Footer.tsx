import Link from "next/link";

const COLUMNS = [
  {
    heading: "Platform",
    links: [
      { name: "Explore", href: "/explore" },
      { name: "Dashboard", href: "/dashboard" },
      { name: "Saved", href: "/saved" },
      { name: "AI Career Hub", href: "/ai-hub" },
    ],
  },
  {
    heading: "Resources",
    links: [
      { name: "Help", href: "/help" },
      { name: "Privacy", href: "/privacy" },
      { name: "Terms", href: "/terms" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="bg-surface-footer border-t border-white/[0.06] text-white/70">
      <div className="shell py-12">
        <div className="grid gap-10 md:grid-cols-[1.4fr_0.7fr_0.7fr]">
          <div>
            <Link href="/" className="inline-flex items-center gap-2.5">
              <span className="grid h-7 w-7 place-items-center rounded-[9px] bg-white font-display text-xs font-bold tracking-[0.12em] text-[#1A1625]">
                N
              </span>
              <span className="font-display text-lg tracking-[-0.03em] text-white">NEXORA</span>
              <span className="ml-1 border-l border-white/15 pl-3 text-2xs font-semibold tracking-[0.16em] text-white/50">
                ATLAS
              </span>
            </Link>
            <p className="mt-4 max-w-[420px] text-sm leading-relaxed text-white/60 text-pretty">
              Parchment calm, ink precision. A curated atlas of 400 opportunities — brass details, not
              gradients. Built for signal, not noise.
            </p>
            <p className="mt-4 text-2xs font-medium tracking-[0.08em] text-white/40">
              © 2026 NEXORA • Discover • Prepare • Grow
            </p>
          </div>

          {COLUMNS.map((col) => (
            <nav key={col.heading} aria-label={col.heading}>
              <div className="text-2xs font-semibold tracking-[0.14em] text-white/90">
                {col.heading.toUpperCase()}
              </div>
              <ul className="mt-3 space-y-2.5 text-sm text-white/60">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="transition-colors duration-fast hover:text-white"
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