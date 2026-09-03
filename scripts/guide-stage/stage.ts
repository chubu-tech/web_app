/**
 * The stage's only job: turn `stateAt(timeline, t)` into pixels, and nothing else.
 *
 * ## Why there is no motion code here
 *
 * Every number this file writes to the DOM comes out of `stateAt`. It reads no clock, holds
 * no animation state, and there is not a single CSS transition on the page. That is what
 * makes `seek(t)` idempotent: the same `t` produces the same picture forever, which is the
 * property the whole render depends on — a screenshot taken at `t` is *the* frame at `t`,
 * not "whatever the browser had finished animating by then".
 *
 * It also means the film and any future live player cannot drift apart, because neither
 * owns the motion. `lib/guide/timeline.ts` explains the arrangement at length.
 *
 * ## Why every image is decoded before the first seek
 *
 * A screenshot does not wait for a pending image. One undecoded frame is one blank phone in
 * the middle of the film, and it would look exactly like a design choice. So `init` loads
 * and decodes all of them up front and only then reports ready; there are 30-odd per guide
 * and they are already on local disk, so this costs a second and removes a whole class of
 * silent corruption.
 *
 * ## Exposed surface
 *
 * `window.__stage` — `init(audience)`, `seek(t)`, `duration`, `steps`. The renderer drives
 * those four and needs nothing else.
 */

import { GUIDES } from "../../lib/guide/guides";
import { COMPONENTS } from "../../lib/guide/components";
import { floatersFor } from "../../lib/guide/floaters";
import { LAYOUT_SPECS, layoutFor } from "../../lib/guide/layouts";
import { FRAME_MASKS } from "../../lib/guide/masks";
import {
  TIMING,
  buildTimeline,
  stateAt,
  type GuideAudience,
  type Timeline,
} from "../../lib/guide/timeline";

/**
 * The screen box inside the bezel, in video pixels — **measured, not declared.**
 *
 * These were two literals with a comment saying they must match `stage.html`, which is the
 * kind of coupling that holds right up until it does not: the stylesheet was resized once
 * during Phase B and nothing here would have noticed, leaving every ring and every tap
 * offset by the difference with no error anywhere.
 *
 * Reading the element instead makes the stylesheet the single source of the geometry. Both
 * are filled by `init` before the first `seek`.
 */
let SCREEN_W = 0;
let SCREEN_H = 0;
let DEVICE_W = 0;
let DEVICE_H = 0;
let BEZEL = 0;

/**
 * How far the ring sits outside its measured rectangle, in video pixels.
 *
 * The Flutter harness measures the widget it was pointed at, and for a button that widget
 * is the `Text` inside it, not the button — `rect()` in `tho/app/integration_test/
 * guide_harness.dart` takes `tester.getRect(target)` of the finder, and the finders are
 * mostly `find.text(...)`. Ringed tight, "Book Appointment" gets a box around the *words*
 * with the coral button visibly extending past it on all four sides, which reads as a
 * mistake.
 *
 * A uniform pad is the honest correction: it does not move the highlight or guess at a
 * shape, it just stops the stroke cutting through the control it is naming. Asymmetric
 * because text sits in a box that is proportionally much taller than it is wider.
 */
const RING_PAD_X = 8;
const RING_PAD_Y = 10;

/**
 * The continuous float, and why it is driven by absolute `t`.
 *
 * The reference film's device is never still: it travels slowly through every shot, and
 * scenes change *behind* it, so nothing in the frame ever comes to a stop. That is the
 * single biggest difference between a product film and a slideshow, and this stage was a
 * slideshow — the device sat at one coordinate for the whole of every step.
 *
 * Two ways to fix that, and only one of them works. Driving the travel from step-local time
 * restarts it at every cut, so the device snaps back to its origin thirty times a film.
 * Driving it from **absolute** `t` means it simply keeps going: the position at the end of
 * one step is the position at the start of the next, and the cut passes underneath a device
 * that never paused. Still a pure function of `t`, so every frame remains reproducible.
 *
 * Slow periods, deliberately out of phase with each other, so the path never visibly
 * repeats over five minutes and never reads as an orbit.
 */
