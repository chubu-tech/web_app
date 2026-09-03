/**
 * The walkthrough as data on a single time axis, and the pure function that
 * reads it.
 *
 * ## Why this exists
 *
 * There are two renderers: the live stage in `components/guide/` and the
 * headless MP4 pass in `scripts/render-guide.py`. If each owned its own motion
 * design the video would drift from the site the first time either was touched,
 * and the drift would be invisible until someone watched both. So the motion is
 * written once, here, as arithmetic:
 *
 *     visual state = stateAt(timeline, t)
 *
 * The live player drives `t` from a clock. The renderer sets `t` and
 * screenshots. Neither knows anything the other does not, which is the only
 * reason the MP4 is nearly free.
 *
 * That constraint is also why nothing in this file reads a clock, a random
 * number, the DOM or `window`. Same `t`, same picture, forever — which is what
 * makes seeking, scrubbing and frame-accurate rendering all the same operation.
 *
 * ## The one geometric trick worth knowing
 *
 * The camera pushes in on the highlighted control by setting the frame's
 * `transform-origin` **to the centre of the hotspot** and scaling up. Two things
 * fall out of that, and both matter:
 *
 * 1. The hotspot's centre does not move. So the ring, the tap ripple and the
 *    callout can be positioned from the *untransformed* hotspot percentages and
 *    they track the zoom for free — no pan arithmetic, nothing to keep in sync.
 * 2. Scale is always >= 1, so the frame's edges only ever travel outward. The
 *    stage background can never show through, at any origin, at any zoom.
 *
 * The ring and callout therefore live **outside** the transformed layer: the
 * ring's stroke stays one pixel and the callout's text stays crisp, instead of
 * both being magnified along with the screenshot. Only the box's width
 * and height need scaling, which `scaleBox` does analytically.
 *
 * ## What is not here
 *
 * Timing of *narration*. A step's `hold` is the planned duration, used by the
 * progress bar and by every frame of the MP4. At run time the voice's own `end`
 * event may land a little either side of it; the player stalls `t` rather than
 * cutting a sentence off. That belongs to the player, not to the timeline, and
 * the estimate in `narration.ts` is deliberately generous so the stall is rare.
 */

import { HOTSPOTS, type HotspotBox } from "./hotspots";
import { estimateSpeechSeconds } from "./narration";

export type { HotspotBox };

/**
 * Who a guide is for. Deliberately not the same union as the app's `role`:
 * `staff` has a role but no walkthrough, and the marketing site picks an
 * audience from the route with no session at all.
 */
export type GuideAudience = "customer" | "owner";

export type GuideStep = {
  /** Frame path under `public/guide/app/`, without extension, and the hotspot key. */
  frame: string;
  /** Short heading for the callout. Sentence case, no full stop. */
  title: string;
  /** One or two lines beside the highlight. May only claim what the frame shows. */
  body: string;
  /** Spoken line. Written for the ear; must describe this frame and no other. */
  narration: string;
  /**
   * A recorded clip under `public/guide/voice/`, when one exists. Its own
   * duration wins over the estimate, which is the whole drop-in point for
   * ElevenLabs: fill this in and no timing code changes.
   */
  audio?: string;
  /** Override the computed hold, in seconds. Use sparingly — the estimate is usually right. */
  seconds?: number;
  /**
   * How far the camera pushes in on this step's hotspot, overriding [ZOOM_TO].
   *
   * The default is a gentle emphasis, which is right when the ringed control
   * sits on a screen whose surroundings help explain it. It is wrong when the
   * point of the step is one panel and the rest of the screen is noise — the
   * owner's Insights is the case that forced this: its Today card is the thing
   * being taught, while the cards beneath it report a month-to-date comparison
   * that is meaningless two days into a month. Pushing in past them keeps the
   * frame about the feature.
   *
   * Clamped to >= 1. Below 1 the frame would shrink inside the stage and the
   * background would show through its edges, which no amount of intent makes
   * acceptable.
   */
  zoom?: number;
  /**
   * Drop this step's highlight, even though `hotspots.ts` measured one for the frame.
   *
   * The capture harness rings whichever widget the walk pointed it at, and once in a
   * while that is not the control the step is about. `auth/01-onboarding` is the case
   * that forced this: its measured rect is the **Skip** pill, and a walkthrough whose
   * very first instruction circles "Skip" teaches the opposite of what it means to.
   *
   * Dropping the ring is the honest answer rather than moving it by hand — a frame with
   * no highlight still teaches, and a highlight on the wrong control lies. Where a ring
   * genuinely belongs somewhere the harness never measured, `hotspots.manual.json` is
   * the place for it; this flag is for when the right answer is *no ring at all*.
   *
   * The camera push and the tap go with it, because both are derived from the hotspot:
   * with nothing highlighted there is nothing to push in on and nothing to press.
   */
  ring?: false;
  /**
   * Whether to play a tap ripple on the hotspot.
   *
   * Defaults to `true` whenever the step has a hotspot, because in this guide a
   * highlighted control is nearly always one you press. Set `false` for a ring
   * that points at something informational — a status badge, a price, a count —
   * where a tap indicator would be an instruction the app cannot honour.
   */
  tap?: boolean;
};

