import { describe, expect, it } from "vitest";
import { HOTSPOTS } from "./hotspots";
import {
  DRIFT_TO,
  TIMING,
  ZOOM_TO,
  buildTimeline,
  stateAt,
  stepIndexAt,
  stepStart,
  type Guide,
  type GuideStep,
} from "./timeline";

/**
 * Real frame keys, so the tests exercise the real generated geometry rather
 * than a fixture that could drift from it.
 *
 * - `customer/06-discover` — a small control near the top (cy ~13%).
 * - `customer/22-book-time` — a wide control near the bottom (cy ~93%).
 * - `customer/23-map` — a real frame with no measured rect, i.e. no ring.
 */
const HIGH = "customer/06-discover";
const LOW = "customer/22-book-time";
const RINGLESS = "customer/23-map";

/** A line long enough that the step's hold clears `minStep`, so windows are testable. */
const LONG = "Search for a salon by name and pick the one you want to visit today.";

function step(over: Partial<GuideStep> = {}): GuideStep {
  return { frame: HIGH, title: "A title", body: "A body", narration: LONG, ...over };
}

function guide(chapters: Guide["chapters"]): Guide {
  return { audience: "customer", title: "Test guide", chapters };
}

/**
 * A `t` at [local] seconds into a step's *frame*, past any section card.
 *
 * Every cue is keyed off the frame clock, which starts when the card clears —
 * so a step that opens a chapter runs its zoom two seconds after its `start`.
 * Writing that offset out by hand is how the first draft of these tests
 * asserted a scale of 2.4 at a moment the camera had not begun to move.
 */
const frameAt = (entry: { start: number; cardSeconds: number }, local: number) =>
  entry.start + entry.cardSeconds + local;

/** The default two-chapter shape most tests below run against. */
function sample() {
  return buildTimeline(
    guide([
      { title: "One", steps: [step(), step({ frame: LOW })] },
      { title: "Two", steps: [step({ frame: RINGLESS })] },
    ]),
  );
}

