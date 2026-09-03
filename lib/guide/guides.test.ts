import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { COMPONENTS } from "./components";
import { VOICE_SECONDS } from "./durations";
import { CHAPTER_FLOATERS, floatersFor } from "./floaters";
import { GUIDES } from "./guides";
import {
  CHAPTER_LAYOUTS,
  FAN_MINIMUM,
  LAYOUT_SPECS,
  STEP_LAYOUTS,
  layoutFor,
} from "./layouts";
import { HOTSPOTS } from "./hotspots";
import { GUIDE_SUMMARIES, guideRunLabel } from "./summary";
import { buildTimeline, type Guide, type GuideStep } from "./timeline";

/**
 * What can actually go wrong with a guide, and what a test can catch.
 *
 * These do not check the *words* — no test can tell you a sentence describes the wrong
 * screen, which is why `guides.ts` documents its omissions instead. What they catch is the
 * mechanical half: a frame that does not exist, an empty chapter, a step whose `ring: false`
 * is pointless because there was never a ring, and a walkthrough that has quietly grown to
 * twice its intended length.
 *
 * The frames are checked against the **filesystem** rather than a list, because a list is a
 * second copy of the truth and a re-capture would leave it behind.
 */

const FRAMES = join(process.cwd(), "public", "guide", "app");
const VIDEO = join(process.cwd(), "public", "guide", "video");

const everyStep = (guide: Guide): GuideStep[] =>
  guide.chapters.flatMap((chapter) => chapter.steps);

const guides = Object.values(GUIDES);

describe.each(guides.map((g) => [g.audience, g] as const))("%s guide", (_audience, guide) => {
  it("names only frames that exist on disk", () => {
    const missing = everyStep(guide)
      .map((step) => step.frame)
      .filter((frame) => !existsSync(join(FRAMES, `${frame}.webp`)));
    expect(missing).toEqual([]);
  });

  it("has no empty chapter", () => {
    // `buildTimeline` throws on one, but failing here names the chapter.
    expect(guide.chapters.filter((c) => c.steps.length === 0)).toEqual([]);
  });

  it("builds a timeline", () => {
    expect(() => buildTimeline(guide)).not.toThrow();
  });

  /*
    Seven chapters is the brief's §10 structure. Asserted because chapters are what the
    section cards and the progress rail are built from, and a chapter added without a card
    designed for it is the kind of thing that only shows up in a finished render.
  */
  it("keeps the seven-chapter shape", () => {
    expect(guide.chapters).toHaveLength(7);
  });

  /*
    A guide long enough to teach and short enough to watch. The lower bound matters as much
    as the upper: the failure mode of an authoring mistake is a chapter silently dropping
    out, which shortens the film rather than lengthening it.
  */
  it("runs between three and six minutes", () => {
    const { duration } = buildTimeline(guide);
    expect(duration).toBeGreaterThan(180);
    expect(duration).toBeLessThan(360);
  });

  it("never shows the same frame twice in a row", () => {
    const frames = everyStep(guide).map((s) => s.frame);
    const repeats = frames.filter((frame, i) => i > 0 && frames[i - 1] === frame);
    expect(repeats).toEqual([]);
  });

  /*
    `ring: false` is a claim that the *generated* geometry points at the wrong control. On a
    frame that was never measured it claims nothing, and it would go on looking deliberate
    long after a re-capture had made it meaningless.
  */
  it("only declines rings that were actually measured", () => {
    const pointless = everyStep(guide)
      .filter((step) => step.ring === false && HOTSPOTS[step.frame] === undefined)
      .map((step) => step.frame);
    expect(pointless).toEqual([]);
  });

  it("cannot tap a step that has no ring", () => {
    const contradictory = everyStep(guide)
      .filter((step) => step.ring === false && step.tap === true)
      .map((step) => step.frame);
    expect(contradictory).toEqual([]);
  });
});

/*
  The frames left out on purpose, pinned so the omissions survive a future edit.

  Each of these was opened and rejected for a reason recorded in `guides.ts` — a duplicate
  capture, a network error recorded where a paywall was expected, seeded junk on screen, a
  screen whose images never loaded. Without this test, "use every frame we captured" is an
  easy and entirely reasonable-sounding change to make, and it would put all of them back.
*/
describe("the frames held out", () => {
  const EXCLUDED = [
    "auth/04-guest-discover",
    "customer/16-specialist-profile",
    "customer/17-salon-reviews",
    "customer/21-book-stylist",
    "customer/29-booking-detail",
    "owner/49-client-book-locked",
    "owner/53-payroll-locked",
    "owner/54-tax-estimate-locked",
    "owner/70-offers",
  ];

  const used = new Set(guides.flatMap(everyStep).map((step) => step.frame));

  it.each(EXCLUDED)("leaves %s out", (frame) => {
    expect(used.has(frame)).toBe(false);
  });

  it("still has those frames on disk, so the reasons stay checkable", () => {
    const gone = EXCLUDED.filter((f) => !existsSync(join(FRAMES, `${f}.webp`)));
    expect(gone).toEqual([]);
  });
});

