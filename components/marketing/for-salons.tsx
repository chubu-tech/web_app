"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  motion,
  useInView,
  useReducedMotion,
  type Transition,
} from "motion/react";
import {
  CalendarDays,
  Pointer,
  Users,
  UsersRound,
  TrendingUp,
} from "lucide-react";
import { forSalons } from "@/lib/marketing/content";
import { cn } from "@/lib/marketing/utils";
import { Button } from "./ui/button";
import { CountUp } from "./ui/count-up";
import { Reveal } from "./ui/reveal";
import { Container, Section, SectionHeading } from "./ui/section";

const EASE = [0.16, 1, 0.3, 1] as const;
const ICONS = [CalendarDays, UsersRound, Users, TrendingUp];

/** How long a panel holds before the demo moves on. */
const DWELL_MS = 6000;

/** Past this much horizontal travel (offset + a little velocity) a drag commits. */
const SWIPE_COMMIT_PX = 56;

/**
 * The same step, from a trackpad. Lower than the drag's 56px because the two
 * gestures cost different amounts: a drag is a deliberate press-move-release, so
 * a high bar only stops accidents, while a two-finger flick is over in a moment
 * and 56px of it feels like the card ignored you.
 */
const WHEEL_COMMIT_PX = 42;

/**
 * A gap this long ends the gesture. macOS keeps sending wheel events for up to a
 * second after the fingers lift — the momentum tail — and those are the *same*
 * flick, so they must not each count as a swipe. Everything up to a real pause is
 * one gesture and steps once.
 */
const WHEEL_REST_MS = 220;

/** `deltaMode` 1 is lines, not pixels. Roughly one line of body text. */
const WHEEL_LINE_PX = 16;

/**
 * The owner half of the story: one screen, four things you do on it.
 *
 * ## What was here, and why all of it went
 *
 * The section was a sticky screen mock in block flow with four `role="tab"` rows
 * stacked underneath it, advancing on a five-second timer. On a desktop it was
 * fine. On a phone it had four separate faults, and three of them were the same
 * fault:
 *
 * 1. **The mock was `sticky top-…` at every width, with `z-10`.** Its containing
 *    block was the whole wrapper, which on a phone is four feature rows tall — so
 *    the card pinned itself under the header and the rows scrolled *behind* it.
 *    Measured at 390px: the heading "The walk-in line" was half-covered by the
 *    card, and further down the card sat on top of the "See salon plans" button.
 *    Content obscured by other content, at the one width most visitors are on.
 * 2. **The tab rail inside the mock was `<span>`s in an `overflow-x-auto` strip.**
 *    It looked exactly like a segmented control, scrolled off the right edge
 *    mid-word ("Stylists &…"), and was not interactive at all. The only real
 *    control was the row list underneath, which did not look like a control.
 * 3. **The rows were a heading, a paragraph and a rule, four times.** That is the
 *    shape of an article, not of a product. It is what the brief calls the
 *    blog-post layout.
 * 4. **The panel was `min-h-[17rem]` with panels between 220 and 300px tall**, so
 *    every switch either left dead space or jumped the card's height.
 *
 * ## What replaces it
 *
 * **One card that contains its own controls**, and a layout that reads differently
 * at the two sizes rather than stacking the same thing twice:
 *
 * - **Below `lg`** the card *is* the section. Real `role="tab"` chips wrap inside
 *   it (all four visible — no scrolling strip), the panel is **swipeable**, and the
 *   active feature's sentence sits in a caption row beneath the panel. Nothing is
 *   stacked outside the card, so there is no article to scroll past.
 * - **At `lg`** the feature rail comes back beside it as a column of selectable
 *   cards — no hairline rules, no four-paragraph column — and the chips inside the
 *   card give way to a static label, because the rail is already the control.
 *
 * Three things make the motion behave:
 *
 * - **The panel's height is measured and animated**, so a 220px panel and a 300px
 *   one hand over smoothly and neither is clipped nor padded out.
 * - **The slide has a direction.** Tapping a chip further right, swiping left, or
 *   the timer advancing all move the panel leftward; going back moves it right. The
 *   wrap from the last panel to the first takes the short way round.
 * - **The auto-advance stops for good on the first interaction** — tap, swipe or
 *   arrow key — and the progress bar at the foot of the card stops with it, so the
 *   demo never moves under somebody who has taken hold of it. It also runs only
 *   while the card is on screen, and not at all under `prefers-reduced-motion`.
 *
 * Nothing is sticky and nothing is positioned over anything else.
 *
 * ## The hand, twice — because the two sizes have different affordances
 *
 * Both sizes get a pink pointing hand, and they are two components rather than one
 * with a breakpoint prop, because they answer two different questions.
 *
 * - **Below `lg`, `SwipeHint`** sits under the chips and mimes the swipe. The chips
 *   look like a segmented control to anybody who has used one before; the panel
 *   being *draggable* is the part nothing on screen announces.
 * - **At `lg`, `RailHint`** taps the rail row the demo is about to move to. The
 *   rail rows carry no button chrome — they are a title, a sentence and an icon,
 *   and the selected one is distinguished only by a soft fill — so on a still
 *   screenshot the column reads as a legend for the card beside it rather than as
 *   four controls. Hover says otherwise, but only after you have already guessed.
 *
 * Either way the timer moving the panel on its own reads as a slideshow rather
 * than as an invitation. The hand is the invitation, and it is spent the moment it
 * is accepted: `taken` stops the demo and takes both hints with it.
 */