describe("buildTimeline", () => {
  it("lays steps end to end with no gap and no overlap", () => {
    const timeline = sample();
    expect(timeline.steps[0]!.start).toBe(0);
    for (let i = 1; i < timeline.steps.length; i += 1) {
      expect(timeline.steps[i]!.start).toBe(timeline.steps[i - 1]!.end);
    }
    expect(timeline.duration).toBe(timeline.steps.at(-1)!.end);
  });

  it("numbers steps across the whole guide, not within the chapter", () => {
    expect(sample().steps.map((s) => s.index)).toEqual([0, 1, 2]);
  });

  it("gives a section card to the first step of each chapter and no other", () => {
    expect(sample().steps.map((s) => s.cardSeconds)).toEqual([TIMING.card, 0, TIMING.card]);
  });

  it("spans each chapter from its first step to its last", () => {
    const timeline = sample();
    const [one, two] = timeline.chapters;
    expect(one!.start).toBe(0);
    expect(one!.end).toBe(timeline.steps[1]!.end);
    expect(one!.firstStep).toBe(0);
    expect(one!.stepCount).toBe(2);
    expect(two!.start).toBe(timeline.steps[2]!.start);
    expect(two!.end).toBe(timeline.duration);
    expect(two!.firstStep).toBe(2);
  });

  it("refuses a guide with no chapters", () => {
    expect(() => buildTimeline(guide([]))).toThrow(/no chapters/);
  });

  it("refuses a chapter with no steps — it would card an empty screen", () => {
    expect(() => buildTimeline(guide([{ title: "Empty", steps: [] }]))).toThrow(/no steps/);
  });

  describe("hold", () => {
    it("is the spoken estimate plus a tail", () => {
      const long = buildTimeline(guide([{ title: "C", steps: [step()] }])).steps[0]!;
      expect(long.hold).toBeGreaterThan(TIMING.minStep);
    });

    it("never drops below the floor, however short the line", () => {
      const brief = buildTimeline(
        guide([{ title: "C", steps: [step({ narration: "Tap Book." })] }]),
      ).steps[0]!;
      expect(brief.hold).toBe(TIMING.minStep);
    });

    it("grows with the sentence, so a longer line is not cut off", () => {
      const one = buildTimeline(guide([{ title: "C", steps: [step()] }])).steps[0]!.hold;
      const two = buildTimeline(
        guide([{ title: "C", steps: [step({ narration: `${LONG} ${LONG}` })] }]),
      ).steps[0]!.hold;
      expect(two).toBeGreaterThan(one);
    });

    it("takes an explicit override", () => {
      const fixed = buildTimeline(
        guide([{ title: "C", steps: [step({ seconds: 9 })] }]),
      ).steps[0]!;
      expect(fixed.hold).toBe(9);
    });

    it("holds the floor even against an override, so nothing flashes past", () => {
      const fixed = buildTimeline(
        guide([{ title: "C", steps: [step({ seconds: 0.2 })] }]),
      ).steps[0]!;
      expect(fixed.hold).toBe(TIMING.minStep);
    });

    it("counts the card on top of the hold", () => {
      const timeline = sample();
      expect(timeline.steps[0]!.duration).toBe(TIMING.card + timeline.steps[0]!.hold);
      expect(timeline.steps[1]!.duration).toBe(timeline.steps[1]!.hold);
    });
  });

  describe("fadeIn", () => {
    it("cross-fades when the screen changes", () => {
      const timeline = buildTimeline(
        guide([{ title: "C", steps: [step(), step({ frame: LOW })] }]),
      );
      expect(timeline.steps[1]!.fadeIn).toBe(true);
    });

    it("does not blink when two steps sit on the same screen", () => {
      const timeline = buildTimeline(
        guide([{ title: "C", steps: [step(), step()] }]),
      );
      expect(timeline.steps[1]!.fadeIn).toBe(false);
    });

    it("leaves the transition to the card when a step opens a chapter", () => {
      expect(sample().steps[2]!.fadeIn).toBe(false);
    });

    it("is false for the very first step — there is nothing to fade from", () => {
      expect(sample().steps[0]!.fadeIn).toBe(false);
    });
  });

  describe("hotspots and taps", () => {
    it("resolves the generated rect for a frame that has one", () => {
      expect(sample().steps[0]!.hotspot).toEqual(HOTSPOTS[HIGH]);
    });

    it("leaves a frame with no measured rect ringless rather than guessing", () => {
      expect(sample().steps[2]!.hotspot).toBeNull();
    });

    it("taps a highlighted control by default", () => {
      expect(sample().steps[0]!.tap).toBe(true);
    });

    it("respects an opt-out, for a ring that points at something informational", () => {
      const timeline = buildTimeline(
        guide([{ title: "C", steps: [step({ tap: false })] }]),
      );
      expect(timeline.steps[0]!.tap).toBe(false);
    });

    it("cannot tap a frame with nowhere to put the finger", () => {
      const timeline = buildTimeline(
        guide([{ title: "C", steps: [step({ frame: RINGLESS, tap: true })] }]),
      );
      expect(timeline.steps[0]!.tap).toBe(false);
    });

    /*
      `ring: false` exists for the frames whose measured rect points at the wrong
      control — `auth/01-onboarding` rings the Skip pill — where the honest answer is
      no highlight rather than a hand-moved one. It has to drop the tap and the camera
      push with it, because both are derived from the hotspot.
    */
    it("drops a measured ring when the step declines it", () => {
      const timeline = buildTimeline(
        guide([{ title: "C", steps: [step({ ring: false })] }]),
      );
      expect(timeline.steps[0]!.hotspot).toBeNull();
    });

    it("cannot tap a control it is not pointing at", () => {
      const timeline = buildTimeline(
        guide([{ title: "C", steps: [step({ ring: false, tap: true })] }]),
      );
      expect(timeline.steps[0]!.tap).toBe(false);
    });

    it("drifts rather than pushing in, with nothing to push in on", () => {
      const timeline = buildTimeline(
        guide([{ title: "C", steps: [step({ ring: false })] }]),
      );
      expect(timeline.steps[0]!.zoom).toBe(DRIFT_TO);
    });

    it("leaves the ring alone unless the step says otherwise", () => {
      expect(sample().steps[0]!.hotspot).not.toBeNull();
    });
  });
});

describe("stepIndexAt", () => {
  const timeline = sample();

  it("clamps below zero and above the end", () => {
    expect(stepIndexAt(timeline, -30)).toBe(0);
    expect(stepIndexAt(timeline, timeline.duration + 30)).toBe(timeline.steps.length - 1);
  });

  it("gives a boundary to the step that is starting, not the one that ended", () => {
    const boundary = timeline.steps[0]!.end;
    expect(stepIndexAt(timeline, boundary - 0.001)).toBe(0);
    expect(stepIndexAt(timeline, boundary)).toBe(1);
  });

  it("ends on the last step, not past it", () => {
    expect(stepIndexAt(timeline, timeline.duration)).toBe(timeline.steps.length - 1);
  });
});

