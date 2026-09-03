/**
 * How each chapter is staged, so the film does not play the same shot 58 times.
 *
 * ## Why this is per chapter and not per step
 *
 * The brief asks for varied, professional composition and warns twice against distracting
 * motion — "excessive effects", "distracting transitions". Those pull in opposite
 * directions, and where you resolve them decides whether the film reads as designed or as
 * restless.
 *
 * A layout that changes every step changes every six seconds, and each change has to move a
 * 413px device across a 1920px frame while somebody is reading a sentence. That is not
 * variety, it is churn.
 *
 * A layout that changes per *chapter* changes seven times, and — this is the part that
 * makes it work — every one of those changes happens **behind the section card**, which is
 * opaque and covers the whole stage for two seconds. So the arrangement is different on the
 * other side of every card, and the move itself is never seen. Variety without a single
 * frame of sliding furniture.
 *
 * ## The exceptions, and why they are exceptions
 *
 * `STEP_LAYOUTS` overrides a single step. It is for the two or three moments in each film
 * that are a beat rather than an instruction — the booking confirmation, the QR code — where
 * the screen deserves to be the whole point for a few seconds. Those land mid-chapter, so
 * the change is carried by the cross-fade already happening at the cut.
 *
 * Use it sparingly. Every entry here is a layout change the viewer *does* see.
 */

import type { GuideAudience } from "./timeline";

/**
 * - `split-left` — device left, words right. The workhorse: it reads first for a
 *   left-to-right audience, and it suits dense screens that need the eye to start on them.
 * - `split-right` — mirrored. Alternating chapters between the two is most of the variety
 *   in the film, and costs nothing in legibility.
 * - `statement` — device stepped back to 88% with the words larger beside it. For chapters
 *   that explain rather than instruct, where the sentence is the subject and the screen is
 *   the evidence.
 * - `gallery` — the fan: a centred device with the chapter's other screens receding on both
 *   sides, flattened and faded, its name at the top. A section opener, used automatically
 *   for the first step of any chapter long enough to have something to fan.
 * - `cluster` — three devices tumbling off the bottom-right corner with the headline left.
 *   The most decorative shot in the film and the least readable, so it is used once per
 *   walkthrough and everything it needs to say is in the headline.
 */
export type GuideLayout =
  | "split-left"
  | "split-right"
  | "statement"
  | "gallery"
  | "cluster";

/**
 * One layout per chapter, in order. Indexed by chapter, so a chapter added without a layout
 * fails the test rather than silently inheriting its neighbour's.
 *
 * Both films open and close on `statement` — the first chapter is the pitch and the last is
 * the wrap-up, and neither is a step-by-step instruction. The middle alternates, so no two
 * adjacent chapters share an arrangement.
 */
export const CHAPTER_LAYOUTS: Record<GuideAudience, readonly GuideLayout[]> = {
  customer: [
    "statement", // Welcome to Tho
    "split-left", // Getting started
    "split-right", // Finding a salon
    "split-left", // Booking an appointment
    "statement", // Walking in
    "cluster", // Bookings and messages
    "split-left", // Shop, rewards and your account
  ],
  owner: [
    "statement", // Your salon console
    "split-left", // Your calendar
    "split-right", // The walk-in queue
    "split-left", // Services, products and staff
    "cluster", // Clients and orders
    "split-left", // Growing the salon
    "statement", // Settings and your plan
  ],
};

/**
 * The handful of steps that override their chapter, keyed by frame.
 *
 * Both of these are moments the viewer should sit with rather than be instructed through:
 * the confirmation that the booking worked, and the code a salon puts on its counter.
 */
export const STEP_LAYOUTS: Record<string, GuideLayout> = {
  "customer/22c-booking-confirmed": "statement",
  "owner/57-queue-qr": "statement",
};

