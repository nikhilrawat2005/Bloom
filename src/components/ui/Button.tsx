"use client";

import {
  ElementType,
  ReactNode,
  ComponentPropsWithRef,
} from "react";
import { cn } from "@/lib/utils";

// ─── Polymorphic helpers ────────────────────────────────────────────────────
type AsProp<C extends ElementType> = { as?: C };
type PropsToOmit<C extends ElementType, P> = keyof (AsProp<C> & P);
type PolymorphicComponentProp<
  C extends ElementType,
  Props = Record<string, never>
> = React.PropsWithChildren<Props & AsProp<C>> &
  Omit<ComponentPropsWithRef<C>, PropsToOmit<C, Props>>;

// ─── Button-specific props ──────────────────────────────────────────────────
export interface ButtonOwnProps {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline" | "quiet";
  size?: "xs" | "sm" | "md" | "lg" | "icon";
  block?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}

export type ButtonProps<C extends ElementType = "button"> =
  PolymorphicComponentProp<C, ButtonOwnProps>;

// ─── Style maps ────────────────────────────────────────────────────────────
const variantClasses: Record<
  NonNullable<ButtonOwnProps["variant"]>,
  string
> = {
  primary:
    "bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-primary",
  secondary:
    "bg-secondary text-secondary-foreground hover:bg-secondary/80 focus-visible:ring-secondary",
  ghost:
    "bg-transparent hover:bg-accent text-foreground focus-visible:ring-accent",
  danger:
    "bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive",
  outline:
    "border border-border bg-transparent text-foreground hover:bg-accent focus-visible:ring-accent",
  quiet:
    "bg-muted/50 text-muted-foreground hover:bg-muted focus-visible:ring-muted",
};

const sizeClasses: Record<NonNullable<ButtonOwnProps["size"]>, string> = {
  xs: "h-6 px-2 text-xs gap-1 rounded",
  sm: "h-8 px-3 text-sm gap-1.5 rounded-md",
  md: "h-10 px-4 text-sm gap-2 rounded-lg",
  lg: "h-12 px-6 text-base gap-2.5 rounded-xl",
  icon: "h-9 w-9 rounded-lg p-0",
};

// ─── Component ─────────────────────────────────────────────────────────────
export function Button<C extends ElementType = "button">({
  as,
  variant = "primary",
  size = "md",
  block = false,
  leadingIcon,
  trailingIcon,
  loading = false,
  disabled,
  className,
  children,
  ...rest
}: ButtonProps<C>) {
  const Component = (as ?? "button") as ElementType;
  const isDisabled = disabled || loading;

  return (
    <Component
      // Only set disabled attr for actual button elements
      {...(as == null || as === "button" ? { disabled: isDisabled } : {})}
      className={cn(
        "inline-flex items-center justify-center font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-50",
        isDisabled && "pointer-events-none opacity-50",
        variantClasses[variant],
        sizeClasses[size],
        block && "w-full",
        className
      )}
      {...rest}
    >
      {leadingIcon && (
        <span className="shrink-0" aria-hidden>
          {leadingIcon}
        </span>
      )}
      {children}
      {trailingIcon && (
        <span className="shrink-0" aria-hidden>
          {trailingIcon}
        </span>
      )}
    </Component>
  );
}

export default Button;