/**
 * Utility: cn
 * Merges class names, filtering out falsy values.
 * Intentionally kept dependency-free.
 */
export function cn(...classes: unknown[]): string {
  return classes.filter(Boolean).join(" ");
}