/*
  The layout table is indexed by chapter, so a chapter added without one throws — but only
  at render time, deep inside a headless browser, which is the worst place to find out. The
  film is 20 minutes of encoding away from that error; these tests are half a second away.
*/
describe("layouts", () => {
  it.each(guides.map((g) => [g.audience, g] as const))(
    "covers every %s chapter",
    (audience, guide) => {
      expect(CHAPTER_LAYOUTS[audience]).toHaveLength(guide.chapters.length);
    },
  );

  it("resolves a layout for every step of both guides", () => {
    for (const guide of guides) {
      guide.chapters.forEach((chapter, index) => {
        for (const step of chapter.steps) {
          expect(() => layoutFor(guide.audience, index, step.frame)).not.toThrow();
        }
      });
    }
  });

  /*
    A per-step override keyed to a frame no guide uses is dead weight that still reads as
    deliberate — exactly the drift `hotspots.ts` warns about with its manual entries.
  */
  it("overrides only frames that are actually on screen", () => {
    const used = new Set(guides.flatMap(everyStep).map((s) => s.frame));
    const orphans = Object.keys(STEP_LAYOUTS).filter((frame) => !used.has(frame));
    expect(orphans).toEqual([]);
  });

  /*
    Every layout needs a spec, because `stage.ts` indexes this to build the device's
    transform. A missing one is `undefined.tiltY` at render time — a whole film of devices
    with no transform at all, and nothing to say why.
  */
  it("gives every layout a spec", () => {
    const named = new Set([
      ...Object.values(CHAPTER_LAYOUTS).flat(),
      ...Object.values(STEP_LAYOUTS),
    ]);
    for (const layout of named) {
      expect(LAYOUT_SPECS[layout]).toBeDefined();
    }
  });

  /*
    The instructional layouts have to stay readable. The reference film turns its devices
    twenty degrees and more, which is fine when nobody has to read the screen; here the
    whole point is that you can, and past about five degrees the app's own labels start to
    keystone. `statement` is exempt — it is the one shot where the sentence carries.
  */
  it("keeps the split layouts nearly flat", () => {
    for (const name of ["split-left", "split-right"] as const) {
      expect(Math.abs(LAYOUT_SPECS[name].tiltY)).toBeLessThanOrEqual(5);
    }
  });

  /*
    `gallery` is the one layout whose chrome sits *above* the device rather than beside it,
    and the camera push scales the device about the step's own hotspot — so a step whose
    hotspot is a bottom-corner button pins the origin low and lifts the top edge by nearly
    the whole of the growth. That put `owner/70-offers` 58px into its own caption, through
    a clearance that had been sized against a device standing still.

    Sizing the clearance for the worst case would cost the shot most of its size, so the
    layout holds the camera instead. Every other layout keeps the push: they have room
    beside the device, and losing it would flatten the film.
  */
  it("holds the camera still on the gallery, and nowhere else", () => {
    expect(LAYOUT_SPECS.gallery.push).toBe(false);
    for (const name of ["split-left", "split-right", "statement", "cluster"] as const) {
      expect(LAYOUT_SPECS[name].push).not.toBe(false);
    }
  });

  /*
    The fan stands four of the chapter's *other* screens beside the current one, so it needs
    a chapter with something to fan. Below the minimum it starts repeating screens, and a
    fan of the same screen four times looks like a bug rather than an overview.
  */
  it("only opens on the fan where a chapter has screens to fan", () => {
    for (const guide of guides) {
      guide.chapters.forEach((chapter, index) => {
        const first = layoutFor(
          guide.audience,
          index,
          chapter.steps[0]!.frame,
          0,
          chapter.steps.length,
        );
        if (first === "gallery") {
          expect(chapter.steps.length).toBeGreaterThanOrEqual(FAN_MINIMUM);
        }
      });
    }
  });

  /*
    The cluster is a wide, deliberately unreadable shot. Opening one with a fan would be two
    scene-setting beats back to back before the chapter explains anything.
  */
  it("never puts a fan in front of a cluster chapter", () => {
    for (const guide of guides) {
      guide.chapters.forEach((chapter, index) => {
        if (CHAPTER_LAYOUTS[guide.audience][index] !== "cluster") return;
        for (const [at, step] of chapter.steps.entries()) {
          const layout = layoutFor(
            guide.audience,
            index,
            step.frame,
            at,
            chapter.steps.length,
          );
          expect(layout).not.toBe("gallery");
        }
      });
    }
  });

  /*
    One cluster per film. It is the most decorative thing in the walkthrough and the least
    legible; two of them starts to look like the film is showing off rather than teaching.
  */
  it("spends the cluster once per walkthrough", () => {
    for (const layouts of Object.values(CHAPTER_LAYOUTS)) {
      expect(layouts.filter((l) => l === "cluster")).toHaveLength(1);
    }
  });

  it("never repeats a layout across adjacent chapters", () => {
    for (const layouts of Object.values(CHAPTER_LAYOUTS)) {
      const repeats = layouts.filter((l, i) => i > 0 && layouts[i - 1] === l);
      expect(repeats).toEqual([]);
    }
  });
});