export function ForSalons() {
  const features = forSalons.features;
  const count = features.length;

  const cardRef = useRef<HTMLDivElement>(null);
  const inView = useInView(cardRef, { amount: 0.3 });
  const reduced = useReducedMotion();

  /**
   * Where the rail's four rows sit, so the desktop hand can park beside one of
   * them. Measured rather than derived: the rows are as tall as their sentences
   * wrap, so they are four different heights and no two viewports agree about
   * which. `offsetTop` is relative to the rail wrapper, which is the rows'
   * offset parent because it is the only positioned ancestor.
   *
   * Empty below `lg` — the wrapper is `display: none` there, so every row
   * measures 0 — which is also what keeps the hand out of the DOM at those
   * widths without a second breakpoint to keep in step.
   */
  const railRef = useRef<HTMLDivElement>(null);
  const [rowCentres, setRowCentres] = useState<number[]>([]);

  /** `dir` is +1 for a leftward slide, -1 for a rightward one. */
  const [slide, setSlide] = useState({ active: 0, dir: 1 });
  const { active, dir } = slide;
  const [taken, setTaken] = useState(false);

  const running = inView && !taken && !reduced;

  const go = useCallback(
    (next: number, byHand: boolean) => {
      setSlide((prev) => {
        const to = ((next % count) + count) % count;
        if (to === prev.active) return prev;
        // Take the short way round the ring, so 4 → 1 slides forward rather than
        // winding all the way back through the middle.
        const forward = (to - prev.active + count) % count <= count / 2;
        return { active: to, dir: forward ? 1 : -1 };
      });
      if (byHand) setTaken(true);
    },
    [count],
  );

  /**
   * A relative move, for the two gestures that have a direction but no target:
   * the drag and the trackpad. Separate from `go` so it can be **stable** — it
   * reads the current panel out of the updater rather than closing over `active`,
   * which is what lets the wheel listener be attached once for the life of the
   * card instead of being torn down and rebuilt on every panel change.
   */
  const step = useCallback(
    (delta: number) => {
      setSlide((prev) => ({
        active: (((prev.active + delta) % count) + count) % count,
        dir: delta > 0 ? 1 : -1,
      }));
      setTaken(true);
    },
    [count],
  );

  useEffect(() => {
    const el = railRef.current;
    if (!el) return;
    // Same shape as the panel's height observer below: the callback fires once
    // on `observe()`, so the first measurement arrives without a `setState` in
    // the effect body. A row cannot change height without changing the column's,
    // so observing the wrapper alone catches every reflow — including the one
    // that matters most, `display: none` giving way to a box at `lg`.
    const observer = new ResizeObserver(() => {
      const rows = el.querySelectorAll<HTMLElement>('[role="tab"]');
      setRowCentres(
        el.offsetHeight === 0
          ? []
          : Array.from(rows, (row) => row.offsetTop + row.offsetHeight / 2),
      );
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // One timer per panel rather than one interval for the section: keying it on
  // `active` restarts the dwell whenever the panel changes for any reason, which
  // is also what keeps the progress bar and the panel in step.
  useEffect(() => {
    if (!running) return;
    const id = setTimeout(() => go(active + 1, false), DWELL_MS);
    return () => clearTimeout(id);
  }, [running, active, go]);

  /** Arrow keys move the selection and take focus with it — roving tabindex. */
  function onTabKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const arrow: Record<string, number> = {
      ArrowRight: 1,
      ArrowDown: 1,
      ArrowLeft: -1,
      ArrowUp: -1,
    };

    let to: number | null = null;
    if (event.key in arrow) to = active + arrow[event.key];
    else if (event.key === "Home") to = 0;
    else if (event.key === "End") to = count - 1;
    if (to === null) return;

    event.preventDefault();
    const index = ((to % count) + count) % count;
    go(index, true);

    const tabs =
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    tabs[index]?.focus();
  }

  return (
    // Canvas white. With the queue band above on `surface-soft`, the page
    // alternates white → surface-soft → white, which is the reference's whole
    // surface vocabulary.
    <Section id="for-salons" aria-labelledby="for-salons-title">
      <Container>
        <SectionHeading
          eyebrow={forSalons.eyebrow}
          title="Run the whole shop from _one screen_"
          body={forSalons.body}
          titleId="for-salons-title"
        />

        {/*
          Block flow below `lg` — where the rail is `display:none`, so the card and
          the call to action are simply two things in a column. From `lg` it is an
          explicit 2×2 grid: rail top-left, call to action under it, card down the
          right across both rows. Explicit placement rather than `order`, because
          the card has to span two rows and auto-placement cannot be told that.

          `items-start` keeps the card its own height inside that two-row area
          instead of stretching to meet the button.
        */}
        <div className="mt-9 sm:mt-11 lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-14">
          {/* ── The rail: desktop's control, and the crawlable copy at every width ──
              `hidden lg:block` is `display: none`, so below `lg` this is out of the
              accessibility tree and out of the tab order — which is what lets the
              chips inside the card be the only tablist on a phone — while its four
              titles and sentences stay in the HTML for a crawler.

              The wrapper exists for two reasons: it is what the hand is positioned
              against, and it keeps the hand *out* of the tablist, whose children
              should be tabs and nothing else. */}
          <div
            ref={railRef}
            className="relative hidden lg:col-start-1 lg:row-start-1 lg:block"
          >
            <div
              role="tablist"
              aria-label="What you can do from one screen"
              aria-orientation="vertical"
              onKeyDown={onTabKeyDown}
              className="flex flex-col gap-2"
            >
              {features.map((feature, i) => {
                const Icon = ICONS[i];
                const isActive = active === i;

                return (
                  <button
                    key={feature.title}
                    type="button"
                    role="tab"
                    id={`salon-tab-${i}`}
                    aria-selected={isActive}
                    aria-controls="salon-panel"
                    tabIndex={isActive ? 0 : -1}
                    onClick={() => go(i, true)}
                    className={cn(
                      "group relative overflow-hidden rounded-md p-4 text-left",
                      "transition-colors duration-300",
                      isActive
                        ? "bg-surface-soft ring-hairline ring-1 ring-inset"
                        : "hover:bg-surface-soft/70",
                    )}
                  >
                    <span className="flex items-start gap-4">
                      <span
                        className={cn(
                          "grid size-11 shrink-0 place-items-center rounded-full",
                          "transition-colors duration-300",
                          isActive
                            ? "bg-rausch-cta text-white"
                            : "bg-surface-strong text-muted group-hover:text-ink",
                        )}
                      >
                        <Icon className="size-5" strokeWidth={2} aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={cn(
                            "text-subheading block font-semibold transition-colors duration-300",
                            isActive
                              ? "text-ink"
                              : "text-muted group-hover:text-ink",
                          )}
                        >
                          {feature.title}
                        </span>
                        <span className="text-body mt-1.5 block text-body-sm">
                          {feature.body}
                        </span>
                      </span>
                    </span>

                    {/* The dwell, as a hairline along the foot of the selected card
                      only. It used to be an empty grey track under all four rows at
                      once, which is three rules the design never wanted and most of
                      what made the column read as an article. */}
                    <span className="absolute inset-x-0 bottom-0 block h-0.5">
                      <motion.span
                        key={`${i}-${isActive}-${running}`}
                        className="bg-rausch block h-full origin-left rounded-full"
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: isActive && running ? 1 : 0 }}
                        transition={
                          isActive && running
                            ? { duration: DWELL_MS / 1000, ease: "linear" }
                            : { duration: 0.3, ease: EASE }
                        }
                      />
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Held back until the rows have been measured, so it appears beside
                the row it means rather than sliding down from the top of the
                column on the first paint. An empty array is also how "below `lg`"
                is spelled — see the observer. */}
            {rowCentres.length === count && (
              <RailHint
                y={rowCentres[(active + 1) % count]}
                hinting={!taken}
                animate={running}
                reduced={Boolean(reduced)}
              />
            )}
          </div>

          {/* ── The card ─────────────────────────────────────────────────── */}
          <Reveal className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
            <ShopScreen
              ref={cardRef}
              features={features}
              active={active}
              dir={dir}
              running={running}
              hinting={!taken}
              reduced={Boolean(reduced)}
              onSelect={(i) => go(i, true)}
              onStep={step}
              onTabKeyDown={onTabKeyDown}
            />
          </Reveal>

          <Reveal className="mt-8 lg:col-start-1 lg:row-start-2">
            <Button href="#salon-plans" size="lg" variant="ghost">
              See salon plans
            </Button>
          </Reveal>
        </div>
      </Container>
    </Section>
  );
}

type Feature = (typeof forSalons.features)[number];

/**
 * The salon's screen: chrome, its own controls, a swipeable panel and the dwell.
 *
 * The panel's height is **measured, not guessed.** A `ResizeObserver` on the
 * padded content box reports the active panel's layout height and the wrapper
 * animates to it, so the four panels — which run from about 220px to 300px at
 * 360px wide — hand over without a jump and without any of them being clipped.
 * `offsetHeight` rather than `contentRect`, because the measured element is also
 * the drag target and needs its padding counted.
 *
 * The same element takes a **native `wheel` listener** so a two-finger trackpad
 * swipe steps the panel too — see the block comment on that effect for why it
 * cannot be an `onWheel` prop.
 */
function ShopScreen({
  ref,
  features,
  active,
  dir,
  running,
  hinting,
  reduced,
  onSelect,
  onStep,
  onTabKeyDown,
}: {
  ref: React.Ref<HTMLDivElement>;
  features: readonly Feature[];
  active: number;
  dir: number;
  running: boolean;
  hinting: boolean;
  reduced: boolean;
  onSelect: (index: number) => void;
  onStep: (delta: number) => void;
  onTabKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
}) {
  const measure = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    const el = measure.current;
    if (!el) return;
    // The observer fires once on `observe()`, which is where the first
    // measurement comes from — a synchronous `setHeight` in this effect body is
    // what `react-hooks/set-state-in-effect` exists to reject.
    const observer = new ResizeObserver(() => setHeight(el.offsetHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /*
    ## The trackpad

    A two-finger horizontal swipe is not a drag. It never presses a pointer down,
    so `motion`'s `drag` — and every `onDragEnd` threshold behind it — is blind to
    it: on a laptop the panel had a `cursor-grab` and a hand miming a swipe, and
    the swipe every laptop actually offers did nothing. It arrives as `wheel`
    events carrying `deltaX`.

    Four things this has to get right, and the first two are why it is a native
    listener rather than an `onWheel` prop:

    - **React registers `wheel` passively**, so `preventDefault()` from `onWheel`
      is ignored with a console warning. It has to be, hence
      `{ passive: false }`.
    - **The default is a page exit.** An unconsumed horizontal wheel is also the
      browser's back-navigation gesture, so without `preventDefault` the swipe
      that was meant to show the walk-in line leaves the site instead. Cancelled
      only when the event is horizontal, so a normal vertical scroll over the card
      still scrolls the page.
    - **Momentum is not a second swipe.** macOS keeps sending events for up to a
      second after the fingers lift; `spent` swallows the whole tail and only a
      real pause (`WHEEL_REST_MS`) starts a new gesture. Without it one flick runs
      through all four panels.
    - **Intent is read per event, not from the running total.** A diagonal scroll
      has some `deltaX` in it, and judging by the accumulated sum would eventually
      hijack a gesture that was mostly a page scroll.

    Deliberately **not** gated on `prefers-reduced-motion`, unlike the drag. That
    setting asks for less movement, not fewer ways in — and with the transitions
    already collapsed to zero, a wheel step here swaps the panel outright.
  */
  useEffect(() => {
    const el = measure.current;
    if (!el) return;

    let travel = 0;
    let last = 0;
    let spent = false;

    // An arrow bound after the null guard, not a hoisted declaration: TypeScript
    // treats a `function` here as created before the guard and loses the
    // narrowing on `el`.
    const onWheel = (event: WheelEvent) => {
      // Lines and pages are scaled to pixels on both axes, so the comparison
      // below is unaffected and only the threshold sees the difference.
      const scale =
        event.deltaMode === 1
          ? WHEEL_LINE_PX
          : event.deltaMode === 2
            ? el.clientHeight
            : 1;
      const dx = event.deltaX * scale;
      const dy = event.deltaY * scale;

      if (Math.abs(dx) <= Math.abs(dy)) return;
      event.preventDefault();

      if (event.timeStamp - last > WHEEL_REST_MS) {
        travel = 0;
        spent = false;
      }
      last = event.timeStamp;
      if (spent) return;

      travel += dx;
      if (Math.abs(travel) < WHEEL_COMMIT_PX) return;

      // Fingers left, content right — the same direction a leftward drag moves
      // the panel, and the direction the hand in `SwipeHint` mimes.
      onStep(travel > 0 ? 1 : -1);
      travel = 0;
      spent = true;
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [onStep]);

  const ActiveIcon = ICONS[active];
  const panels = [BookingsPanel, LinePanel, TeamPanel, WeekPanel];
  const Panel = panels[active];

  return (
    <div
      ref={ref}
      className="bg-paper ring-hairline shadow-card overflow-hidden rounded-md ring-1 ring-inset"
    >
      {/* A window, not a browser: no URL bar, nothing to decode. */}
      <div className="border-hairline-soft flex items-center gap-3 border-b px-4 py-3 sm:px-5">
        <span className="flex gap-1.5" aria-hidden>
          <span className="bg-hairline size-2.5 rounded-full" />
          <span className="bg-hairline size-2.5 rounded-full" />
          <span className="bg-hairline size-2.5 rounded-full" />
        </span>
        <span className="text-muted mx-auto text-caption font-medium">
          Norling Hair Studio
        </span>
      </div>

      {/*
        Below `lg` this is the section's only tablist, and it **wraps** rather than
        scrolling. Four labels at ~120px each fit two to a row inside a 288px card
        at 360px, so all four are visible and reachable — where the strip this
        replaced put the fourth one off the right edge behind a mask, with no
        scrollbar and no indication it moved.
      */}
      <div className="border-hairline-soft border-b px-4 py-3 sm:px-5 lg:hidden">
        <div
          role="tablist"
          aria-label="What you can do from one screen"
          aria-orientation="horizontal"
          onKeyDown={onTabKeyDown}
          className="flex flex-wrap gap-1.5"
        >
          {features.map((feature, i) => (
            <button
              key={feature.title}
              type="button"
              role="tab"
              id={`salon-chip-${i}`}
              aria-selected={active === i}
              aria-controls="salon-panel"
              tabIndex={active === i ? 0 : -1}
              onClick={() => onSelect(i)}
              className={cn(
                "rounded-full px-3 py-1.5 text-caption font-medium",
                "transition-colors duration-300",
                active === i
                  ? "bg-ink text-white"
                  : "bg-surface-soft text-body hover:text-ink",
              )}
            >
              {feature.title}
            </button>
          ))}
        </div>

        <SwipeHint hinting={hinting} animate={running} reduced={reduced} />
      </div>

      {/* At `lg` the rail beside the card is the control, so this row states which
          panel is showing instead of offering a second way to change it. */}
      <div className="border-hairline-soft hidden items-center gap-2.5 border-b px-5 py-3 lg:flex">
        <span className="bg-rausch-soft text-rausch grid size-7 shrink-0 place-items-center rounded-full">
          <ActiveIcon className="size-4" strokeWidth={2.2} aria-hidden />
        </span>
        <motion.span
          key={active}
          initial={reduced ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: EASE }}
          className="text-ink text-title font-semibold"
        >
          {features[active].title}
        </motion.span>
      </div>

      <motion.div
        className="overflow-hidden"
        // `initial={false}` so the card does not animate open from zero on the
        // first paint; `height: auto` until the first measurement lands, so
        // nothing is ever clipped waiting for it.
        initial={false}
        animate={{ height: height ?? "auto" }}
        transition={reduced ? { duration: 0 } : { duration: 0.42, ease: EASE }}
      >
        <motion.div
          ref={measure}
          id="salon-panel"
          role="tabpanel"
          // `aria-label` rather than `aria-labelledby`: both tablists are in the
          // DOM and one of them is always `display: none`, so pointing at a tab
          // would leave the reference dangling at one size or the other.
          aria-label={features[active].title}
          tabIndex={0}
          // Drag is the phone affordance and costs nothing on a mouse. The
          // constraints pin it to its slot and the elasticity is what makes a
          // half-swipe spring back instead of committing. `drag="x"` sets
          // `touch-action: pan-y` itself, so the page still scrolls vertically
          // under a finger that starts here; `touch-pan-y` states it anyway.
          //
          // A trackpad reaches the same step through the `wheel` listener above,
          // not through this: two fingers on a trackpad never press a pointer
          // down, so nothing here ever sees the gesture.
          drag={reduced ? false : "x"}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.14}
          dragMomentum={false}
          onDragEnd={(_, info) => {
            const travel = info.offset.x + info.velocity.x * 0.08;
            if (travel <= -SWIPE_COMMIT_PX) onStep(1);
            else if (travel >= SWIPE_COMMIT_PX) onStep(-1);
          }}
          className="touch-pan-y cursor-grab px-4 py-4 select-none active:cursor-grabbing sm:px-5 sm:py-5"
        >
          {/* Keyed, with no `AnimatePresence`: React swaps the panel in a single
              commit, so the measured box is never momentarily empty and the height
              never collapses between two panels. The outgoing panel leaves without
              an exit animation, which is also what keeps the switch at one moving
              part rather than three. */}
          <motion.div
            key={active}
            initial={reduced ? false : { opacity: 0, x: dir * 28 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: reduced ? 0 : 0.42, ease: EASE }}
          >
            <Panel />
          </motion.div>
        </motion.div>
      </motion.div>

      {/* The sentence for the active feature, inside the card. On a phone this is
          where the four stacked paragraphs went: one at a time, attached to the
          thing it describes, instead of a column of headings and rules. */}
      <div className="border-hairline-soft flex items-start gap-3 border-t px-4 py-3.5 sm:px-5 lg:hidden">
        <span className="bg-rausch-soft text-rausch mt-0.5 grid size-7 shrink-0 place-items-center rounded-full">
          <ActiveIcon className="size-4" strokeWidth={2.2} aria-hidden />
        </span>
        <motion.p
          key={active}
          initial={reduced ? false : { opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: EASE }}
          className="text-body text-body-sm"
        >
          {features[active].body}
        </motion.p>
      </div>

      {/* The dwell, along the very foot of the card. It is what makes the demo
          moving on a predicted event rather than a surprise — and it empties the
          moment somebody takes hold, which is the visible half of "it has stopped
          moving under you". */}
      <div className="bg-surface-strong h-1 w-full" aria-hidden>
        <motion.div
          key={`${active}-${running}`}
          className="bg-rausch h-full origin-left"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: running ? 1 : 0 }}
          transition={
            running
              ? { duration: DWELL_MS / 1000, ease: "linear" }
              : { duration: 0.3, ease: EASE }
          }
        />
      </div>
    </div>
  );
}

/**
 * One press-drag-lift, then a beat of nothing before the hand comes back.
 *
 * The split matters and the first attempt had it wrong: at `[0, .16, .62, .78, 1]`
 * over 2.2s with a 0.7s gap the hand was **absent for nearly half the loop**, and
 * six screenshots 300ms apart caught it four times as an empty row. A hint you
 * have to wait for is not a hint. Visible now runs about three times as long as
 * the pause — present enough to be caught by a glance, still punctuated rather
 * than a hand sliding back and forth for ever.
 */
const HINT_LOOP: Transition = {
  duration: 2.6,
  times: [0, 0.1, 0.55, 0.86, 1],
  repeat: Infinity,
  repeatDelay: 0.35,
  ease: "easeInOut",
};

/**
 * The mobile-only nudge: a small hand that presses, drags left and lifts.
 *
 * ## Why it is here and not over the panel
 *
 * The obvious place for a swipe hint is floating on the thing you swipe, and it
 * is the wrong place in this card: every one of the four panels fills its box to
 * the bottom edge — the legend under the day, the fourth person in the line, the
 * price pills, "Saturday 2–6pm is your busiest time" — so a floating hand would
 * cover live content in all four. It sits in the chip band instead, under the
 * chips and above the panel, which is between the two things it is talking about
 * and on top of neither. That also costs no new hairline: the band already has
 * one.
 *
 * ## The hand points up, which is the whole reason for this icon
 *
 * Lucide's `Pointer` is a hand with the index finger extended **upwards**, so
 * sitting below the chips it points at them while it travels sideways — the two
 * halves of the message ("these are the options" / "you can swipe between them")
 * in one glyph, rather than an arrow for one and a label for the other. The
 * travel is leftward because that is the drag that advances, matching what
 * `onDragEnd` actually commits.
 *
 * ## Four things keep it from becoming a nag
 *
 * - **It is spent on first use.** `hinting` is `!taken`, the same flag that stops
 *   the auto-advance, so a tap, a swipe or an arrow key collapses it away — height
 *   and opacity together, so nothing is left behind and no gap opens where it was.
 * - **It rests between loops.** The hand fades out at the end of each pass and
 *   `repeatDelay` holds it there, so the band is still for about as long as it
 *   moves.
 * - **It only runs while the card is on screen**, because `animate` is the card's
 *   own `running` flag.
 * - **`prefers-reduced-motion` gets the still frame**, not nothing: the hand
 *   parks in the middle at full opacity and the sentence stays. The guidance is
 *   the point; the movement was only ever the delivery.
 *
 * Every moving part stays inside a fixed 44×24 track, so the row's height never
 * changes and the chips above it never move. The ±12px travel is the widest that
 * fits: an 18px hand centred in 44px reaches 1px and 43px at the two ends, and
 * the 20px touch point reaches 0 and 44. Going further would put the hand in the
 * 8px gap before the sentence, which is the one direction there is no room in.
 */
function SwipeHint({
  hinting,
  animate,
  reduced,
}: {
  hinting: boolean;
  animate: boolean;
  reduced: boolean;
}) {
  const settle: Transition = { duration: 0.3, ease: EASE };

  return (
    <motion.div
      className="overflow-hidden"
      // `aria-hidden` once spent, because a collapsed box is still readable by a
      // screen reader — and the tablist above already announces itself as tabs,
      // so this sentence is for the eye that gets no such announcement.
      aria-hidden={!hinting}
      initial={false}
      animate={{ height: hinting ? "auto" : 0, opacity: hinting ? 1 : 0 }}
      transition={reduced ? { duration: 0 } : { duration: 0.4, ease: EASE }}
    >
      <div className="flex items-center gap-2 pt-2.5">
        <span
          className="relative grid h-6 w-11 shrink-0 place-items-center"
          aria-hidden
        >
          {/* The touch point, travelling with the finger. `inset-0 m-auto`
              centres it without a transform, which `motion` owns here. */}
          <motion.span
            className="bg-rausch/25 absolute inset-0 m-auto size-5 rounded-full"
            initial={false}
            animate={
              animate
                ? {
                    x: [12, 12, -12, -12, 12],
                    scale: [0.4, 1.05, 1.05, 1.15, 0.4],
                    opacity: [0, 0.9, 0.55, 0, 0],
                  }
                : { x: 0, scale: 1, opacity: 0 }
            }
            transition={animate ? HINT_LOOP : settle}
          />
          <motion.span
            className="text-rausch relative"
            initial={false}
            animate={
              animate
                ? {
                    x: [12, 12, -12, -12, 12],
                    rotate: [10, 0, -6, -6, 10],
                    scale: [0.86, 1, 1, 0.9, 0.86],
                    opacity: [0, 1, 1, 0, 0],
                  }
                : { x: 0, rotate: 0, scale: 1, opacity: 1 }
            }
            transition={animate ? HINT_LOOP : settle}
          >
            {/* 18px, not `size-4` — a 16px hand beside 12px type read as a
                smudge rather than a hand. `size-5` is as tall as the track. */}
            <Pointer
              className="size-[1.125rem]"
              strokeWidth={2.4}
              aria-hidden
            />
          </motion.span>
        </span>

        <span className="text-muted text-caption-sm">
          Swipe, or tap a title above
        </span>
      </div>
    </motion.div>
  );
}

/**
 * One tap, then a longer rest than the tap itself.
 *
 * The mobile hand fades out between passes because it is miming a gesture that
 * has a beginning and an end. This one does not: it is parked beside a row, and
 * a pointer that blinks out every two seconds reads as a glitch rather than as a
 * rest. So only the *tap* is periodic — the hand stays put — which is also what
 * keeps it on the quiet side of noticeable.
 */
const TAP_LOOP: Transition = {
  duration: 1.4,
  times: [0, 0.3, 0.55, 1],
  repeat: Infinity,
  repeatDelay: 1.2,
  ease: "easeInOut",
};

/**
 * The desktop nudge: a hand resting on the next rail row, tapping it.
 *
 * ## Where it sits, and why there is no room anywhere else
 *
 * Straddling the **right edge** of the row it is pointing at, half over the row's
 * own 16px padding and half in the 56px column gap. Both halves are empty by
 * construction — padding has no text in it and the gap has no column in it — so
 * this is the one place near a row that cannot overlap anything at any width. The
 * alternatives all fail on the same point: the rows' text runs the full width
 * between the icon and the right padding, and the 8px between rows is smaller
 * than the hand.
 *
 * It is `pointer-events-none`, which matters more here than it looks: it overlaps
 * a real control, and a hint that swallowed the click it is asking for would be
 * worse than no hint.
 *
 * ## It points at the *next* row, not a fixed one
 *
 * `(active + 1) % count`, so it is always beside a row that is **not** selected —
 * the requirement, since a hand on the row already showing says nothing. It
 * follows the demo down the column and takes the long way back to the top on the
 * wrap, which has the side effect of making the auto-advance look intended: the
 * hand taps a row, and a moment later that row is the one on screen.
 *
 * ## Motion
 *
 * Three states, and `prefers-reduced-motion` gets the third rather than nothing:
 * the hand still parks beside the next row at full opacity, still moves with the
 * selection, and simply does not tap. Guidance is the point; the tap was only the
 * delivery. The travel between rows is the same 0.55s ease as everything else in
 * this section, and it is the only movement that survives the setting — under it
 * the panel does not advance on its own, so the hand does not move either.
 *
 * Spent on first use, like the mobile one: `hinting` is `!taken`, and it leaves by
 * fading and shrinking rather than by unmounting, so nothing snaps.
 */
function RailHint({
  y,
  hinting,
  animate,
  reduced,
}: {
  y: number;
  hinting: boolean;
  animate: boolean;
  reduced: boolean;
}) {
  const settle: Transition = { duration: 0.3, ease: EASE };

  return (
    <motion.span
      aria-hidden
      // `-right-4` puts the 28px box's centre 2px outside the column: the 18px
      // hand reaches 11px into the row's 16px padding and 7px into the gap.
      className="pointer-events-none absolute top-0 -right-4 grid size-7 place-items-center"
      initial={false}
      animate={{
        // The box is 28px tall, so half of it is what centres the hand on the row.
        y: y - 14,
        opacity: hinting ? 1 : 0,
        scale: hinting ? 1 : 0.7,
      }}
      transition={reduced ? { duration: 0 } : { duration: 0.55, ease: EASE }}
    >
      {/* The touch point, expanding out from under the finger on the press. */}
      <motion.span
        className="bg-rausch/25 absolute inset-0 m-auto size-6 rounded-full"
        initial={false}
        animate={
          animate
            ? { scale: [0.45, 0.6, 1.4, 1.4], opacity: [0, 0.7, 0, 0] }
            : { scale: 1, opacity: 0 }
        }
        transition={animate ? TAP_LOOP : settle}
      />
      <motion.span
        className="text-rausch relative"
        initial={false}
        animate={
          animate
            ? {
                x: [0, -4, -4, 0],
                y: [0, 2, 2, 0],
                // Tilted toward the row it is tapping, and straightening slightly
                // as it presses — the wrist of the gesture, in two degrees.
                rotate: [-18, -10, -10, -18],
                scale: [1, 0.9, 0.9, 1],
              }
            : { x: 0, y: 0, rotate: -18, scale: 1 }
        }
        transition={animate ? TAP_LOOP : settle}
      >
        <Pointer className="size-[1.125rem]" strokeWidth={2.4} aria-hidden />
      </motion.span>
    </motion.span>
  );
}

function PanelHeading({ title, meta }: { title: string; meta: string }) {
  return (
    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <span className="text-ink text-title font-semibold">{title}</span>
      <span className="text-muted text-caption">{meta}</span>
    </div>
  );
}

/**
 * Today's chairs, hour by hour.
 *
 * The blocks still grow from their left edge on arrival — the panels each keep one
 * demonstrative animation, because a booking bar drawing itself is the thing being
 * shown. What went from all four is the per-row entrance stagger: the panel now
 * arrives as one object, and four rows arriving separately inside a card that is
 * itself sliding in was three animations too many.
 */
function BookingsPanel() {
  const rows = [
    {
      name: "Sonam",
      blocks: [
        { start: 0, span: 3, state: "done" },
        { start: 4, span: 4, state: "confirmed" },
      ],
    },
    {
      name: "Dechen",
      blocks: [
        { start: 1, span: 2, state: "confirmed" },
        { start: 6, span: 3, state: "next" },
      ],
    },
    {
      name: "Karma",
      blocks: [
        { start: 2, span: 3, state: "pending" },
        { start: 8, span: 2, state: "confirmed" },
      ],
    },
  ] as const;

  return (
    <div>
      <PanelHeading title="Today · Thursday" meta="11 booked · Nu 8,450" />
      <div className="flex flex-col gap-3">
        {rows.map((row) => (
          <div key={row.name} className="flex items-center gap-3">
            <span className="text-muted w-12 shrink-0 text-caption sm:w-14">
              {row.name}
            </span>
            {/*
              `bg-surface-soft`, not `bg-canvas` — the mock's own surface is paper
              white, so a "background" inside this card has to be a step away from
              white rather than white again. It used to be the sharper version of the
              same bug: `--color-canvas` was itself white out here, so the track
              resolved to the exact colour already behind it and vanished. The public
              pages are cream now (`data-shell="marketing"`) and `surface-soft` is a
              warm tint of it, so this reads as a track either way — but the rule that
              produced it is unchanged: inside a card, reach for `surface-soft`.
              `rounded-md` too: `rounded-lg` here is `--radius-lg`, **20px**, which on
              a 36px track is very nearly a pill.
            */}
            <div className="bg-surface-soft relative h-9 flex-1 rounded-md">
              {row.blocks.map((block) => (
                <motion.span
                  key={`${row.name}-${block.start}`}
                  initial={{ scaleX: 0, opacity: 0 }}
                  animate={{ scaleX: 1, opacity: 1 }}
                  transition={{ duration: 0.55, delay: 0.12, ease: EASE }}
                  className={cn(
                    // `rounded-sm` (8px), not `md` (14px) — on a 28px-tall block
                    // 14px is a full pill, and a day's bookings should read as
                    // blocks on a calendar rather than as tags.
                    "absolute inset-y-1 origin-left rounded-sm",
                    block.state === "confirmed" && "bg-rausch/85",
                    block.state === "next" && "bg-rausch ring-rausch/25 ring-2",
                    block.state === "pending" &&
                      "border-rausch/60 bg-rausch/10 border border-dashed",
                    block.state === "done" && "bg-ink/15",
                  )}
                  style={{
                    left: `${block.start * 9}%`,
                    width: `${block.span * 9}%`,
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="text-muted mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-caption-sm">
        <span className="flex items-center gap-1.5">
          <span className="bg-rausch/85 size-2.5 shrink-0 rounded-sm" /> Booked
        </span>
        <span className="flex items-center gap-1.5">
          <span className="border-rausch/60 bg-rausch/10 size-2.5 shrink-0 rounded-sm border border-dashed" />
          Waiting on the customer
        </span>
        <span className="flex items-center gap-1.5">
          <span className="bg-ink/15 size-2.5 shrink-0 rounded-sm" /> Finished
        </span>
      </div>
    </div>
  );
}

/** The walk-in line as the owner sees it. */
function LinePanel() {
  const rows = [
    { name: "Sonam D.", service: "Beard trim", badge: "In chair" },
    { name: "Karma W.", service: "Haircut + wash", badge: "Next" },
    { name: "Tashi P.", service: "Colour touch-up", badge: "~18 min" },
    { name: "Pema L.", service: "Kids cut", badge: "~27 min" },
  ];

  return (
    <div>
      <PanelHeading title="Walk-in line" meta="4 waiting · line open" />
      <div className="flex flex-col gap-2">
        {rows.map((row, i) => (
          <div
            key={row.name}
            className="bg-surface-soft flex items-center gap-3 rounded-md px-3 py-3 sm:px-3.5"
          >
            <span
              className={cn(
                "grid size-7 shrink-0 place-items-center rounded-full text-caption-sm font-semibold",
                i === 0 ? "bg-ink text-white" : "bg-paper text-muted",
              )}
            >
              {i}
            </span>
            <span className="min-w-0 flex-1">
              <span className="text-ink block truncate text-body-sm font-medium">
                {row.name}
              </span>
              <span className="text-muted block truncate text-caption-sm">
                {row.service}
              </span>
            </span>
            <span
              className={cn(
                "shrink-0 rounded-full px-2.5 py-1 text-caption-sm font-semibold",
                i === 1
                  ? "bg-rausch-cta text-white"
                  : i === 0
                    ? "bg-paper text-ink"
                    : "text-muted",
              )}
            >
              {row.badge}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Who works when, and the price list. */
function TeamPanel() {
  const staff = [
    { name: "Sonam Dorji", role: "Senior stylist", today: "9–6" },
    { name: "Dechen Yangzom", role: "Colour specialist", today: "11–8" },
    { name: "Karma Wangchuk", role: "Barber", today: "Day off" },
  ];
  const services = [
    { name: "Haircut", meta: "45 min · Nu 350" },
    { name: "Beard trim", meta: "20 min · Nu 150" },
    { name: "Colour", meta: "90 min · Nu 1,800" },
  ];

  return (
    <div>
      <PanelHeading
        title="Your team & prices"
        meta="3 stylists · 12 services"
      />
      <div className="flex flex-col gap-2.5">
        {staff.map((person) => (
          <div key={person.name} className="flex items-center gap-3">
            <span className="bg-rausch-soft text-rausch grid size-8 shrink-0 place-items-center rounded-full text-caption-sm font-semibold">
              {person.name
                .split(" ")
                .map((n) => n[0])
                .join("")}
            </span>
            <span className="min-w-0 flex-1">
              <span className="text-ink block truncate text-body-sm font-medium">
                {person.name}
              </span>
              <span className="text-muted block truncate text-caption-sm">
                {person.role}
              </span>
            </span>
            <span
              className={cn(
                "shrink-0 text-caption-sm font-medium",
                person.today === "Day off" ? "text-muted-soft" : "text-success",
              )}
            >
              {person.today}
            </span>
          </div>
        ))}
      </div>

      <div className="border-hairline-soft mt-4 flex flex-wrap gap-1.5 border-t pt-4">
        {services.map((service) => (
          <span
            key={service.name}
            className="bg-surface-soft rounded-full px-3 py-1.5 text-caption-sm"
          >
            <span className="text-ink font-medium">{service.name}</span>
            <span className="text-muted"> · {service.meta}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** How the week went, in plain numbers. */
function WeekPanel() {
  const bars = [
    { day: "M", value: 42 },
    { day: "T", value: 28 },
    { day: "W", value: 55 },
    { day: "T", value: 61 },
    { day: "F", value: 92 },
    { day: "S", value: 100 },
    { day: "S", value: 47 },
  ];

  return (
    <div>
      <PanelHeading title="This week" meta="Nu 61,200 · up 18%" />
      <div className="mb-5 grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { label: "Bookings", value: 148, suffix: "" },
          { label: "Came back", value: 63, suffix: "%" },
          { label: "No-shows", value: 4, suffix: "" },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="bg-surface-soft rounded-md px-2.5 py-2.5 sm:px-3"
          >
            <span className="text-ink text-heading block leading-tight font-semibold">
              <CountUp value={kpi.value} suffix={kpi.suffix} />
            </span>
            <span className="text-muted block truncate text-caption-sm">
              {kpi.label}
            </span>
          </div>
        ))}
      </div>

      {/* Bar heights are in px, not %: a percentage would resolve against an
          auto-height flex parent and collapse to zero. */}
      <div className="flex h-24 items-end gap-2 sm:gap-2.5">
        {bars.map((bar, i) => (
          <motion.span
            key={i}
            className={cn(
              "flex-1 rounded-t-sm",
              bar.value >= 92 ? "bg-rausch" : "bg-surface-strong",
            )}
            initial={{ height: 0 }}
            animate={{ height: Math.round(bar.value * 0.9) }}
            transition={{ duration: 0.65, delay: 0.08 + i * 0.04, ease: EASE }}
          />
        ))}
      </div>
      <div className="mt-2 flex gap-2 sm:gap-2.5">
        {bars.map((bar, i) => (
          <span
            key={i}
            className="text-muted flex-1 text-center text-caption-sm"
          >
            {bar.day}
          </span>
        ))}
      </div>
      <p className="text-muted mt-4 text-caption">
        Saturday 2–6pm is your busiest time.
      </p>
    </div>
  );
}