export type GuideChapter = {
  /** Shown on the section card. Two or three words. */
  title: string;
  steps: GuideStep[];
};

export type Guide = {
  audience: GuideAudience;
  title: string;
  chapters: GuideChapter[];
};

/** One step, resolved onto the absolute `t` axis. */
export type TimelineStep = {
  step: GuideStep;
  /** Index across the whole guide, not within the chapter. */
  index: number;
  chapterIndex: number;
  /** Start of this step, including its section card if it opens a chapter. */
  start: number;
  end: number;
  /** `cardSeconds + hold`. */
  duration: number;
  /** Section card at the head of this step, or 0 when it does not open a chapter. */
  cardSeconds: number;
  /** How long the frame itself is held, after any card. */
  hold: number;
  /** The measured rect for this frame, or null — a frame with no ring still teaches. */
  hotspot: HotspotBox | null;
  /** Resolved from `step.tap` and whether there is anywhere to put it. */
  tap: boolean;
  /** Scale the camera settles at: `step.zoom`, or the default for this frame. */
  zoom: number;
  /** Whether the frame changes here, and so needs a cross-fade rather than a cut. */
  fadeIn: boolean;
};

export type TimelineChapter = {
  title: string;
  index: number;
  start: number;
  end: number;
  /** Absolute index of this chapter's first step, for the progress bar's segments. */
  firstStep: number;
  stepCount: number;
};

export type Timeline = {
  audience: GuideAudience;
  title: string;
  steps: TimelineStep[];
  chapters: TimelineChapter[];
  duration: number;
};

/**
 * Every duration in the walkthrough, in seconds, in one place.
 *
 * The brief asks for motion that improves understanding and warns twice against
 * slow animations that waste time. Everything here is under half a second except
 * the section card and the camera push, which are the two things the eye is
 * meant to follow rather than merely absorb.
 */
export const TIMING = {
  /** A section card, start to finish. Long enough to read three words. */
  card: 2,
  cardIn: 0.35,
  cardOut: 0.4,
  /** Cross-fade between two different app screens. */
  frameIn: 0.35,
  /** The ring appears after the screen has settled, not with it. */
  ringAt: 0.45,
  ringIn: 0.4,
  /** The tap lands after the ring, so the eye is already in the right place. */
  tapAt: 0.9,
  tapDur: 0.7,
  calloutAt: 0.75,
  calloutIn: 0.35,
  calloutOut: 0.3,
  /** The camera starts moving once the ring is on its way in. */
  zoomAt: 0.5,
  zoomDur: 1.8,
  /** Silence after the narration ends, so a step does not cut on the last syllable. */
  tail: 0.9,
  /** No step is ever a flash, however short its line. */
  minStep: 3.2,
} as const;

/**
 * How far the camera pushes in on a highlighted control.
 *
 * **This number is bounded by arithmetic, not by taste.** Scaling about an origin crops the
 * frame by `100 * (1 - 1/scale)` percent in total, split between the two edges in proportion
 * to where the origin sits — so a control near one edge loses almost all of that crop from
 * the opposite side. The app lays its screens out on a 16dp margin, about 4.4% of the
 * frame's width, and once the crop exceeds that margin the push starts cutting body text
 * through the middle of a glyph. That does not read as a camera move; it reads as a broken
 * layout, which is worse than no push at all.
 *
 * At 1.16 the total crop was 13.8%, and the first render of `customer/08-filters` — whose
 * hotspot centre sits at 70% — lost 40px off the left and clipped "Service Category" to
 * "rvice Category". At 1.08 the total is 7.4%, which keeps the worst case inside the app's
 * own margin while still being a visible push when the ring pops with it.
 *
 * If the frames are ever re-captured at a different aspect or the stage gives the device
 * more room, re-derive it from that formula rather than nudging it by eye.
 */
