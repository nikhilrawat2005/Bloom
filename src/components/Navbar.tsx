"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { LogOut, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import ThemeToggle from "@/components/ThemeToggle";

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

const LINKS = [
  { name: "Explore", href: "/explore" },
  { name: "Saved", href: "/saved" },
  { name: "Dashboard", href: "/dashboard" },
  { name: "AI Hub", href: "/ai-hub" },
  { name: "Profile", href: "/profile" },
];

export default function Navbar() {
  const pathname = usePathname();
  const { currentUser, logout } = useAuth();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const initials = (currentUser?.displayName || currentUser?.email || "B")[0].toUpperCase();
  const displayName = currentUser?.displayName || currentUser?.email;

  return (
    <motion.nav
      initial={{ y: -12, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: EASE_OUT_EXPO }}
      className={`sticky top-0 z-50 border-b border-border backdrop-blur-md transition-all duration-300 ${
        scrolled ? "bg-surface/90 shadow-e2" : "bg-surface/60"
      }`}
    >
      <div className="shell">
        <div className="flex h-16 items-center justify-between gap-6">
          {/* Bloom Brand Logo */}
          <Link href="/" className="group flex shrink-0 items-center gap-3">
            <div className="relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-tr from-primary to-secondary text-white shadow-md shadow-primary/20 transition-transform duration-300 group-hover:scale-105">
              <Sparkles className="h-5 w-5 animate-pulse" />
            </div>
            <div className="flex flex-col">
              <span className="font-display text-xl font-bold tracking-tight text-foreground">
                Bloom
              </span>
              <span className="-mt-1 text-[10px] font-semibold tracking-wider text-secondary uppercase">
                Intelligence
              </span>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden items-center gap-1.5 md:flex">
            {LINKS.map((l) => {
              const active = pathname === l.href;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative rounded-xl px-4 py-2 text-sm font-semibold tracking-tight transition-all duration-200 ${
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-foreground-muted hover:bg-surface-raised hover:text-foreground"
                  }`}
                >
                  {l.name}
                  {active && (
                    <motion.span
                      layoutId="bloom-active-pill"
                      className="absolute inset-0 rounded-xl bg-primary/10 border border-primary/20 -z-10"
                      transition={{ type: "spring", stiffness: 380, damping: 28 }}
                    />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Controls & User State */}
          <div className="flex items-center gap-3">
            <ThemeToggle compact />
            {currentUser ? (
              <div className="flex items-center gap-3 border-l border-border pl-3">
                <span
                  aria-hidden
                  className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-tr from-primary to-indigo-600 text-xs font-bold text-white shadow-sm"
                >
                  {initials}
                </span>
                <span className="hidden max-w-[130px] truncate text-sm font-medium xl:inline text-foreground">
                  {displayName}
                </span>
                <button
                  type="button"
                  onClick={() => logout()}
                  className="grid h-8 w-8 place-items-center rounded-xl border border-border text-foreground-muted transition-colors hover:border-foreground-subtle hover:text-foreground"
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="sr-only">Sign out</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/auth/login" className="btn btn-ghost btn-sm">
                  Sign in
                </Link>
                <Link href="/auth/signup" className="btn btn-primary btn-sm">
                  Join Bloom
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.nav>
  );
}
