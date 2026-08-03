import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge class names, with later Tailwind utilities winning over earlier ones. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Ngultrum, the way the app writes it. */
export function formatNu(amount: number): string {
  return `Nu ${Math.round(amount).toLocaleString("en-US")}`;
}

/** "45 min" / "1 hr" / "1 hr 30 min" */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

/**
 * Up to two initials for an avatar fallback.
 *
 * Only word-initial *letters* count. Live staff names carry parenthetical roles —
 * "Tashi (Owner)" — and taking the last word's first character blindly rendered
 * that as `T(`. A bracket is not an initial.
 */
export function initials(name: string | null | undefined): string {
  const letters = (name ?? "")
    .split(/[^\p{L}]+/u)
    .filter(Boolean)
    .map((word) => word[0]!);
  if (letters.length === 0) return "?";
  const first = letters[0]!;
  const last = letters.length > 1 ? letters[letters.length - 1]! : "";
  return (first + last).toUpperCase();
}
