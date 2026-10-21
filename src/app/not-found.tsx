import Link from "next/link";
import { Compass, SearchX } from "lucide-react";

/**
 * 404 boundary.
 *
 * Previously an unmatched URL rendered Next.js's built-in not-found page, which
 * is outside the app shell — no navbar, no theme, no way back.
 */
export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full text-center space-y-5">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 text-primary">
          <SearchX className="w-6 h-6" />
        </div>

        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-widest text-foreground-muted">
            404
          </p>
          <h1 className="font-display text-2xl font-bold text-foreground">
            This page doesn&apos;t exist
          </h1>
          <p className="text-xs leading-relaxed text-foreground-muted">
            The link may be out of date, or the listing it pointed to has closed.
            Everything currently open is in the explorer.
          </p>
        </div>

        <div className="flex items-center justify-center gap-3 pt-1">
          <Link
            href="/explore"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition-opacity"
          >
            <Compass className="w-3.5 h-3.5" />
            Explore opportunities
          </Link>
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