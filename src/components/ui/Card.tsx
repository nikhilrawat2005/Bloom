"use client";

import {
  forwardRef,
  HTMLAttributes,
  ElementType,
  ComponentPropsWithRef,
} from "react";
import { cn } from "@/lib/utils";

export type CardTone = "default" | "raised" | "inset";

// Polymorphic helper types
type AsProp<C extends ElementType> = { as?: C };
type PropsToOmit<C extends ElementType, P> = keyof (AsProp<C> & P);
type PolymorphicComponentProp<
  C extends ElementType,
  Props = Record<string, never>
> = React.PropsWithChildren<Props & AsProp<C>> &
  Omit<ComponentPropsWithRef<C>, PropsToOmit<C, Props>>;

export interface CardOwnProps {
  tone?: CardTone;
  interactive?: boolean;
  className?: string;
}

// Card accepts an 'as' prop to render as any element (div, button, a, etc.)
export type CardProps<C extends ElementType = "div"> = PolymorphicComponentProp<
  C,
  CardOwnProps
>;

const toneClasses: Record<CardTone, string> = {
  default:
    "rounded-xl border border-border bg-card text-card-foreground shadow-sm",
  raised:
    "rounded-xl border border-border bg-card text-card-foreground shadow-md",
  inset:
    "rounded-xl border border-border bg-muted/50 text-card-foreground shadow-none",
};

// Use a function component with 'as' so forwardRef isn't needed for polymorphism
export function Card<C extends ElementType = "div">({
  as,
  tone = "default",
  interactive = false,
  className,
  children,
  ...props
}: CardProps<C>) {
  const Component = (as ?? "div") as ElementType;
  return (
    <Component
      className={cn(
        toneClasses[tone],
        interactive &&
          "cursor-pointer transition-shadow hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        className
      )}
      {...props}
    >
      {children}
    </Component>
  );
}

// CardHeaderProps stays simple (always a div)
export interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

export function CardHeader({ className, children, ...props }: CardHeaderProps) {
  return (
    <div
      className={cn("flex flex-col space-y-1.5 p-6", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export default Card;