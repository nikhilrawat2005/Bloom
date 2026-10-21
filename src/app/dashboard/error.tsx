"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";

/**
 * Dashboard-scoped error boundary.
 *
 * The dashboard's pages are the heaviest client-fetching surfaces in the app
 * (wallet documents, performance fan-out to GitHub and four coding platforms,
 * org applications, admin telemetry). A rejected fetch or a bad snapshot in any
 * one of them used to take down the whole route with Next.js's unstyled
 * production error page. Scoping the boundary here keeps the sidebar and the
 * rest of the shell usable, so the user can navigate away instead of hitting a
 * dead end.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled dashboard error:", error);
  }, [error]);

  return (
    <div className="flex items-center justify-center py-20 px-4">
      <div className="max-w-md w-full text-center space-y-5">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-danger-surface border border-danger/30 text-danger">
          <AlertTriangle className="w-6 h-6" />
        </div>

        <div className="space-y-2">
          <h2 className="font-display text-xl font-bold text-foreground">
            This panel failed to load
          </h2>
          <p className="text-xs leading-relaxed text-foreground-muted">
            Your documents and profile are unaffected. You can retry, or move to
            another section of the workspace.
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
            href="/dashboard"
            className="px-4 py-2.5 rounded-full border border-border text-xs font-bold text-foreground hover:bg-surface-raised transition-colors"
          >
            Workspace overview
          </Link>
        </div>
      </div>
    </div>
  );
}