/*
  The floating components come from a generated manifest and an authored list, and nothing
  connects the two but a string. A renamed or dropped capture would leave the film quietly
  missing a piece — no error, no blank, just less than there should be.
*/
describe("floating components", () => {
  it.each(guides.map((g) => [g.audience, g] as const))(
    "has a list for every %s chapter",
    (audience, guide) => {
      expect(CHAPTER_FLOATERS[audience]).toHaveLength(guide.chapters.length);
    },
  );

  it("names only components that were actually captured", () => {
    const missing = Object.values(CHAPTER_FLOATERS)
      .flat(2)
      .filter((name) => COMPONENTS[name] === undefined);
    expect([...new Set(missing)]).toEqual([]);
  });

  /*
    Three is the working maximum. A fourth starts to read as a collage and competes with the
    device, which is still the thing being explained.
  */
  it("floats at most three pieces per chapter", () => {
    for (const guide of guides) {
      guide.chapters.forEach((_, index) => {
        expect(floatersFor(guide.audience, index).length).toBeLessThanOrEqual(3);
      });
    }
  });

  it("captured every component at a usable size", () => {
    for (const [name, box] of Object.entries(COMPONENTS)) {
      expect(box.w, `${name} width`).toBeGreaterThan(0);
      expect(box.h, `${name} height`).toBeGreaterThan(0);
      /*
        A component as tall as the test surface means the capture filled its parent instead
        of hugging its content — the `MainAxisSize.max` trap the Dart harness documents. It
        composites as an invisible margin the stage cannot see or correct for.
      */
      expect(box.h, `${name} looks like it filled the canvas`).toBeLessThan(560);
    }
  });
});

describe("across both guides", () => {
  it("gives the two audiences different walkthroughs", () => {
    const [a, b] = guides.map((g) => everyStep(g).map((s) => s.frame));
    expect(a).not.toEqual(b);
    expect(a!.filter((frame) => b!.includes(frame))).toEqual([]);
  });

  /*
    The free ElevenLabs tier is 10,000 characters a month and both scripts are generated in
    one pass. Going over does not fail loudly at the API — it fails after some of the lines
    have already been spent, leaving a half-voiced film and no quota to fix it.
  */
  it("keeps both scripts inside one month of the voice budget", () => {
    const characters = guides
      .flatMap(everyStep)
      .reduce((total, step) => total + step.narration.length, 0);
    expect(characters).toBeLessThan(9000);
  });
});

