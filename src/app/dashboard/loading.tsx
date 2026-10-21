import { Loader2 } from "lucide-react";

/**
 * Dashboard loading boundary. Rendered inside `dashboard/layout.tsx`, so the
 * sidebar and header stay mounted while the panel fetches — previously the whole
 * route (shell included) vanished until the page resolved.
 */
export default function DashboardLoading() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
        <span className="text-[10px] uppercase tracking-widest text-foreground-muted font-bold">
          Loading workspace
        </span>
      </div>
    </div>
  );
}