const FLOAT = {
  xAmp: 24,
  xRate: 0.107,
  yAmp: 13,
  yRate: 0.071,
  /** Degrees. Under half a degree — felt rather than seen. */
  rollAmp: 0.42,
  rollRate: 0.049,
} as const;

/** How far apart the words of a heading arrive, in seconds. */
const WORD_STAGGER = 0.06;

type El = HTMLElement;
const el = (id: string) => document.getElementById(id) as El;

const nodes = {
  counter: el("counter"),
  stage: el("stage"),
  slot: el("slot"),
  phone: el("phone"),
  cardInner: el("cardInner"),
  cardEdge: el("cardEdge"),
  cardMark: el("cardMark"),
  topLabel: el("topLabel"),
  floaters: [0, 1, 2].map((i) => ({
    box: el(`flt${i}`),
    img: el(`fltImg${i}`) as HTMLImageElement,
  })),
  sats: [0, 1, 2, 3].map((i) => ({
    box: el(`sat${i}`),
    img: el(`satImg${i}`) as HTMLImageElement,
  })),
  prev: el("prev"),
  prevImg: el("prevImg") as HTMLImageElement,
  prevMask: el("prevMask"),
  cur: el("cur"),
  curImg: el("curImg") as HTMLImageElement,
  curMask: el("curMask"),
  ring: el("ring"),
  tap: el("tap"),
  dot: el("dot"),
  ripple: el("ripple"),
  callout: el("callout"),
  eyebrow: el("eyebrow"),
  title: el("title"),
  body: el("body"),
  dots: el("dots"),
  card: el("card"),
  cardNum: el("cardNum"),
  cardName: el("cardName"),
  railFill: el("railFill"),
};

const frameUrl = (src: string) => `/public/guide/app/${src}.webp`;
const componentUrl = (name: string) => `/public/guide/components/${name}.webp`;

/** Mirrors the engine's own easing, so the card's sweep matches everything else on screen. */
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeOut = (p: number) => 1 - (1 - p) ** 3;

let timeline: Timeline | null = null;

/** Chapter index -> step count, so the dot row can be built without re-walking the guide. */
let dotsForChapter: number[] = [];
/** Which chapter the dot row currently shows, so it is only rebuilt when it changes. */
let dotsBuiltFor = -1;

async function preload(urls: readonly string[]): Promise<void> {
  await Promise.all(
    urls.map(
      (url) =>
        new Promise<void>((resolve, reject) => {
          const img = new Image();
          img.onload = () => img.decode().then(() => resolve(), () => resolve());
          img.onerror = () => reject(new Error(`frame failed to load: ${url}`));
          img.src = url;
        }),
    ),
  );
}

/**
 * Paint a frame layer.
 *
 * The mask is inside the transformed layer, so it scales with the screenshot it covers —
 * see `lib/guide/masks.ts` for why two frames need one at all.
 */
function paintLayer(
  layer: El,
  img: HTMLImageElement,
  mask: El,
  frame: { src: string; opacity: number; scale: number; originX: number; originY: number },
) {
  const url = frameUrl(frame.src);
  if (img.getAttribute("src") !== url) img.setAttribute("src", url);

  layer.style.opacity = String(frame.opacity);

  const spec = FRAME_MASKS[frame.src];
  if (spec) {
    mask.style.display = "block";
    mask.style.top = `${spec.fromY}%`;
    mask.style.background = spec.fill;
  } else {
    mask.style.display = "none";
  }
}

/**
 * The other steps of this step's chapter, in order, starting after it and wrapping.
 *
 * The fan and the cluster stand real screens behind the one being explained, and they come
 * from the same chapter for a reason: a chapter is a subject, so its screens belong beside
 * each other. Pulling them from anywhere in the film would put the payroll page behind a
 * booking, which says something untrue about how the app is organised.
 *
 * Wrapping means a short chapter repeats a screen rather than leaving a hole, which is the
 * better failure — an empty slot in a fan reads as a bug.
 */
function chapterSiblings(index: number, chapterIndex: number, want: number): string[] {
  if (!timeline) return [];
  const inChapter = timeline.steps.filter((e) => e.chapterIndex === chapterIndex);
  if (inChapter.length <= 1) return [];
  const at = inChapter.findIndex((e) => e.index === index);
  return Array.from(
    { length: want },
    (_, i) => inChapter[(at + 1 + i) % inChapter.length]!.step.frame,
  );
}

