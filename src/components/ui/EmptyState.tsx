"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon?: ReactNode;
  title?: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export interface ErrorStateProps {
  icon?: ReactNode;
  title?: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export const EmptyState = ({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) => (
  <div
    className={cn(
      "flex flex-col items-center justify-center gap-3 py-12 text-center",
      className
    )}
  >
    {icon && (
      <div className="text-muted-foreground/50 [&_svg]:h-10 [&_svg]:w-10">
        {icon}
      </div>
    )}
    {title && (
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
    )}
    {description && (
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
    )}
    {action && <div className="mt-2">{action}</div>}
  </div>
);

export const ErrorState = ({
  icon,
  title = "Something went wrong",
  description,
  action,
  className,
}: ErrorStateProps) => (
  <div
    className={cn(
      "flex flex-col items-center justify-center gap-3 py-12 text-center",
      className
    )}
  >
    {icon && (
      <div className="text-destructive/60 [&_svg]:h-10 [&_svg]:w-10">
        {icon}
      </div>
    )}
    {title && (
      <h3 className="text-base font-semibold text-destructive">{title}</h3>
    )}
    {description && (
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
    )}
    {action && <div className="mt-2">{action}</div>}
  </div>
);

export default EmptyState;