export const ZOOM_TO = 1.08;

/**
 * How far the camera drifts on a frame with no highlight.
 *
 * Three percent over a step is a breath, not a zoom — enough that a held screen
 * is not a still photograph, far short of the "random zooms" the brief rules
 * out. Dropped entirely under `prefers-reduced-motion`.
 */
export const DRIFT_TO = 1.03;

const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value);

const clamp = (value: number, low: number, high: number) =>
  value < low ? low : value > high ? high : value;

/** Decelerating, the shape every entrance here uses. */
const easeOut = (progress: number) => 1 - (1 - progress) ** 3;

/**
 * Float noise, snapped away.
 *
 * Every `local` here is a difference of two accumulated times, so a ramp that
 * should land exactly on 1 lands on 1 - 1e-15 instead. Left alone that is not a
 * rounding curiosity: `opacity < 1` stays true, and the stage keeps mounting a
 * completely transparent copy of the previous screen — a second 1080-wide image
 * in the DOM, and one more layer for the renderer to composite, forever. A
 * billionth is far below anything an eye or an encoder can tell apart.
 */
const EPSILON = 1e-9;

/** 0 before `at`, 1 after `at + span`, linear between. A zero span is a switch. */
function ramp(local: number, at: number, span: number): number {
  if (span <= 0) return local >= at ? 1 : 0;
  const progress = clamp01((local - at) / span);
  if (progress < EPSILON) return 0;
  if (progress > 1 - EPSILON) return 1;
  return progress;
}

/** Keeps accumulated starts exact enough to compare — 0.1 + 0.2 is otherwise 0.30000000000000004. */
const round3 = (value: number) => Math.round(value * 1000) / 1000;

/**
 * How long to hold a step's frame.
 *
 * The narration decides, because the picture exists to be talked over: a step
 * that outlives its sentence is a pause, and one that ends inside it is a
 * mistake. `seconds` overrides for the few steps that are looked at rather than
 * explained, and the floor applies to both — nothing in this guide flashes past.
 */
function stepHold(step: GuideStep): number {
  const spoken = step.seconds ?? estimateSpeechSeconds(step.narration) + TIMING.tail;
  return Math.max(TIMING.minStep, Math.round(spoken * 10) / 10);
}

/**
 * Lay a guide out on the `t` axis.
 *
 * Hotspots are resolved once, here, so `stateAt` is pure over the timeline and
 * never touches the generated geometry. A frame whose key is missing from
 * `hotspots.ts` gets no ring rather than a guessed one.
 */
export function buildTimeline(guide: Guide): Timeline {
  if (guide.chapters.length === 0) {
    throw new Error(`guide "${guide.title}" has no chapters`);
  }

  const steps: TimelineStep[] = [];
  const chapters: TimelineChapter[] = [];
  let t = 0;

  guide.chapters.forEach((chapter, chapterIndex) => {
    if (chapter.steps.length === 0) {
      // Silently dropping it would leave a section card with nothing behind it
      // and a progress segment of zero width. This is an authoring slip, and it
      // should fail in the test run rather than on the stage.
      throw new Error(`chapter "${chapter.title}" has no steps`);
    }

    const chapterStart = t;
    const firstStep = steps.length;

    chapter.steps.forEach((step, withinChapter) => {
      const previous = steps[steps.length - 1];
      const hotspot = step.ring === false ? null : (HOTSPOTS[step.frame] ?? null);
      const cardSeconds = withinChapter === 0 ? TIMING.card : 0;
      const hold = stepHold(step);
      const duration = round3(cardSeconds + hold);

      steps.push({
        step,
        index: steps.length,
        chapterIndex,
        start: t,
        end: round3(t + duration),
        duration,
        cardSeconds,
        hold,
        hotspot,
        tap: hotspot !== null && (step.tap ?? true),
        zoom: Math.max(1, step.zoom ?? (hotspot ? ZOOM_TO : DRIFT_TO)),
        // A card is itself the transition, so the frame beneath it does not also
        // need one; and two steps that sit on the same screen must not blink.
        fadeIn: cardSeconds === 0 && previous?.step.frame !== step.frame,
      });

      t = round3(t + duration);
    });

    chapters.push({
      title: chapter.title,
      index: chapterIndex,
      start: chapterStart,
      end: t,
      firstStep,
      stepCount: chapter.steps.length,
    });
  });

  return {
    audience: guide.audience,
    title: guide.title,
    steps,
    chapters,
    duration: t,
  };
}

