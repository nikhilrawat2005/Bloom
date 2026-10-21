import { Loader2 } from "lucide-react";

/**
 * Route-level loading boundary.
 *
 * Every page in this app is a client component that fetches from Firestore or
 * the API on mount, so without a `loading.tsx` the router leaves the previous
 * screen up with no indication anything is happening.
 */
export default function Loading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
        <span className="text-[10px] uppercase tracking-widest text-foreground-muted font-bold">
          Loading
        </span>
      </div>
    </div>
  );
}