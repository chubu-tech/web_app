import type { GuideAudience } from "./timeline";

/**
 * What the launcher needs to name a guide, without loading the guide.
 *
 * `GuideLauncher` is mounted by all three shells and renders on every page; the player behind
 * it is `next/dynamic`, so nothing about the film is fetched until somebody presses the
 * button. Importing `GUIDES` for an accessible name defeats exactly that — `guides.ts` is
 * 27 KB of narration for two films, and it would land in the shared client bundle of every
 * route, including the public marketing pages, so that a button could read three scalars off
 * it.
 *
 * So the three scalars live here as literals, in a module that imports **no** guide data —
 * the `GuideAudience` above is a type-only import and erases. `guides.test.ts` asserts each
 * summary still matches the guide it describes, which is what stops a literal drifting from
 * the thing it summarises.
 *
 * ## Chapters, not steps
 *
 * The previous version of this counted steps, because the previous guide was a slideshow and
 * a step was a thing you clicked through. A film has no steps a viewer can perceive — it has
 * chapters, announced by a card on screen. Saying "30 steps" about something nobody steps
 * through describes the build rather than the thing.
 */
export type GuideSummary = {
  title: string;
  /** Chapters in the film, each opening with its own card. */
  chapters: number;
  /**
   * `About N min`, rounded to the nearest minute rather than up.
   *
   * The owner film runs 4m11s, and rounding up called that "About 5 min" — a fifth longer
   * than it is, on the one number a visitor uses to decide whether they have time now.
   */
  runLabel: string;
};

export const GUIDE_SUMMARIES: Record<GuideAudience, GuideSummary> = {
  customer: { title: "How Tho works", chapters: 7, runLabel: "About 5 min" },
  owner: { title: "How the salon console works", chapters: 7, runLabel: "About 4 min" },
};

/** `About 5 min`. The rule the summaries above are checked against. */
export function guideRunLabel(seconds: number): string {
  return `About ${Math.round(seconds / 60)} min`;
}