describe("stepStart", () => {
  const timeline = sample();

  it("lands on the head of the step, card included", () => {
    expect(stepStart(timeline, 2)).toBe(timeline.steps[2]!.start);
  });

  it("clamps an index the transport could not otherwise reach", () => {
    expect(stepStart(timeline, -4)).toBe(0);
    expect(stepStart(timeline, 99)).toBe(timeline.steps.at(-1)!.start);
  });
});

describe("stateAt", () => {
  const timeline = sample();
  /** Midway through the second step's hold — every cue is up by then. */
  const settled = timeline.steps[1]!.start + timeline.steps[1]!.hold / 2;

  it("is the same picture every time it is asked — the whole basis of seeking", () => {
    expect(stateAt(timeline, settled)).toEqual(stateAt(timeline, settled));
  });

  it("clamps t into the timeline rather than reading off the end", () => {
    expect(stateAt(timeline, -5).t).toBe(0);
    expect(stateAt(timeline, timeline.duration + 5).t).toBe(timeline.duration);
  });

  it("reports progress across the whole guide", () => {
    expect(stateAt(timeline, 0).progress).toBe(0);
    expect(stateAt(timeline, timeline.duration).progress).toBe(1);
  });

  it("names the chapter the step belongs to", () => {
    expect(stateAt(timeline, settled).chapter.title).toBe("One");
    expect(stateAt(timeline, timeline.steps[2]!.start + 0.1).chapter.title).toBe("Two");
  });

  describe("the section card", () => {
    it("covers the head of a chapter and then clears", () => {
      expect(stateAt(timeline, 1).card).not.toBeNull();
      expect(stateAt(timeline, TIMING.card).card).toBeNull();
    });

    it("fades in and out rather than cutting", () => {
      expect(stateAt(timeline, 0).card!.opacity).toBe(0);
      expect(stateAt(timeline, TIMING.cardIn).card!.opacity).toBe(1);
      expect(stateAt(timeline, TIMING.card - 0.001).card!.opacity).toBeLessThan(0.02);
    });

    it("numbers itself, so the viewer knows where they are", () => {
      const card = stateAt(timeline, 1).card!;
      expect(card.number).toBe(1);
      expect(card.of).toBe(2);
      expect(card.title).toBe("One");
    });

    it("never appears on a step that does not open a chapter", () => {
      expect(stateAt(timeline, settled).card).toBeNull();
    });

    it("hands over to a screen that is already fully there", () => {
      expect(stateAt(timeline, TIMING.card).frame.opacity).toBe(1);
    });
  });

  describe("the camera", () => {
    it("starts still and pushes in on the highlighted control", () => {
      const start = timeline.steps[1]!.start;
      expect(stateAt(timeline, start).frame.scale).toBe(1);
      expect(stateAt(timeline, start + TIMING.zoomAt + TIMING.zoomDur).frame.scale).toBeCloseTo(
        ZOOM_TO,
        5,
      );
    });

    it("only drifts on a frame with nothing to point at", () => {
      const step3 = timeline.steps[2]!;
      const held = stateAt(timeline, step3.start + step3.duration - 0.01);
      expect(held.frame.scale).toBeGreaterThan(1);
      expect(held.frame.scale).toBeLessThanOrEqual(DRIFT_TO);
    });

    it("takes the hotspot's centre as its origin, so the ring is a fixed point", () => {
      const box = HOTSPOTS[LOW]!;
      const frame = stateAt(timeline, settled).frame;
      expect(frame.originX).toBeCloseTo(box.x + box.w / 2, 5);
      expect(frame.originY).toBeCloseTo(box.y + box.h / 2, 5);
    });

    it("centres the origin when there is no hotspot", () => {
      const frame = stateAt(timeline, timeline.steps[2]!.start + 1).frame;
      expect(frame.originX).toBe(50);
      expect(frame.originY).toBe(50);
    });

    describe("a per-step zoom override", () => {
      const pushed = buildTimeline(
        guide([{ title: "C", steps: [step({ frame: LOW, zoom: 2.4 })] }]),
      );

      it("settles at the requested scale instead of the default", () => {
        const entry = pushed.steps[0]!;
        expect(
          stateAt(pushed, frameAt(entry, TIMING.zoomAt + TIMING.zoomDur)).frame.scale,
        ).toBeCloseTo(2.4, 5);
      });

      it("still starts from rest, so the push is a move and not a jump", () => {
        expect(stateAt(pushed, frameAt(pushed.steps[0]!, 0)).frame.scale).toBe(1);
      });

      it("keeps the hotspot centre fixed however hard it pushes", () => {
        const box = HOTSPOTS[LOW]!;
        const entry = pushed.steps[0]!;
        const ring = stateAt(pushed, frameAt(entry, entry.hold - 0.01)).ring!;
        expect(ring.box.x + ring.box.w / 2).toBeCloseTo(box.x + box.w / 2, 6);
        expect(ring.box.y + ring.box.h / 2).toBeCloseTo(box.y + box.h / 2, 6);
      });

      it("refuses to shrink the frame — that would show the stage behind it", () => {
        const shrunk = buildTimeline(
          guide([{ title: "C", steps: [step({ zoom: 0.5 })] }]),
        );
        expect(shrunk.steps[0]!.zoom).toBe(1);
        for (let t = 0; t <= shrunk.duration; t += 0.1) {
          expect(stateAt(shrunk, t).frame.scale).toBeGreaterThanOrEqual(1);
        }
      });

      it("applies to a frame with no hotspot too, overriding the drift", () => {
        const wide = buildTimeline(
          guide([{ title: "C", steps: [step({ frame: RINGLESS, zoom: 1.5 })] }]),
        );
        const entry = wide.steps[0]!;
        expect(
          stateAt(wide, frameAt(entry, TIMING.zoomAt + TIMING.zoomDur)).frame.scale,
        ).toBeCloseTo(1.5, 5);
      });

      it("is ignored under reduced motion, like every other camera move", () => {
        expect(stateAt(pushed, pushed.duration / 2, { reduced: true }).frame.scale).toBe(1);
      });
    });

    it("never scales below 1, so the stage can never show through the frame", () => {
      for (let t = 0; t <= timeline.duration; t += 0.05) {
        expect(stateAt(timeline, t).frame.scale).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe("the ring", () => {
    it("waits for the screen to settle before appearing", () => {
      const start = timeline.steps[1]!.start;
      expect(stateAt(timeline, start).ring).toBeNull();
      expect(stateAt(timeline, start + TIMING.ringAt + TIMING.ringIn).ring!.opacity).toBe(1);
    });

    it("is never drawn on a frame with no measured rect", () => {
      const step3 = timeline.steps[2]!;
      expect(stateAt(timeline, step3.start + step3.duration - 0.01).ring).toBeNull();
    });

    it("holds its centre exactly while the camera pushes in", () => {
      const box = HOTSPOTS[LOW]!;
      const cx = box.x + box.w / 2;
      const cy = box.y + box.h / 2;
      const entry = timeline.steps[1]!;
      for (let local = TIMING.ringAt; local < entry.hold; local += 0.1) {
        const ring = stateAt(timeline, entry.start + local).ring;
        if (!ring) continue;
        expect(ring.box.x + ring.box.w / 2).toBeCloseTo(cx, 6);
        expect(ring.box.y + ring.box.h / 2).toBeCloseTo(cy, 6);
      }
    });

    it("grows with the camera, so it stays over the same pixels", () => {
      const entry = timeline.steps[1]!;
      const early = stateAt(timeline, entry.start + TIMING.ringAt + TIMING.ringIn).ring!;
      const late = stateAt(timeline, entry.start + entry.hold - 0.01).ring!;
      expect(late.box.w).toBeGreaterThan(early.box.w);
      expect(late.box.w / HOTSPOTS[LOW]!.w).toBeCloseTo(ZOOM_TO, 2);
    });

    it("settles in from slightly larger than itself", () => {
      const entry = timeline.steps[1]!;
      const arriving = stateAt(timeline, entry.start + TIMING.ringAt + 0.05).ring!;
      expect(arriving.scale).toBeGreaterThan(1);
      expect(stateAt(timeline, entry.start + entry.hold - 0.01).ring!.scale).toBe(1);
    });
  });

  describe("the tap", () => {
    it("lands after the ring, not with it", () => {
      const start = timeline.steps[1]!.start;
      expect(stateAt(timeline, start + TIMING.ringAt).tap).toBeNull();
      expect(stateAt(timeline, start + TIMING.tapAt).tap).not.toBeNull();
    });

    it("stays as an anchor after the ripple has finished", () => {
      const entry = timeline.steps[1]!;
      const late = stateAt(timeline, entry.start + entry.hold - 0.01).tap!;
      expect(late.progress).toBe(1);
    });

    it("sits on the hotspot's centre", () => {
      const box = HOTSPOTS[LOW]!;
      const tap = stateAt(timeline, settled).tap!;
      expect(tap.x).toBeCloseTo(box.x + box.w / 2, 5);
      expect(tap.y).toBeCloseTo(box.y + box.h / 2, 5);
    });

    it("is absent where there is nothing to tap", () => {
      const step3 = timeline.steps[2]!;
      expect(stateAt(timeline, step3.start + step3.duration - 0.01).tap).toBeNull();
    });
  });

  describe("the callout", () => {
    it("arrives after the ring and leaves before the step does", () => {
      const entry = timeline.steps[1]!;
      expect(stateAt(timeline, entry.start + TIMING.calloutAt).callout).toBeNull();
      expect(stateAt(timeline, settled).callout!.opacity).toBe(1);
      expect(stateAt(timeline, entry.start + entry.hold - 0.01).callout!.opacity).toBeLessThan(
        0.05,
      );
    });

    it("carries the step's own words, not the chapter's", () => {
      const callout = stateAt(timeline, settled).callout!;
      expect(callout.title).toBe("A title");
      expect(callout.body).toBe("A body");
    });

    it("goes above a control near the bottom of the screen", () => {
      expect(stateAt(timeline, settled).callout!.anchor!.side).toBe("above");
    });

    it("goes below a control near the top", () => {
      const entry = timeline.steps[0]!;
      const at = entry.start + entry.cardSeconds + entry.hold / 2;
      expect(stateAt(timeline, at).callout!.anchor!.side).toBe("below");
    });

    it("has no anchor on a frame with no highlight, rather than a made-up one", () => {
      const entry = timeline.steps[2]!;
      const at = entry.start + entry.cardSeconds + entry.hold / 2;
      expect(stateAt(timeline, at).callout!.anchor).toBeNull();
    });

    it("is absent entirely for a step with nothing to say beside the frame", () => {
      const bare = buildTimeline(guide([{ title: "C", steps: [step({ body: "" })] }]));
      expect(stateAt(bare, bare.duration / 2).callout).toBeNull();
    });
  });

  describe("the cross-fade", () => {
    it("shows the screen being left while the new one arrives", () => {
      const entry = timeline.steps[1]!;
      const mid = stateAt(timeline, entry.start + TIMING.frameIn / 2);
      expect(mid.previous!.src).toBe(HIGH);
      expect(mid.frame.src).toBe(LOW);
      expect(mid.previous!.opacity).toBeCloseTo(1 - mid.frame.opacity, 6);
    });

    it("is over once the new screen is fully there", () => {
      expect(stateAt(timeline, timeline.steps[1]!.start + TIMING.frameIn).previous).toBeNull();
    });

    it("holds the departing screen at the zoom it reached, not at rest", () => {
      const entry = timeline.steps[1]!;
      const mid = stateAt(timeline, entry.start + TIMING.frameIn / 2);
      expect(mid.previous!.scale).toBeCloseTo(ZOOM_TO, 2);
    });

    it("never runs on the first step", () => {
      expect(stateAt(timeline, 0).previous).toBeNull();
    });

    it("never runs under a section card, which is the transition itself", () => {
      const entry = timeline.steps[2]!;
      expect(stateAt(timeline, entry.start + 0.1).previous).toBeNull();
    });
  });

  describe("under prefers-reduced-motion", () => {
    const reduced = { reduced: true };

    it("holds the camera still", () => {
      for (let t = 0; t <= timeline.duration; t += 0.25) {
        expect(stateAt(timeline, t, reduced).frame.scale).toBe(1);
      }
    });

    it("leaves the ring exactly over the measured rect", () => {
      expect(stateAt(timeline, settled, reduced).ring!.box).toEqual(HOTSPOTS[LOW]);
    });

    it("does not pop the ring in", () => {
      expect(stateAt(timeline, settled, reduced).ring!.scale).toBe(1);
    });

    it("shows a landed dot rather than an expanding ripple", () => {
      expect(stateAt(timeline, settled, reduced).tap!.progress).toBe(1);
    });

    it("cuts between screens instead of fading", () => {
      const entry = timeline.steps[1]!;
      const state = stateAt(timeline, entry.start + TIMING.frameIn / 2, reduced);
      expect(state.frame.opacity).toBe(1);
      expect(state.previous).toBeNull();
    });

    it("does not slide the callout in", () => {
      expect(stateAt(timeline, settled, reduced).callout!.lift).toBe(0);
    });

    it("still shows every cue — this removes motion, not the guide", () => {
      const state = stateAt(timeline, settled, reduced);
      expect(state.ring).not.toBeNull();
      expect(state.tap).not.toBeNull();
      expect(state.callout).not.toBeNull();
      expect(stateAt(timeline, 1, reduced).card).not.toBeNull();
    });
  });

  it("never throws anywhere on the axis, including both ends", () => {
    for (let t = -1; t <= timeline.duration + 1; t += 0.05) {
      expect(() => stateAt(timeline, t)).not.toThrow();
      expect(() => stateAt(timeline, t, { reduced: true })).not.toThrow();
    }
  });
});
