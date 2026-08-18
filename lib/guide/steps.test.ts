import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CUSTOMER_GUIDE,
  FRAME_RATIO,
  GUIDES,
  OWNER_GUIDE,
  WINDOW_RATIO,
  guideRunLabel,
  narrationFor,
  panPercent,
  type Guide,
  type GuideVariant,
} from "./steps";
import { GUIDE_SUMMARIES } from "./summary";

const PUBLIC = join(process.cwd(), "public", "guide");
const guides: Guide[] = [CUSTOMER_GUIDE, OWNER_GUIDE];
const variants: GuideVariant[] = ["wide", "phone"];

/**
 * The guides are content, so most of what could go wrong here is a broken promise rather
 * than a type error: a frame whose file was renamed, a highlight sitting outside the
 * picture, two steps sharing a React key. None of that fails a build — it renders, wrongly.
 *
 * The file-existence check is the one that earns its keep. Every frame is a real capture
 * from `public/guide/**`, so a rename or a re-capture under a different name would leave a
 * step pointing at a 404 that `next/image` reports only in the browser console.
 */
describe("the guides", () => {
  it("has one for each audience, and the map agrees with them", () => {
    expect(GUIDES.customer).toBe(CUSTOMER_GUIDE);
    expect(GUIDES.owner).toBe(OWNER_GUIDE);
    expect(CUSTOMER_GUIDE.audience).toBe("customer");
    expect(OWNER_GUIDE.audience).toBe("owner");
  });

  it.each(guides)("$audience: every frame of both sets exists on disk", (guide) => {
    for (const step of guide.steps) {
      for (const variant of variants) {
        const image = step[variant].image;
        expect(existsSync(join(PUBLIC, image)), `missing frame: ${image}`).toBe(true);
      }
    }
  });

  it.each(guides)("$audience: step ids are unique", (guide) => {
    const ids = guide.steps.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(guides)("$audience: frames are filed by audience and by viewport", (guide) => {
    for (const step of guide.steps) {
      expect(step.wide.image.startsWith(`${guide.audience}/`)).toBe(true);
      // The phone set lives in its own folder, which is also what keys its hotspots.
      expect(step.phone.image.startsWith(`${guide.audience}/phone/`)).toBe(true);
    }
  });

  it.each(guides)("$audience: the two sets are of the same screen", (guide) => {
    for (const step of guide.steps) {
      // Same leaf name, different folder: a step whose phone frame is a different screen
      // from its wide one is a step that teaches two different things depending on the
      // width of the window.
      const wideLeaf = step.wide.image.split("/").pop();
      const phoneLeaf = step.phone.image.split("/").pop();
      expect(phoneLeaf, `${step.id} frames disagree`).toBe(wideLeaf);
    }
  });

  it.each(guides)("$audience: every step says what it is and where it was taken", (guide) => {
    for (const step of guide.steps) {
      expect(step.title.length).toBeGreaterThan(0);
      // Two sentences of explanation is the point of the feature; a one-word body would
      // mean a frame with a caption rather than a guide.
      expect(step.body.length).toBeGreaterThan(40);
      expect(step.chapter.length).toBeGreaterThan(0);
      // The route doubles as the honesty check: it is the address the frame was captured
      // at, shown in the player.
      expect(step.route.startsWith("/")).toBe(true);
      for (const variant of variants) {
        // A frame with no alt text is a picture a screen reader cannot see at all, and each
        // set needs its own: the two show different layouts.
        expect(step[variant].alt.length, `${step.id} ${variant} alt`).toBeGreaterThan(30);
      }
    }
  });

  it.each(guides)("$audience: the narration is written for the ear", (guide) => {
    for (const step of guide.steps) {
      const spoken = narrationFor(step);
      expect(spoken.length).toBeGreaterThan(40);
      // Typographic asides are for an eye. A voice reads them as nothing at all, or worse,
      // as the word "dash" — so they belong in `body`, not in what is spoken.
      expect(spoken, `${step.id} narration`).not.toMatch(/[“”"()]/);
    }
  });

  it.each(guides)("$audience: highlights stay inside their frame", (guide) => {
    for (const step of guide.steps) {
      for (const variant of variants) {
        const hotspot = step[variant].hotspot;
        if (!hotspot) continue;
        const { x, y, w, h, label } = hotspot;
        // Percentages of the frame, so anything past 100 is a ring drawn off the picture.
        expect(x).toBeGreaterThanOrEqual(0);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(w).toBeGreaterThan(0);
        expect(h).toBeGreaterThan(0);
        expect(x + w, `${step.id} ${variant} runs off the right edge`).toBeLessThanOrEqual(100);
        expect(y + h, `${step.id} ${variant} runs off the bottom edge`).toBeLessThanOrEqual(100);
        // A label is three or four words: it names the thing, the body explains it.
        expect(label.length).toBeGreaterThan(0);
        expect(label.length).toBeLessThan(40);
      }
    }
  });

  it.each(guides)("$audience: a highlight exists in both viewports or neither", (guide) => {
    for (const step of guide.steps) {
      // Both are measured from the *same* target expression, so one having a ring and the
      // other not means a measurement failed silently — and the phone set, which is the one
      // most people see, is exactly where that would go unnoticed.
      expect(
        Boolean(step.phone.hotspot),
        `${step.id}: wide ${step.wide.hotspot ? "has" : "has no"} highlight, phone differs`,
      ).toBe(Boolean(step.wide.hotspot));
    }
  });

  it.each(guides)("$audience: a step that holds longer than the default says so", (guide) => {
    for (const step of guide.steps) {
      if (step.seconds === undefined) continue;
      expect(step.seconds).toBeGreaterThanOrEqual(4);
      // Anything past ~15s stops being a frame in a guide and starts being a page nobody
      // waits out.
      expect(step.seconds).toBeLessThanOrEqual(15);
    }
  });

  it("quotes a run time, rounded up", () => {
    expect(guideRunLabel(CUSTOMER_GUIDE)).toMatch(/^About \d+ min$/);
    expect(guideRunLabel(OWNER_GUIDE)).toMatch(/^About \d+ min$/);
  });

  it("covers the workflows each audience actually has", () => {
    // Not an exhaustive inventory — a reminder that the two guides are about different
    // jobs, so a copy-paste of one into the other would fail here.
    const customerChapters = new Set(CUSTOMER_GUIDE.steps.map((s) => s.chapter));
    expect(customerChapters).toContain("Booking");
    expect(customerChapters).toContain("Walking in");
    expect(CUSTOMER_GUIDE.steps.map((s) => s.id)).toContain("rewards");

    const ownerChapters = new Set(OWNER_GUIDE.steps.map((s) => s.chapter));
    expect(ownerChapters).toContain("Your day");
    expect(ownerChapters).toContain("Back office");
    expect(OWNER_GUIDE.steps.map((s) => s.id)).toContain("queue-board");
  });
});

/**
 * The phone frame is taller than the opening it is shown through, so something has to decide
 * which part of it is on screen. These are the cases that make that decision safe.
 */
describe("panPercent", () => {
  const hotspot = (y: number, h = 6) => ({ x: 10, y, w: 40, h, label: "x" });

  it("never pans a frame that is shown whole", () => {
    // The wide window is the wide frame, so there is nothing to move.
    expect(FRAME_RATIO.wide).toBe(WINDOW_RATIO.wide);
    expect(panPercent("wide", hotspot(80))).toBe(0);
    expect(panPercent("wide", undefined)).toBe(0);
  });

  it("shows the top of the frame when there is nothing to point at", () => {
    // A screen introduces itself at the top; panning to the middle of a frame with no
    // highlight would open on an arbitrary crop.
    expect(panPercent("phone", undefined)).toBe(0);
  });

  it("centres the window on the highlight", () => {
    // A ring at the middle of the frame should land near the middle of the window, which
    // means panning by half the difference.
    const pan = panPercent("phone", hotspot(48));
    expect(pan).toBeGreaterThan(15);
    expect(pan).toBeLessThan(30);
  });

  it("never pans past either end", () => {
    // Past the end would show a strip of nothing below the frame.
    const visible = (FRAME_RATIO.phone / WINDOW_RATIO.phone) * 100;
    expect(panPercent("phone", hotspot(2))).toBe(0);
    expect(panPercent("phone", hotspot(97, 3))).toBeCloseTo(100 - visible, 5);
  });

  it("keeps the highlight inside the window at every position", () => {
    const visible = (FRAME_RATIO.phone / WINDOW_RATIO.phone) * 100;
    for (let y = 0; y <= 94; y += 2) {
      const spot = hotspot(y);
      const pan = panPercent("phone", spot);
      const top = spot.y - pan;
      const bottom = spot.y + spot.h - pan;
      expect(top, `hotspot at ${y} is above the window`).toBeGreaterThanOrEqual(-0.001);
      expect(bottom, `hotspot at ${y} is below the window`).toBeLessThanOrEqual(visible + 0.001);
    }
  });
});

/**
 * `lib/guide/summary.ts` restates three scalars per guide as literals, so that the launcher —
 * which renders on every page of all three shells — can name a guide without importing the
 * guide. That is a deliberate duplication for a bundle reason, and this is the thing that
 * makes it safe: a title reworded or a step added here fails **here**, next to the change,
 * rather than silently leaving the button announcing a guide that no longer exists.
 */
describe("GUIDE_SUMMARIES", () => {
  it("matches the guide it summarises", () => {
    for (const [audience, guide] of Object.entries(GUIDES)) {
      const summary = GUIDE_SUMMARIES[audience as keyof typeof GUIDE_SUMMARIES];
      expect(summary.title).toBe(guide.title);
      expect(summary.steps).toBe(guide.steps.length);
      expect(summary.runLabel).toBe(guideRunLabel(guide));
    }
  });

  it("covers every audience", () => {
    expect(Object.keys(GUIDE_SUMMARIES).sort()).toEqual(Object.keys(GUIDES).sort());
  });
});