/**
 * How each arrangement holds the device in space.
 *
 * Taken from the reference film rather than invented. Two things in it are worth copying
 * and one is worth refusing:
 *
 * - **The device is never still.** It travels slowly and continuously across every shot,
 *   and cuts happen *behind* it, so the film never stops moving. `stage.ts` drives that
 *   from absolute `t` rather than from step-local time, so it carries through cuts instead
 *   of snapping back at every one.
 * - **It is usually turned slightly**, sitting in space rather than pasted flat on a page.
 * - But the reference tilts *hard*, twenty degrees and more, and it can afford to: it is a
 *   marketing film and nobody has to read the screen. This is a walkthrough whose whole job
 *   is that you can read the screen, so the instructional layouts stay nearly flat, and
 *   only `statement` — where the sentence carries and the screen is evidence for it — takes
 *   a real angle.
 */
export type LayoutSpec = {
  /** Size relative to the stage's device box. */
  scale: number;
  /** Degrees about the vertical axis. Negative turns the device's left edge away. */
  tiltY: number;
  /** Degrees in the plane. A fraction of one is enough to stop it looking pasted on. */
  tiltZ: number;
  /**
   * Whether this layout lets the camera push in on the device. Defaults to true.
   *
   * The push scales the device about the step's own hotspot, so how far the device grows
   * *upward* depends on where in the screen that hotspot sits: a control near the bottom
   * pins the origin low and lifts the top edge by nearly the whole of the growth.
   *
   * That is invisible in the layouts whose chrome sits beside the device, and fatal in the
   * one whose chrome sits above it. Sizing `gallery` against a static device was not
   * enough — a step whose hotspot was a bottom-corner button lifted the top edge 58px into
   * the caption. Holding the camera still here is also the honest reading of the shot: it
   * is a breath between the card and the instruction, and it has nothing to push toward.
   */
  push?: boolean;
};

export const LAYOUT_SPECS: Record<GuideLayout, LayoutSpec> = {
  // Turned very slightly toward its own text column, the direction the eye is already
  // travelling. Small enough that no app label keystones out of legibility.
  "split-left": { scale: 1, tiltY: -3.5, tiltZ: -0.6 },
  "split-right": { scale: 1, tiltY: 3.5, tiltZ: 0.6 },
  // The one instructional shot allowed to look like a photograph of a phone.
  statement: { scale: 0.88, tiltY: -9, tiltZ: -1.4 },
  // Upright and square to the camera: it is the subject of its own shot, and the fanned
  // screens beside it supply all the depth the frame needs. Stepped back to 0.82 so the
  // caption above it has somewhere to sit — at 0.9 the device's top edge reached 141px and
  // ran straight through the title.
  gallery: { scale: 0.82, tiltY: 0, tiltZ: 0, push: false },
  // Turned hard and running off the corner. Legibility is not this shot's job.
  cluster: { scale: 0.94, tiltY: -14, tiltZ: -19 },
};

/**
 * A chapter needs this many steps before its opening one becomes a fan.
 *
 * The fan stands four of the chapter's *other* screens beside the current one. Below four
 * it starts repeating them, and a fan of the same screen four times is worse than no fan.
 */
export const FAN_MINIMUM = 5;

/**
 * The arrangement for a step.
 *
 * Three rules, in order of who wins:
 *
 * 1. A hand-picked step overrides everything — the two beats in `STEP_LAYOUTS`.
 * 2. The **first step of a long enough chapter** opens on the fan. That is the reference
 *    film's rhythm: name the section, show what is in it, then explain one thing at a time.
 *    It falls out of the step's position rather than being listed per chapter, so a chapter
 *    that gains or loses steps gets the right treatment without anyone remembering to.
 * 3. Otherwise the chapter's own arrangement.
 */
export function layoutFor(
  audience: GuideAudience,
  chapterIndex: number,
  frame: string,
  positionInChapter = -1,
  chapterLength = 0,
): GuideLayout {
  const override = STEP_LAYOUTS[frame];
  if (override) return override;

  const chapter = CHAPTER_LAYOUTS[audience][chapterIndex];
  if (!chapter) throw new Error(`no layout for ${audience} chapter ${chapterIndex}`);

  // The cluster is already a wide, decorative shot; opening it with a fan would be two
  // scene-setting beats in a row before anything is explained.
  if (positionInChapter === 0 && chapterLength >= FAN_MINIMUM && chapter !== "cluster") {
    return "gallery";
  }
  return chapter;
}
