"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { LogOut, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import ThemeToggle from "@/components/ThemeToggle";

const EASE_OUT_EXPO = [0.22, 1, 0.36, 1] as const;

const LINKS = [
  { name: "Home", href: "/" },
  { name: "Explore", href: "/explore" },
  { name: "Saved", href: "/saved" },
  { name: "Dashboard", href: "/dashboard" },
  { name: "AI Hub", href: "/ai-hub" },
  { name: "Profile", href: "/profile" },
];

export default function Navbar() {
  const pathname = usePathname();
  const { currentUser, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 6);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  const initials = (currentUser?.displayName || currentUser?.email || "U")[0].toUpperCase();
  const displayName = currentUser?.displayName || currentUser?.email;

  return (
    <motion.nav
      initial={{ y: -12, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}
      className={`sticky top-0 z-50 border-b border-border backdrop-blur-[14px] transition-[background-color,box-shadow] duration-slow ${
        scrolled ? "bg-surface/92 shadow-e2" : "bg-surface/72"
      }`}
    >
      <div className="shell">
        <div className="flex h-16 items-center justify-between gap-6">
          <Link href="/" className="group flex shrink-0 items-center gap-2.5">
            <span className="grid h-[30px] w-[30px] place-items-center rounded-[9px] bg-foreground font-display text-xs font-bold tracking-[0.12em] text-background transition-transform duration-slow group-hover:rotate-6">
              N
            </span>
            <span className="font-display text-lg tracking-[-0.03em]">NEXORA</span>
          </Link>

          <div className="hidden items-center gap-1 lg:flex">
            {LINKS.map((l) => {
              const active = pathname === l.href;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative rounded-[10px] px-3.5 py-2 text-sm font-medium tracking-[-0.01em] transition-colors duration-fast ${
                    active
                      ? "bg-surface-raised text-foreground"
                      : "text-foreground-muted hover:bg-surface-raised/70 hover:text-foreground"
                  }`}
                >
                  {l.name}
                  {active && (
                    <motion.span
                      layoutId="ink-underline"
                      className="absolute -bottom-px left-3 right-3 h-[1.5px] rounded-full bg-foreground"
                      transition={{ type: "spring", stiffness: 420, damping: 30 }}
                    />
                  )}
                </Link>
              );
            })}
          </div>

          <div className="hidden items-center gap-2.5 lg:flex">
            <ThemeToggle compact />
            {currentUser ? (
              <div className="ml-1 flex items-center gap-3 border-l border-border pl-3">
                <span
                  aria-hidden
                  className="grid h-7 w-7 place-items-center rounded-full bg-foreground text-xs font-semibold text-background"
                >
                  {initials}
                </span>
                <span className="hidden max-w-[130px] truncate text-sm font-medium tracking-[-0.01em] xl:inline">
                  {displayName}
                </span>
                <button
                  type="button"
                  onClick={() => logout()}
                  className="grid h-8 w-8 place-items-center rounded-[10px] border border-border text-foreground-muted transition-colors duration-fast hover:border-foreground-subtle hover:text-foreground"
                  title="Sign out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="sr-only">Sign out</span>
                </button>
              </div>
            ) : (
              <>
                <Link href="/auth/login" className="btn btn-ghost btn-sm">
                  Sign in
                </Link>
                <Link href="/auth/signup" className="btn btn-primary btn-sm">
                  Join NEXORA
                </Link>
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5 lg:hidden">
            <ThemeToggle compact />
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-label={open ? "Close menu" : "Open menu"}
              className="grid h-9 w-9 place-items-center rounded-[10px] border border-border bg-surface text-foreground"
            >
              <AnimatePresence mode="wait" initial={false}>
                {open ? (
                  <motion.span
                    key="x"
                    initial={{ rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 90, opacity: 0 }}
                    transition={{ duration: 0.16 }}
                  >
                    <X className="w-4 h-4" />
                  </motion.span>
                ) : (
                  <motion.span
                    key="m"
                    initial={{ rotate: 90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: -90, opacity: 0 }}
                    transition={{ duration: 0.16 }}
                  >
                    <Menu className="w-4 h-4" />
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.26, ease: EASE_OUT_EXPO }}
            className="overflow-hidden border-t border-border bg-surface lg:hidden"
          >
            <div className="space-y-1 px-4 py-4">
              {LINKS.map((l) => {
                const active = pathname === l.href;
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    aria-current={active ? "page" : undefined}
                    className={`block rounded-[12px] px-3 py-2.5 text-sm font-medium transition-colors duration-fast ${
                      active
                        ? "bg-foreground text-background"
                        : "bg-surface-raised/60 text-foreground-muted hover:text-foreground"
                    }`}
                  >
                    {l.name}
                  </Link>
                );
              })}
              <div className="mt-3 flex gap-2 border-t border-border pt-3">
                {currentUser ? (
                  <button
                    type="button"
                    onClick={() => logout()}
                    className="btn btn-secondary btn-md flex-1 justify-center"
                  >
                    <LogOut className="w-4 h-4" /> Sign out
                  </button>
                ) : (
                  <>
                    <Link href="/auth/login" className="btn btn-secondary btn-md flex-1 justify-center">
                      Sign in
                    </Link>
                    <Link href="/auth/signup" className="btn btn-primary btn-md flex-1 justify-center">
                      Join
                    </Link>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}