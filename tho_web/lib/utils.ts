import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge class names, with later Tailwind utilities winning over earlier ones.
 *
 * ## It deletes this project's font-size tokens. Measured, not suspected.
 *
 * `twMerge` ships with **Tailwind's own** scale hardcoded, and it is not configured here.
 * Its font-size group is `text-{xs|sm|base|lg|xl|2xl…}` plus arbitrary lengths; its colour
 * group is `text-{anything}`. So every one of the ten sizes in `globals.css` —
 * `text-title`, `text-body-sm`, `text-caption`, `text-display-md`, `text-badge` and the
 * rest — is classified as a **colour**, and the last "colour" in the call wins. Pass a size
 * and then a colour in one `cn` and the size is gone before it reaches the DOM:
 *
 *     cn("text-title font-medium", current ? "text-ink" : "text-muted")
 *     // → "font-medium text-muted"   ← no size; the element inherits
 *
 * It fails silently in the worst way: the class is in the source, the build is clean, lint
 * is clean, and the only symptom is type one step off. **40 `cn` call sites** currently lose
 * a size this way, including the shared kit — `Chip` (13px → inherited), `SegmentedControl`,
 * `Rating`, `SlotChip`, `queue-position-card`. A handful are harmless because the token
 * being dropped is `text-body-md`, which is already `body`'s 16px.
 *
 * Two ways out, and the second has not been taken:
 *
 * 1. **Put the size on an element with no colour class**, which is what
 *    `components/ui/nav-link.tsx` does — the label span carries `text-title`, the link
 *    carries the colour. Nothing to merge, nothing to lose. Reordering does not work: put
 *    the size last and it deletes the *colour* instead.
 * 2. **Teach `twMerge` the scale** with `extendTailwindMerge({ extend: { classGroups:
 *    { "font-size": [{ text: [...the ten tokens] }] } } })`. One edit, fixes all 40 — and
 *    changes rendered type on ~38 surfaces at once, across both shells. That is a design
 *    decision, so it is deliberately **not** made here.
 */
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
