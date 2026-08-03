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

/** Up to two initials for an avatar fallback. */
export function initials(name: string | null | undefined): string {
  if (!name?.trim()) return "?";
  const parts = name.trim().split(/\s+/);
  return (parts[0]![0]! + (parts.length > 1 ? parts[parts.length - 1]![0]! : ""))
    .toUpperCase();
}
