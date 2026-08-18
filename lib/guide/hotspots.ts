/**
 * Where each guide highlight sits, as percentages of its frame.
 *
 * **Generated. Do not edit by hand** — `python scripts/measure-guide-hotspots.py` rewrites
 * this whole file from the running app, and anything typed in here is lost on the next run.
 *
 * The split is the point: this file is *geometry*, `steps.ts` is *words*. Each step names
 * what it points at once, as a DOM expression in the measuring script, and that one
 * definition is measured against both the 1280x800 and the 390x844 layouts — because the
 * same control is in a different place in each, and eyeballing it twice is guessing twice.
 * A re-capture can therefore move every ring in the product without touching a sentence.
 *
 * A key with no entry yields no highlight, which is the honest failure: a frame with no ring
 * still teaches, and a ring in the wrong place lies.
 *
 * Keys are the frame's path under `public/guide/`, without the extension.
 */
export type HotspotBox = { x: number; y: number; w: number; h: number };

export const HOTSPOTS: Record<string, HotspotBox> = {};