/*
  The narrated durations are what actually paces the film now: `voiced()` in `guides.ts`
  stamps each measured clip length onto its step, and `stepHold` prefers that over the
  estimate. These check the two joins that hold it together.
*/
describe("narration timing", () => {
  const framesUsed = guides.flatMap(everyStep).map((step) => step.frame);

  /*
    `durations.ts` keys a clip by its frame alone, and `public/guide/voice/` stores the
    audio at that same path — both only safe while no frame appears twice across the two
    films. A duplicate would silently give one step the other's timing and the other's
    voice: a fault that survives a build, a lint and a test run, and shows up only as a
    line that stops mid-sentence.
  */
  it("gives every step a frame no other step uses", () => {
    expect(new Set(framesUsed).size).toBe(framesUsed.length);
  });

  /*
    Every clip that exists must be reachable, or the timing it carries never applies. The
    reverse is deliberately not asserted: a line added since the last `voice-guide.py` run
    has no clip yet, and `voiced()` falls back to the estimate rather than failing.
  */
  it("points every measured duration at a real step", () => {
    const frames = new Set(framesUsed);
    for (const key of Object.keys(VOICE_SECONDS)) {
      expect(frames.has(key), `${key} has audio but no step`).toBe(true);
    }
  });

  /*
    The estimate was generous by design and it added up. Measured, both films come in under
    the five-minute mark the brief asked for — and how far under depends on how fast the
    chosen narrator reads, which is exactly why this is asserted against the real numbers
    rather than against the estimate that no longer paces anything.
  */
  it("keeps both films inside the four-to-five-minute cut", () => {
    for (const guide of guides) {
      const { duration } = buildTimeline(guide);
      expect(duration).toBeGreaterThan(230);
      expect(duration).toBeLessThan(320);
    }
  });
});

/**
 * `summary.ts` holds literals so that a button can name a guide without pulling 27 KB of
 * narration into every route's client bundle. Literals drift; this is the cost of that
 * decision being paid rather than deferred.
 */
describe("launcher summaries", () => {
  it.each(guides.map((g) => [g.audience, g] as const))(
    "%s: title, chapter count and run time match the guide",
    (audience, guide) => {
      const summary = GUIDE_SUMMARIES[audience];
      expect(summary.title).toBe(guide.title);
      expect(summary.chapters).toBe(guide.chapters.length);
      expect(summary.runLabel).toBe(guideRunLabel(buildTimeline(guide).duration));
    },
  );
});

/**
 * What the website actually serves.
 *
 * The player builds three URLs per audience from nothing but the audience name, so a missing
 * file is a 404 at the moment somebody presses the button and not before. Checked against the
 * filesystem for the same reason the frames are: a list would be a second copy of the truth.
 */
describe("the files the player asks for", () => {
  it.each(guides.map((g) => g.audience))("%s has a film, a poster and captions", (audience) => {
    for (const name of [`${audience}.mp4`, `${audience}-poster.webp`, `${audience}.vtt`]) {
      expect(existsSync(join(VIDEO, name)), `missing public/guide/video/${name}`).toBe(true);
    }
  });

  it.each(guides.map((g) => [g.audience, g] as const))(
    "%s captions say exactly what is narrated",
    (audience, guide) => {
      // Not "roughly the same words". `captions-guide.py` splits long lines at clause
      // boundaries and wraps them to two, and every one of those operations is a chance to
      // drop a character. Comparing the whole text with whitespace normalised is the only
      // check that catches a lost clause, because a lost clause still leaves valid WebVTT
      // with plausible timings.
      const collapse = (text: string) => text.replace(/\s+/g, " ").trim();
      const spoken = collapse(everyStep(guide).map((step) => step.narration ?? "").join(" "));
      const captioned = collapse(
        readFileSync(join(VIDEO, `${audience}.vtt`), "utf8")
          .split("\n\n")
          .slice(2) // the WEBVTT header and the generated-by NOTE
          .map((block) => block.split("\n").slice(2).join(" ")) // drop the number and timings
          .join(" "),
      );
      expect(captioned).toBe(spoken);
    },
  );

  it.each(guides.map((g) => [g.audience, g] as const))(
    "%s captions are valid WebVTT that ends inside the film",
    (audience, guide) => {
      const vtt = readFileSync(join(VIDEO, `${audience}.vtt`), "utf8");
      expect(vtt.startsWith("WEBVTT")).toBe(true);

      const cues = [...vtt.matchAll(/(\d\d:\d\d:\d\d\.\d\d\d) --> (\d\d:\d\d:\d\d\.\d\d\d)/g)];
      expect(cues.length).toBeGreaterThan(guide.chapters.length);

      const seconds = (stamp: string) => {
        const [h, m, rest] = stamp.split(":");
        return Number(h) * 3600 + Number(m) * 60 + Number(rest);
      };
      // Monotonic and non-overlapping: a cue that starts before the previous one ended is
      // rendered by stacking them, which is how two captions end up on screen at once.
      let previousEnd = 0;
      for (const [, from, to] of cues) {
        expect(seconds(to)).toBeGreaterThan(seconds(from));
        expect(seconds(from)).toBeGreaterThanOrEqual(previousEnd);
        previousEnd = seconds(to);
      }
      expect(previousEnd).toBeLessThanOrEqual(buildTimeline(guide).duration);
    },
  );
});
