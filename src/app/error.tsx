"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";

/**
 * Root error boundary.
 *
 * Without this, any render error in a server component surfaced Next.js's
 * unstyled production error page — losing the app's shell, navigation and
 * theme entirely. This catches it and keeps the user inside the design system.
 *
 * `reset()` retries the render without a full reload, which is the right call
 * for a transient data failure and the wrong one for a broken component, so both
 * options are offered.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Kept in the browser console rather than surfaced in the UI: the raw message
    // can contain query fragments or internal identifiers.
    console.error("Unhandled application error:", error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full text-center space-y-5">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-danger-surface border border-danger/30 text-danger">
          <AlertTriangle className="w-6 h-6" />
        </div>

        <div className="space-y-2">
          <h1 className="font-display text-2xl font-bold text-foreground">
            Something went wrong
          </h1>
          <p className="text-xs leading-relaxed text-foreground-muted">
            This page failed to load. Your saved data is unaffected.
          </p>
        </div>

        {error.digest && (
          <p className="font-mono text-[10px] text-foreground-muted">
            Reference: {error.digest}
          </p>
        )}

        <div className="flex items-center justify-center gap-3 pt-1">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition-opacity"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Try again
          </button>
          <Link
            href="/"
            className="px-4 py-2.5 rounded-full border border-border text-xs font-bold text-foreground hover:bg-surface-raised transition-colors"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}