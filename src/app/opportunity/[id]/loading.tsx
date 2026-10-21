import { Loader2 } from "lucide-react";

/**
 * Opportunity detail loading boundary. The page fetches the listing, an AI
 * summary and posts a view-count increment, so without this the user stares at a
 * blank panel while three requests resolve.
 */
export default function OpportunityLoading() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
        <span className="text-[10px] uppercase tracking-widest text-foreground-muted font-bold">
          Loading opportunity
        </span>
      </div>
    </div>
  );
}