/**
 * Build a line a word at a time, each word rising out of its own mask.
 *
 * Shared by the step headings and the section cards, because they are the same gesture at
 * two sizes and a second copy would have drifted. The DOM is rebuilt only when the words
 * change; every other frame walks the existing spans and moves them, which matters when a
 * heading holds for six seconds at thirty frames a second.
 */
function buildWords(host: HTMLElement, text: string, at: number, frameLocal: number): void {
  if (host.dataset.text !== text) {
    host.dataset.text = text;
    host.replaceChildren(
      ...text.split(" ").flatMap((word, i) => {
        const outer = document.createElement("i");
        const inner = document.createElement("b");
        inner.textContent = word;
        outer.appendChild(inner);
        // A real space between the masks, so the line still wraps normally.
        return i === 0 ? [outer] : [document.createTextNode(" "), outer];
      }),
    );
  }
  host.querySelectorAll<HTMLElement>("i > b").forEach((word, i) => {
    const p = easeOut(clamp01((frameLocal - (at + i * WORD_STAGGER)) / TIMING.calloutIn));
    word.style.opacity = String(p);
    word.style.transform = `translateY(${((1 - p) * 100).toFixed(1)}%)`;
  });
}

function seek(t: number): void {
  if (!timeline) throw new Error("seek before init");
  const s = stateAt(timeline, t);

  /*
    Resolved first, because the device transform below spends it. The arrangement only ever
    changes on a step whose chapter changed — which always opens with a card — or on one of
    the two hand-picked steps in `layouts.ts`, where the cut's own cross-fade carries it.
  */
  const layout = layoutFor(
    timeline.audience,
    s.entry.chapterIndex,
    s.step.frame,
    s.index - s.chapter.firstStep,
    s.chapter.stepCount,
  );
  nodes.stage.dataset.layout = layout;

  /*
    **The camera moves the device, not the picture inside it.**

    `stateAt` describes the push as a scale about the highlighted control, and the obvious
    reading is to apply it to the screenshot inside a fixed screen. That is what this did,
    and it was wrong for one specific reason: scaling about an origin crops the frame by
    `100 * (1 - 1/scale)`, and the app lays its screens out on a 16dp margin — about 4% of
    the frame's width. At 1.08 the push crops 3.9% off the side nearest the control, which
    is the whole margin. Every zoomed step therefore rendered with the app's content jammed
    flat against the inside of the phone, and the device looked broken rather than filmed.

    Applying the same scale and origin to the **device** fixes it exactly: the app keeps the
    margins it was captured with at every zoom level, because nothing is ever cropped. There
    is room to do it because the device is 413x886 inside a 1920x1080 stage — at 1.08 it
    grows to 446x957 and still clears the frame on all four sides.

    Two consequences, both handled below: the ring and the tap are positioned from the
    **unscaled** hotspot, since they now sit inside the element being scaled; and the
    outgoing layer of a cross-fade carries a correction so it keeps its own camera instead
    of snapping to the incoming one.
  */
  /*
    Filled for the two layouts that show them, and left alone otherwise — the CSS hides
    them, but pointing four `img` elements at frames nobody can see would still decode four
    extra 1080-wide images on every step.
  */
  if (layout === "gallery" || layout === "cluster") {
    const want = layout === "gallery" ? 4 : 2;
    const siblings = chapterSiblings(s.index, s.entry.chapterIndex, want);
    nodes.sats.forEach((sat, i) => {
      const frame = siblings[i];
      if (!frame) {
        sat.box.style.visibility = "hidden";
        return;
      }
      sat.box.style.visibility = "visible";
      const url = frameUrl(frame);
      if (sat.img.getAttribute("src") !== url) sat.img.setAttribute("src", url);
    });
  }

  if (layout === "gallery") {
    nodes.topLabel.replaceChildren();
    const chapter = document.createElement("span");
    chapter.className = "tl-chapter";
    chapter.textContent = s.chapter.title;
    const title = document.createElement("span");
    title.className = "tl-title";
    nodes.topLabel.append(chapter, title);
    buildWords(
      title,
      s.step.title,
      TIMING.calloutAt,
      s.t - s.entry.start - s.entry.cardSeconds,
    );
  }

  /*
    Each piece drifts on its own phase, so they separate in depth instead of sliding as one
    plane. The rates are close to the device's but not equal — that difference is the
    parallax, and it is what makes a flat composite read as space.
  */
  if (layout === "statement" || layout === "cluster") {
    const names = floatersFor(timeline.audience, s.entry.chapterIndex);
    nodes.floaters.forEach((f, i) => {
      const name = names[i];
      const size = name ? COMPONENTS[name] : undefined;
      if (!name || !size) {
        f.box.style.visibility = "hidden";
        return;
      }
      f.box.style.visibility = "visible";
      const url = componentUrl(name);
      if (f.img.getAttribute("src") !== url) f.img.setAttribute("src", url);

      /*
        Sized from the component's own capture, never from the slot.

        These range from a 61px rating chip to a 380px booking card. A fixed slot width
        stretched the chip to 250px and crushed the Book button to 190x34 with an unreadable
        label — both distorted, because the slot knew nothing about what was in it.

        A flat 1.15x would keep every proportion but leave the small chips too small to read
        at this distance, so the width is nudged up and then clamped: nothing narrower than
        150px, nothing wider than 360px, which is about the device's own screen. The clamp is
        safe because the Dart harness captures at 3x — even the chip pushed to 150px is still
        supersampled rather than enlarged.
      */
      const width = Math.min(360, Math.max(150, size.w * 1.15));
      f.box.style.width = `${Math.round(width)}px`;
      // The height follows the captured aspect, so a re-capture that reshapes a component
      // cannot squash it here.
      f.img.style.aspectRatio = `${size.w} / ${size.h}`;

      const phase = 1 + i * 0.7;
      f.box.style.transform =
        `translate3d(${(Math.sin(s.t * 0.083 * phase) * 17).toFixed(2)}px,` +
        ` ${(Math.cos(s.t * 0.061 * phase) * 21).toFixed(2)}px, 0)` +
        ` rotate(${(Math.sin(s.t * 0.037 * phase) * 1.1).toFixed(3)}deg)`;
      // They arrive with the callout rather than with the frame, so the shot settles before
      // it fills up.
      const local = s.t - s.entry.start - s.entry.cardSeconds;
      f.box.style.opacity = String(
        easeOut(clamp01((local - (TIMING.calloutAt + i * 0.12)) / 0.5)),
      );
    });
  }

  const spec = LAYOUT_SPECS[layout];
  const floatX = Math.sin(s.t * FLOAT.xRate) * FLOAT.xAmp;
  const floatY = Math.cos(s.t * FLOAT.yRate) * FLOAT.yAmp;
  const roll = Math.sin(s.t * FLOAT.rollRate) * FLOAT.rollAmp;
  nodes.slot.style.transform =
    `translateY(-50%) translate3d(${floatX.toFixed(2)}px, ${floatY.toFixed(2)}px, 0)` +
    ` rotateY(${spec.tiltY}deg) rotateZ(${(spec.tiltZ + roll).toFixed(3)}deg)` +
    ` scale(${spec.scale})`;

  const originX = ((BEZEL + (s.frame.originX / 100) * SCREEN_W) / DEVICE_W) * 100;
  const originY = ((BEZEL + (s.frame.originY / 100) * SCREEN_H) / DEVICE_H) * 100;
  nodes.phone.style.transformOrigin = `${originX}% ${originY}%`;
  // A layout may hold the camera still — see `push` in `LAYOUT_SPECS`.
  const camScale = spec.push === false ? 1 : s.frame.scale;
  // The slot owns the layout's position and size; this is only the camera.
  nodes.phone.style.transform = `scale(${camScale})`;

  paintLayer(nodes.cur, nodes.curImg, nodes.curMask, s.frame);
  nodes.cur.style.transform = "none";

  if (s.previous) {
    nodes.prev.style.display = "block";
    paintLayer(nodes.prev, nodes.prevImg, nodes.prevMask, s.previous);
    /*
      The device already carries the incoming frame's scale, so the outgoing one only needs
      the difference. Cross-fades finish before the zoom begins (`frameIn` 0.35s against
      `zoomAt` 0.5s), so in practice `s.frame.scale` is 1 here and this resolves to exactly
      the previous step's held camera — which is the point: without it, the outgoing frame
      would snap from its zoomed-in scale back to 1 at the cut.
    */
    nodes.prev.style.transformOrigin = `${s.previous.originX}% ${s.previous.originY}%`;
    nodes.prev.style.transform = `scale(${s.previous.scale / camScale})`;
  } else {
    nodes.prev.style.display = "none";
  }

  // ---- ring ---------------------------------------------------------------
  // The engine pre-scales `s.ring.box` for a camera applied to the picture. Here the camera
  // is on the device and the ring rides along with it, so the *unscaled* rect is the one
  // that lands on the control. Opacity and the settle-in pop still come from `s.ring`.
  const hotspot = s.entry.hotspot;
  if (s.ring && hotspot) {
    const box = hotspot;
    const left = (box.x / 100) * SCREEN_W - RING_PAD_X;
    const top = (box.y / 100) * SCREEN_H - RING_PAD_Y;
    const width = (box.w / 100) * SCREEN_W + RING_PAD_X * 2;
    const height = (box.h / 100) * SCREEN_H + RING_PAD_Y * 2;

    nodes.ring.style.display = "block";
    nodes.ring.style.left = `${left}px`;
    nodes.ring.style.top = `${top}px`;
    nodes.ring.style.width = `${width}px`;
    nodes.ring.style.height = `${height}px`;
    nodes.ring.style.opacity = String(s.ring.opacity);
    // About its own centre, so the settle-in pop does not drag the box off the control.
    nodes.ring.style.transform = `scale(${s.ring.scale})`;
  } else {
    nodes.ring.style.display = "none";
  }

  // ---- tap ----------------------------------------------------------------
  if (s.tap) {
    const x = (s.tap.x / 100) * SCREEN_W;
    const y = (s.tap.y / 100) * SCREEN_H;
    nodes.tap.style.display = "block";
    nodes.tap.style.transform = `translate(${x}px, ${y}px)`;

    // The dot lands immediately and stays; the ripple is the part that travels.
    const p = s.tap.progress;
    const size = 26 + p * 74;
    nodes.ripple.style.width = `${size}px`;
    nodes.ripple.style.height = `${size}px`;
    nodes.ripple.style.opacity = String((1 - p) * 0.85);
    nodes.dot.style.opacity = String(0.35 + (1 - p) * 0.65);
  } else {
    nodes.tap.style.display = "none";
  }

  // ---- words --------------------------------------------------------------
  // Only the sentence fades. The eyebrow and the dots below belong to the chapter, and
  // holding them steady is what stops the column flickering once per step.
  if (s.callout) {
    // The block's own fade still carries the exit; only the entrance is per word.
    nodes.callout.style.opacity = String(s.callout.opacity);
    nodes.callout.style.transform = `translateY(${s.callout.lift}px)`;
    buildWords(
      nodes.title,
      s.callout.title,
      TIMING.calloutAt,
      s.t - s.entry.start - s.entry.cardSeconds,
    );
    nodes.body.textContent = s.callout.body;
  } else {
    nodes.callout.style.opacity = "0";
  }

  nodes.eyebrow.textContent = s.chapter.title;
  nodes.counter.textContent = `${s.chapter.index + 1} / ${timeline.chapters.length}`;

  if (dotsBuiltFor !== s.chapter.index) {
    dotsBuiltFor = s.chapter.index;
    nodes.dots.replaceChildren(
      ...Array.from({ length: dotsForChapter[s.chapter.index] ?? 0 }, () =>
        document.createElement("i"),
      ),
    );
  }
  const within = s.index - s.chapter.firstStep;
  Array.from(nodes.dots.children).forEach((d, i) =>
    d.classList.toggle("on", i === within),
  );

  // ---- card and rail ------------------------------------------------------
  /*
    **The section card wipes rather than fades, and that wipe is what hides the layout
    change.**

    `stateAt` reports the card's opacity, which is enough to dissolve it but not to sweep
    it — so the two edges are derived here from the step's own clock instead. That is still
    a pure function of `t`: `entry.start` and `entry.cardSeconds` are timeline data, not a
    reading of any clock, so the same `t` produces the same picture.

    It enters as a panel sweeping across from the left and leaves by uncovering to the
    left, so the eye is carried in one direction through the boundary. The contents ride a
    short counter-move, which is what keeps a full-bleed colour field from feeling like a
    slide.
  */
  if (s.card) {
    const local = s.t - s.entry.start;
    const cs = s.entry.cardSeconds;
    const entering = easeOut(clamp01(local / TIMING.cardIn));
    const leaving = easeOut(clamp01((local - (cs - TIMING.cardOut)) / TIMING.cardOut));

    nodes.card.style.display = "flex";
    // Covered from the right edge inward on the way in; uncovered from the right on the
    // way out. `inset()` takes the four insets, so the right one closes and then the left
    // one opens.
    nodes.card.style.clipPath = `inset(0 ${(1 - entering) * 100}% 0 ${leaving * 100}%)`;
    nodes.cardInner.style.opacity = String(Math.min(entering, 1 - leaving));
    nodes.cardInner.style.transform = `translateX(${(1 - entering) * 44 - leaving * 44}px)`;
    nodes.cardEdge.style.left = `${entering * 100}%`;
    nodes.cardEdge.style.opacity = String(entering < 1 ? 1 : 0);
    // The mark opens the film and then stands down; on every later card the type is enough.
    nodes.cardMark.style.display = s.card.number === 1 ? "block" : "none";
    nodes.cardNum.textContent = `Chapter ${s.card.number} of ${s.card.of}`;
    buildWords(nodes.cardName, s.card.title, TIMING.cardIn * 0.5, local);
  } else {
    nodes.card.style.display = "none";
  }

  nodes.railFill.style.width = `${s.progress * 100}%`;
}