/** Which step is on screen at `t`. Out-of-range `t` clamps to the ends. */
export function stepIndexAt(timeline: Timeline, t: number): number {
  const target = clamp(t, 0, timeline.duration);
  let low = 0;
  let high = timeline.steps.length - 1;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (target < timeline.steps[mid]!.end) high = mid;
    else low = mid + 1;
  }
  return low;
}

/** Where `t` must be to start a given step. Used by the transport's step buttons. */
export function stepStart(timeline: Timeline, index: number): number {
  const bounded = clamp(Math.trunc(index), 0, timeline.steps.length - 1);
  return timeline.steps[bounded]!.start;
}

/** The frame layer's transform: a push in on the hotspot, or a drift on the frame. */
type Camera = { scale: number; originX: number; originY: number };

function cameraAt(entry: TimelineStep, frameLocal: number, reduced: boolean): Camera {
  const { hotspot } = entry;
  const originX = hotspot ? hotspot.x + hotspot.w / 2 : 50;
  const originY = hotspot ? hotspot.y + hotspot.h / 2 : 50;
  if (reduced) return { scale: 1, originX, originY };

  const progress = easeOut(ramp(frameLocal, TIMING.zoomAt, TIMING.zoomDur));
  return { scale: 1 + (entry.zoom - 1) * progress, originX, originY };
}

/**
 * The hotspot as it appears on screen once the camera has pushed in.
 *
 * Because the origin *is* this box's centre, the centre is a fixed point of the
 * transform: only the width and height change. That is the whole calculation,
 * and it is why the ring can sit outside the scaled layer.
 */
function scaleBox(box: HotspotBox, scale: number): HotspotBox {
  const w = box.w * scale;
  const h = box.h * scale;
  return {
    x: box.x + box.w / 2 - w / 2,
    y: box.y + box.h / 2 - h / 2,
    w,
    h,
  };
}

/** A screenshot layer. Coordinates are percentages of the frame. */
export type FrameLayer = {
  /** Path under `public/guide/app/`, without extension. */
  src: string;
  opacity: number;
  scale: number;
  originX: number;
  originY: number;
};

export type GuideState = {
  /** Clamped into `[0, duration]`. */
  t: number;
  duration: number;
  /** 0..1 across the whole walkthrough, for the progress bar. */
  progress: number;
  index: number;
  step: GuideStep;
  entry: TimelineStep;
  chapter: TimelineChapter;
  /** The current screen. */
  frame: FrameLayer;
  /** The screen being left, only during a cross-fade. */
  previous: FrameLayer | null;
  /** The highlight, already adjusted for the camera. */
  ring: {
    box: HotspotBox;
    opacity: number;
    /** A settle-in pop, about the ring's own centre. 1 under reduced motion. */
    scale: number;
  } | null;
  /**
   * Where the finger lands, in frame percentages.
   *
   * Non-null from the moment of the tap to the end of the step, so the stage
   * always has an anchor for the dot; `progress` is the ripple, 0 to 1, and sits
   * at 1 — finished — under reduced motion, leaving the dot and no expansion.
   */
  tap: { x: number; y: number; progress: number } | null;
  callout: {
    title: string;
    body: string;
    opacity: number;
    /** Pixels it rises through on entry. 0 under reduced motion. */
    lift: number;
    /**
     * Where to pin it, or null when this frame has no highlight — then the stage
     * places it in its own default spot rather than at a made-up coordinate.
     */
    anchor: { x: number; y: number; side: "above" | "below" } | null;
  } | null;
  /** The section card, while it is over the stage. */
  card: { title: string; number: number; of: number; opacity: number } | null;
};

/**
 * The complete visual state at `t`. The only thing either renderer calls.
 *
 * `reduced` is `prefers-reduced-motion`: it removes the camera move, the ripple
 * and every fade, but not the guide. Narration is untouched by it — speech is
 * not motion, and it may be exactly what the person is relying on.
 */
