"use client";

import { ReactNode, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface SectionHeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  children?: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
}

export const SectionHeading = ({
  children,
  eyebrow,
  description,
  className,
  ...props
}: SectionHeadingProps) => (
  <div className="flex flex-col gap-1">
    {eyebrow && (
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {eyebrow}
      </p>
    )}
    <h2
      className={cn(
        "text-xl font-bold tracking-tight text-foreground",
        className
      )}
      {...props}
    >
      {children}
    </h2>
    {description && (
      <p className="text-sm text-muted-foreground">{description}</p>
    )}
  </div>
);

export default SectionHeading;