async function init(audience: GuideAudience): Promise<number> {
  const screen = document.querySelector(".screen") as HTMLElement | null;
  if (!screen) throw new Error("stage.html is missing .screen");
  SCREEN_W = screen.clientWidth;
  SCREEN_H = screen.clientHeight;
  DEVICE_W = nodes.phone.clientWidth;
  DEVICE_H = nodes.phone.clientHeight;
  BEZEL = (DEVICE_W - SCREEN_W) / 2;

  const guide = GUIDES[audience];
  timeline = buildTimeline(guide);
  dotsForChapter = timeline.chapters.map((c) => c.stepCount);
  dotsBuiltFor = -1;

  /*
    The component images belong in here as much as the frames do.

    Changing an `<img>`'s `src` keeps the previous picture on screen until the new one
    decodes, while the box width and `aspect-ratio` this code sets alongside it apply on the
    same frame. An undecoded floater therefore does not go blank — it shows the *last*
    component stretched into the *next* one's proportions, which is how a 360x64 button came
    to be photographed crammed into a 152x152 square.

    The sequential film render never sees it: by the time a chapter's floaters fade up, a
    second of frames has gone by and the images are long since decoded. It is `--still` and
    `--clip` that suffer, and those are exactly what gets reviewed — so the bug hides in the
    film and appears only in the evidence about the film.
  */
  await preload([
    ...new Set(timeline.steps.map((s) => frameUrl(s.step.frame))),
    ...new Set(Object.keys(COMPONENTS).map(componentUrl)),
  ]);
  await document.fonts.ready;

  seek(0);
  return timeline.duration;
}

declare global {
  interface Window {
    __stage: {
      init(audience: GuideAudience): Promise<number>;
      seek(t: number): void;
      duration(): number;
      steps(): { start: number; frame: string; narration: string }[];
    };
  }
}

window.__stage = {
  init,
  seek,
  duration: () => timeline?.duration ?? 0,
  // The renderer reads the script from here rather than importing the guide a second time,
  // so the words that are spoken and the words that are drawn come from one place.
  steps: () =>
    (timeline?.steps ?? []).map((s) => ({
      start: s.start,
      frame: s.step.frame,
      narration: s.step.narration,
    })),
};
