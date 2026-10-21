"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SkeletonProps {
  className?: string;
}

export const Skeleton = ({ className }: SkeletonProps) => (
  <div
    className={cn(
      "animate-pulse rounded-md bg-muted",
      className
    )}
  />
);
Skeleton.displayName = "Skeleton";

export const SkeletonGroup = ({
  children,
  gap = 8,
}: {
  children: ReactNode;
  gap?: number;
}) => (
  <div className="flex flex-col" style={{ gap }}>
    {children}
  </div>
);

export default Skeleton;