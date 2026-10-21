"use client";

import { useTheme } from "@/context/ThemeProvider";
import { Sun, Moon } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

const EASE_OUT_EXPO = [0.22, 1, 0.36, 1] as const;

interface ThemeToggleProps {
  /** Icon-only button for the navbar. Default false shows icon + label. */
  compact?: boolean;
  className?: string;
}

export default function ThemeToggle({ compact = false, className = "" }: ThemeToggleProps) {
  const { isDark, toggleTheme } = useTheme();
  const label = isDark ? "Switch to light mode" : "Switch to dark mode";

  const icon = (key: string, node: React.ReactNode) => (
    <motion.span
      key={key}
      initial={{ opacity: 0, rotate: -90, scale: 0.4 }}
      animate={{ opacity: 1, rotate: 0, scale: 1 }}
      exit={{ opacity: 0, rotate: 90, scale: 0.4 }}
      transition={{ duration: 0.3, ease: EASE_OUT_EXPO }}
      className="absolute inset-0 flex items-center justify-center"
    >
      {node}
    </motion.span>
  );

  if (compact) {
    return (
      <motion.button
        type="button"
        id="theme-toggle-compact"
        onClick={toggleTheme}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.88, rotate: -14 }}
        aria-label={label}
        title={isDark ? "Light Mode" : "Dark Mode"}
        className={`relative grid h-9 w-9 place-items-center overflow-hidden rounded-lg border border-border text-foreground-muted transition-colors duration-fast hover:border-secondary/50 hover:bg-accent-gold-surface/60 hover:text-secondary ${className}`}
      >
        <AnimatePresence mode="wait" initial={false}>
          {isDark ? icon("sun", <Sun className="w-4 h-4" />) : icon("moon", <Moon className="w-4 h-4" />)}
        </AnimatePresence>
      </motion.button>
    );
  }

  // Full label version (used in the dashboard sidebar)
  return (
    <motion.button
      type="button"
      id="theme-toggle-full"
      onClick={toggleTheme}
      whileTap={{ scale: 0.98 }}
      aria-label={label}
      className={`group flex w-full items-center justify-between rounded-lg px-4 py-3 text-sm font-medium text-foreground-muted transition-colors duration-fast hover:bg-surface-raised hover:text-foreground ${className}`}
    >
      <span className="flex items-center gap-3">
        <span className="relative h-4 w-4">
          <AnimatePresence mode="wait" initial={false}>
            {isDark ? (
              <motion.span
                key="sun-full"
                initial={{ opacity: 0, rotate: -90, scale: 0.4 }}
                animate={{ opacity: 1, rotate: 0, scale: 1 }}
                exit={{ opacity: 0, rotate: 90, scale: 0.4 }}
                transition={{ duration: 0.3, ease: EASE_OUT_EXPO }}
                className="absolute inset-0 grid place-items-center"
              >
                <Sun className="w-4 h-4 text-amber-400" />
              </motion.span>
            ) : (
              <motion.span
                key="moon-full"
                initial={{ opacity: 0, rotate: 90, scale: 0.4 }}
                animate={{ opacity: 1, rotate: 0, scale: 1 }}
                exit={{ opacity: 0, rotate: -90, scale: 0.4 }}
                transition={{ duration: 0.3, ease: EASE_OUT_EXPO }}
                className="absolute inset-0 grid place-items-center"
              >
                <Moon className="w-4 h-4" />
              </motion.span>
            )}
          </AnimatePresence>
        </span>
        <span>{isDark ? "Light Mode" : "Dark Mode"}</span>
      </span>
      <span className="chip">Theme</span>
    </motion.button>
  );
}