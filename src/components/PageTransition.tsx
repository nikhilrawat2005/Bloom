"use client";

import { motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useRef, type ReactNode } from "react";

/**
 * Route transition.
 *
 * A short fade with a small upward drift and a subtle blur lift. The blur is
 * what makes it read as a deliberate page change rather than a flicker; it is
 * expensive enough that it is dropped entirely for reduced motion.
 *
 * `mode="wait"` is deliberately not used — it delays the incoming page until
 * the outgoing one finishes, which feels slower than overlapping them.
 */
export default function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

  if (reduced) {
    return <div className="flex-1 flex flex-col">{children}</div>;
  }

  return (
    <motion.div
      ref={ref}
      key={pathname}
      initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
      // A non-none `filter` establishes a containing block for `position: fixed`
      // descendants, which anchored fixed overlays (explore AI-summary modal,
      // dashboard sidebar, admin modal) to this 4000px-tall page wrapper instead
      // of the viewport — so they rendered off-screen below the fold. The enter
      // animation ends at `blur(0px)`, which still counts as non-none, so clear
      // the inline filter once it completes to restore viewport-relative fixed
      // positioning. (Framer keeps the last animated value, hence the explicit
      // reset rather than relying on the animation target.)
      onAnimationComplete={() => {
        if (ref.current) ref.current.style.filter = "none";
      }}
      className="flex-1 flex flex-col"
    >
      {children}
    </motion.div>
  );
}