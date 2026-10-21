"use client";

import { forwardRef, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ChipTone =
  | "neutral"
  | "gold"
  | "success"
  | "danger"
  | "warning"
  | "info";

export interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: ChipTone;
  icon?: ReactNode;
}

const toneClasses: Record<ChipTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  gold: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  success:
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  danger: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  warning:
    "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  info: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
};

export const Chip = forwardRef<HTMLSpanElement, ChipProps>(
  ({ tone = "neutral", icon, className, children, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        toneClasses[tone],
        className
      )}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </span>
  )
);
Chip.displayName = "Chip";

export default Chip;