"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { CalendarDays, Users, UsersRound, TrendingUp } from "lucide-react";
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
 */
export function ForSalons() {
  const features = forSalons.features;
  const count = features.length;

  const cardRef = useRef<HTMLDivElement>(null);
  const inView = useInView(cardRef, { amount: 0.3 });
  const reduced = useReducedMotion();

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
    const step: Record<string, number> = {
      ArrowRight: 1,
      ArrowDown: 1,
      ArrowLeft: -1,
      ArrowUp: -1,
    };

    let to: number | null = null;
    if (event.key in step) to = active + step[event.key];
    else if (event.key === "Home") to = 0;
    else if (event.key === "End") to = count - 1;
    if (to === null) return;

    event.preventDefault();
    const index = ((to % count) + count) % count;
    go(index, true);

    const tabs = event.currentTarget.querySelectorAll<HTMLButtonElement>(
      '[role="tab"]',
    );
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
              titles and sentences stay in the HTML for a crawler. */}
          <div
            role="tablist"
            aria-label="What you can do from one screen"
            aria-orientation="vertical"
            onKeyDown={onTabKeyDown}
            className="hidden lg:col-start-1 lg:row-start-1 lg:flex lg:flex-col lg:gap-2"
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

          {/* ── The card ─────────────────────────────────────────────────── */}
          <Reveal className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
            <ShopScreen
              ref={cardRef}
              features={features}
              active={active}
              dir={dir}
              running={running}
              reduced={Boolean(reduced)}
              onSelect={(i) => go(i, true)}
              onStep={(delta) => go(active + delta, true)}
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
 */
function ShopScreen({
  ref,
  features,
  active,
  dir,
  running,
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

  const ActiveIcon = ICONS[active];
  const panels = [BookingsPanel, LinePanel, TeamPanel, WeekPanel];
  const Panel = panels[active];

  return (
    <div
      ref={ref}
      className="bg-canvas ring-hairline shadow-card overflow-hidden rounded-md ring-1 ring-inset"
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
      <div
        role="tablist"
        aria-label="What you can do from one screen"
        aria-orientation="horizontal"
        onKeyDown={onTabKeyDown}
        className="border-hairline-soft flex flex-wrap gap-1.5 border-b px-4 py-3 sm:px-5 lg:hidden"
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
          className="text-ink text-ui font-semibold"
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
          // Drag is the phone affordance and costs nothing on a pointer. The
          // constraints pin it to its slot and the elasticity is what makes a
          // half-swipe spring back instead of committing. `drag="x"` sets
          // `touch-action: pan-y` itself, so the page still scrolls vertically
          // under a finger that starts here; `touch-pan-y` states it anyway.
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

function PanelHeading({ title, meta }: { title: string; meta: string }) {
  return (
    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <span className="text-ink text-ui font-semibold">{title}</span>
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
              `bg-surface-soft`, not `bg-canvas` — the mock's own surface is white
              and `--color-canvas` on the public pages *is* white, so every
              "background" inside this card used to resolve to the colour already
              behind it. `rounded-md` too: `rounded-lg` here is `--radius-lg`,
              **20px**, which on a 36px track is very nearly a pill.
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
                i === 0 ? "bg-ink text-white" : "bg-canvas text-muted",
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
                    ? "bg-canvas text-ink"
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
      <PanelHeading title="Your team & prices" meta="3 stylists · 12 services" />
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
