import type { GuideAudience } from "./steps";

/**
 * What the launcher needs to name a guide, without loading the guide.
 *
 * `GuideLauncher` is mounted by all three shells and renders on every page; the player behind
 * it is `next/dynamic`, so the sixteen frames and their copy are only fetched once somebody
 * presses the button. Importing `GUIDES` for an accessible name defeated exactly that — the
 * whole of `steps.ts` (both guides, every title, body and alt) landed in the shared client
 * bundle of every route, including the public marketing pages, while the launcher read three
 * scalars off it.
 *
 * So the three scalars live here, as literals, in a module that imports **no** step data —
 * the `GuideAudience` import above is type-only and erases. `steps.test.ts` asserts each
 * summary still matches the guide it describes, which is what stops a literal drifting from
 * the thing it summarises.
 */
export type GuideSummary = {
  title: string;
  steps: number;
  /** `guideRunLabel(guide)` — "About 3 min". */
  runLabel: string;
};

export const GUIDE_SUMMARIES: Record<GuideAudience, GuideSummary> = {
  customer: { title: "How Tho works", steps: 16, runLabel: "About 3 min" },
  owner: { title: "How the salon console works", steps: 16, runLabel: "About 3 min" },
};
