"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface StatProps {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: "default" | "gold" | "success" | "danger" | "info";
  ready?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const toneValue: Record<NonNullable<StatProps["tone"]>, string> = {
  default: "text-foreground",
  gold: "text-yellow-600 dark:text-yellow-400",
  success: "text-green-600 dark:text-green-400",
  danger: "text-red-600 dark:text-red-400",
  info: "text-blue-600 dark:text-blue-400",
};

const sizeValue: Record<NonNullable<StatProps["size"]>, string> = {
  sm: "text-xl font-bold",
  md: "text-2xl font-bold",
  lg: "text-4xl font-bold",
};

export const Stat = ({
  label,
  value,
  hint,
  icon,
  tone = "default",
  ready = true,
  size = "md",
  className,
}: StatProps) => (
  <div className={cn("flex flex-col gap-1", className)}>
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      {icon && <span className="shrink-0">{icon}</span>}
      {label}
    </div>
    <div
      className={cn(
        sizeValue[size],
        toneValue[tone],
        !ready && "animate-pulse text-muted-foreground"
      )}
    >
      {ready ? value : "—"}
    </div>
    {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
  </div>
);

export default Stat;