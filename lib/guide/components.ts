/**
 * Every captured UI component and the size it renders at.
 *
 * **Generated. Do not edit by hand** — `python scripts/import-app-components.py` rewrites
 * this whole file from `../tho/app/docs/screenshots/components/`, and anything typed here
 * is lost on the next run.
 *
 * Sizes are in CSS pixels: the Dart harness captures at 3x so the stage can scale a
 * component without softening it, and the importer divides back down so nothing downstream
 * has to know that.
 *
 * The split from `floaters.ts` is the point: this file is *measurement*, that one is
 * *choice*. A re-capture resizes every component here without touching a decision there.
 */
export type ComponentBox = { w: number; h: number };

export const COMPONENTS: Record<string, ComponentBox> = {
  "avatar": { w: 72, h: 72 },
  "booking-card": { w: 380, h: 114 },
  "button-book": { w: 360, h: 64 },
  "loyalty-ring": { w: 148, h: 148 },
  "order-collected": { w: 77, h: 21 },
  "order-new": { w: 49, h: 21 },
  "order-ready": { w: 59, h: 21 },
  "pill-cancelled": { w: 80, h: 21 },
  "pill-completed": { w: 85, h: 21 },
  "pill-confirmed": { w: 83, h: 21 },
  "queue-free": { w: 199, h: 31 },
  "queue-wait": { w: 155, h: 31 },
  "rating": { w: 61, h: 18 },
  "salon-card": { w: 320, h: 236 },
  "section-header": { w: 360, h: 60 },
  "slot": { w: 140, h: 15 },
  "slot-selected": { w: 140, h: 15 },
  "stylist-tile": { w: 300, h: 108 },
};
