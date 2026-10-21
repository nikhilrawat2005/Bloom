"use client";

/* eslint-disable react-hooks/static-components -- The motion components used
   here come from getMotionComponent(), which caches them at module scope in
   motionCache, so their identity IS stable across renders. The rule cannot
   see through the Map lookup. Without the cache the component type changed
   on every render and React remounted the entire subtree. */

import { ReactNode, ElementType } from "react";
import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

// `motion(tag)` must NOT be called in a render body: it returns a brand-new
// component type each call, React sees a different type on every parent
// render, and unmounts/remounts the whole subtree (state loss, focus loss,
// replayed animations). Cache one motion component per tag instead.
const motionCache = new Map<ElementType, ReturnType<typeof buildMotionComponent>>();

function buildMotionComponent(tag: ElementType) {
  return motion(tag as "div");
}

function getMotionComponent(tag: ElementType): ReturnType<typeof buildMotionComponent> {
  let cached = motionCache.get(tag);
  if (!cached) {
    cached = buildMotionComponent(tag);
    motionCache.set(tag, cached);
  }
  return cached;
}

// ─── Reveal ────────────────────────────────────────────────────────────────
export interface RevealProps {
  children?: ReactNode;
  /** Render as any HTML element (default: div) */
  as?: ElementType;
  distance?: number;
  delay?: number;
  duration?: number;
  once?: boolean;
  className?: string;
  [key: string]: unknown;
}

export function Reveal({
  children,
  as: Tag = "div",
  distance = 20,
  delay = 0,
  duration = 0.4,
  once = true,
  className,
  ...rest
}: RevealProps) {
  const MotionTag = getMotionComponent(Tag);
  return (
    <MotionTag
      initial={{ opacity: 0, y: distance }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once }}
      transition={{ duration, delay, ease: "easeOut" }}
      className={cn(className)}
      {...(rest as HTMLMotionProps<"div">)}
    >
      {children}
    </MotionTag>
  );
}

// ─── Stagger ───────────────────────────────────────────────────────────────
export interface StaggerProps {
  children?: ReactNode;
  /** Render as any HTML element (default: div) */
  as?: ElementType;
  gap?: number;
  amount?: number;
  className?: string;
  [key: string]: unknown;
}

export function Stagger({
  children,
  as: Tag = "div",
  gap = 0.07,
  amount = 0.15,
  className,
  ...rest
}: StaggerProps) {
  const MotionTag = getMotionComponent(Tag);
  return (
    <MotionTag
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount }}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: gap } },
      }}
      className={cn(className)}
      {...(rest as HTMLMotionProps<"div">)}
    >
      {children}
    </MotionTag>
  );
}

// ─── StaggerItem ───────────────────────────────────────────────────────────
export interface StaggerItemProps {
  children?: ReactNode;
  /** Render as any HTML element (default: div) */
  as?: ElementType;
  distance?: number;
  className?: string;
  [key: string]: unknown;
}

export function StaggerItem({
  children,
  as: Tag = "div",
  distance = 16,
  className,
  ...rest
}: StaggerItemProps) {
  const MotionTag = getMotionComponent(Tag);
  return (
    <MotionTag
      variants={{
        hidden: { opacity: 0, y: distance },
        visible: {
          opacity: 1,
          y: 0,
          transition: { ease: "easeOut", duration: 0.35 },
        },
      }}
      className={cn(className)}
      {...(rest as HTMLMotionProps<"div">)}
    >
      {children}
    </MotionTag>
  );
}
