import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * Every font-size token this project declares, without the `text-` prefix.
 *
 * **`cn` needs this list and `tailwind-merge` cannot infer it.** See {@link cn}. It is kept
 * exported and in one place because a token added to the CSS and not added here is invisible:
 * the class compiles, the build is clean, and the size is silently dropped at every `cn` call
 * site that also passes a colour. `lib/utils.test.ts` reads both CSS files and fails if the
 * two ever disagree, which is the only thing that actually stops that drift.
 *
 * Both systems are here on purpose. The first ten are the product scale in `globals.css`; the
 * rest are the editorial scale in `marketing-tokens.css`, which is imported into the same
 * stylesheet and so shares the `text-*` namespace and the same hazard.
 */
export const FONT_SIZE_TOKENS = [
  // globals.css — the product scale
  "display-xl",
  "display-lg",
  "display-md",
  "display-sm",
  "title",
  "body-md",
  "body-sm",
  "caption",
  "caption-sm",
  "badge",
  // marketing-tokens.css — the editorial scale
  "display-2xl",
  "editorial-xl",
  "editorial-lg",
  "editorial-md",
  "heading",
  "subheading",
  "body-lg",
] as const;

/**
 * `tailwind-merge`, taught this project's font sizes.
 *
 * Built once at module scope — `extendTailwindMerge` compiles a config, so calling it per
 * `cn` would do that work on every render.
 */
const merge = extendTailwindMerge({
  extend: {
    classGroups: {
      // The group name is tailwind-merge's own, not ours: naming it anything else would add a
      // *new* group rather than extending the one `text-lg` already lives in, and the sizes
      // would still collide with colours.
      "font-size": [{ text: [...FONT_SIZE_TOKENS] }],
    },
  },
});

/**
 * Merge class names, with later Tailwind utilities winning over earlier ones.
 *
 * ## Why this is configured rather than the bare `twMerge`
 *
 * `twMerge` ships with **Tailwind's own** scale hardcoded. Its font-size group is
 * `text-{xs|sm|base|lg|xl|2xl…}` plus arbitrary lengths; its colour group is
 * `text-{anything}`. So out of the box every one of this project's seventeen size tokens —
 * `text-title`, `text-body-sm`, `text-caption`, `text-display-md`, `text-badge` and the rest
 * — was classified as a **colour**, and the last "colour" in the call won. A size and a
 * colour in one `cn` meant the size was gone before it reached the DOM:
 *
 *     cn("text-title font-medium", current ? "text-ink" : "text-muted")
 *     // was → "font-medium text-muted"   ← no size; the element inherited
 *
 * Measured, not suspected, and it did not even need two arguments to happen:
 * `twMerge("text-caption text-muted-soft")` returned `text-muted-soft` on its own.
 *
 * It failed in the worst way available: the class was in the source, the build was clean,
 * lint was clean, and the only symptom was type one step off. **40 call sites** lost a size
 * this way, the shared kit among them — `Chip`, `SegmentedControl`, `Rating`, `SlotChip`,
 * `queue-position-card`.
 *
 * The alternative, and why it is not the fix: putting the size on an element that carries no
 * colour class (which `components/ui/nav-link.tsx` still does) works, but it is a workaround
 * every future call site has to know about, and reordering is not an option — put the size
 * last and it deleted the *colour* instead. `FONT_SIZE_TOKENS` fixes the whole class of bug
 * in one place.
 */
export function cn(...inputs: ClassValue[]) {
  return merge(clsx(inputs));
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