export function stateAt(
  timeline: Timeline,
  t: number,
  options: { reduced?: boolean } = {},
): GuideState {
  const reduced = options.reduced === true;
  const clamped = clamp(t, 0, timeline.duration);
  const index = stepIndexAt(timeline, clamped);
  const entry = timeline.steps[index]!;
  const chapter = timeline.chapters[entry.chapterIndex]!;
  const { step } = entry;

  const local = clamped - entry.start;
  const frameLocal = Math.max(0, local - entry.cardSeconds);
  const camera = cameraAt(entry, frameLocal, reduced);

  // A card is opaque over the stage, so the frame beneath it fades up during the
  // card's own exit and is fully there the moment the card clears.
  const frameOpacity =
    entry.cardSeconds > 0
      ? ramp(local, Math.max(0, entry.cardSeconds - TIMING.frameIn), reduced ? 0 : TIMING.frameIn)
      : entry.fadeIn
        ? ramp(frameLocal, 0, reduced ? 0 : TIMING.frameIn)
        : 1;

  const frame: FrameLayer = {
    src: step.frame,
    opacity: frameOpacity,
    scale: camera.scale,
    originX: camera.originX,
    originY: camera.originY,
  };

  let previous: FrameLayer | null = null;
  if (entry.fadeIn && frameOpacity < 1 && index > 0) {
    const leaving = timeline.steps[index - 1]!;
    const held = cameraAt(leaving, leaving.hold, reduced);
    previous = {
      src: leaving.step.frame,
      opacity: 1 - frameOpacity,
      scale: held.scale,
      originX: held.originX,
      originY: held.originY,
    };
  }

  let ring: GuideState["ring"] = null;
  if (entry.hotspot) {
    const appeared = ramp(frameLocal, TIMING.ringAt, reduced ? 0 : TIMING.ringIn);
    if (appeared > 0) {
      const eased = easeOut(appeared);
      ring = {
        box: scaleBox(entry.hotspot, camera.scale),
        opacity: eased,
        scale: reduced ? 1 : 1 + (1 - eased) * 0.22,
      };
    }
  }

  let tap: GuideState["tap"] = null;
  if (entry.tap && entry.hotspot && frameLocal >= TIMING.tapAt) {
    tap = {
      x: entry.hotspot.x + entry.hotspot.w / 2,
      y: entry.hotspot.y + entry.hotspot.h / 2,
      progress: reduced ? 1 : ramp(frameLocal, TIMING.tapAt, TIMING.tapDur),
    };
  }

  let callout: GuideState["callout"] = null;
  if (step.body) {
    const entering = ramp(frameLocal, TIMING.calloutAt, reduced ? 0 : TIMING.calloutIn);
    const leaving = ramp(
      frameLocal,
      entry.hold - TIMING.calloutOut,
      reduced ? 0 : TIMING.calloutOut,
    );
    const opacity = Math.min(entering, 1 - leaving);
    if (opacity > 0) {
      const eased = easeOut(entering);
      callout = {
        title: step.title,
        body: step.body,
        opacity,
        lift: reduced ? 0 : (1 - eased) * 8,
        anchor: entry.hotspot
          ? {
              x: entry.hotspot.x + entry.hotspot.w / 2,
              y: entry.hotspot.y + entry.hotspot.h / 2,
              // Below the halfway mark there is no room underneath, and a
              // callout hanging off the bottom of a phone is the single most
              // common way this kind of thing looks unfinished.
              side: entry.hotspot.y + entry.hotspot.h / 2 > 55 ? "above" : "below",
            }
          : null,
      };
    }
  }

  let card: GuideState["card"] = null;
  if (entry.cardSeconds > 0 && local < entry.cardSeconds) {
    const entering = ramp(local, 0, reduced ? 0 : TIMING.cardIn);
    const leaving = ramp(
      local,
      entry.cardSeconds - TIMING.cardOut,
      reduced ? 0 : TIMING.cardOut,
    );
    card = {
      title: chapter.title,
      number: entry.chapterIndex + 1,
      of: timeline.chapters.length,
      opacity: Math.min(entering, 1 - leaving),
    };
  }

  return {
    t: clamped,
    duration: timeline.duration,
    progress: timeline.duration > 0 ? clamped / timeline.duration : 0,
    index,
    step,
    entry,
    chapter,
    frame,
    previous,
    ring,
    tap,
    callout,
    card,
  };
}
