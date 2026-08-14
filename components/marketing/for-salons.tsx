"use client";

import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useInView,
  useReducedMotion,
} from "motion/react";
import { CalendarDays, Users, UsersRound, TrendingUp } from "lucide-react";
import { forSalons } from "@/lib/marketing/content";
import { cn } from "@/lib/marketing/utils";
import { Button } from "./ui/button";
import { CountUp } from "./ui/count-up";
import { Reveal } from "./ui/reveal";
import { Container, Section, SectionHeading } from "./ui/section";

const EASE = [0.16, 1, 0.3, 1] as const;
const ICONS = [CalendarDays, UsersRound, Users, TrendingUp];
const DWELL_MS = 5000;

/**
 * The owner half of the story.
 *
 * The screen mock and the feature list are driven by a plain active index that
 * advances on a timer (and on tap), NOT by scroll position. The old version
 * pinned the mock and read scroll offsets, which only worked on a wide screen —
 * on a phone the mock had already scrolled away by the time you reached the
 * feature it was illustrating. A timer works identically at every size, and
 * tapping any feature takes over.
 */
export function ForSalons() {
  // Observe the mock itself, not the whole two-column block: the block is
  // taller than a phone screen, so its intersection ratio is unstable and the
  // timer would stop the moment the ratio dipped under the threshold.
  const mockRef = useRef<HTMLDivElement>(null);
  const inView = useInView(mockRef, { amount: 0.4 });
  const reduced = useReducedMotion();
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!inView || paused || reduced) return;
    const id = setInterval(
      () => setActive((i) => (i + 1) % forSalons.features.length),
      DWELL_MS,
    );
    return () => clearInterval(id);
  }, [inView, paused, reduced]);

  function choose(index: number) {
    setActive(index);
    // Once someone picks, stop moving under them.
    setPaused(true);
  }

  return (
    // Canvas white, not the cream `canvas-deep` tint it carried. With the queue
    // band above now sitting on `surface-soft`, the page alternates white →
    // surface-soft → white, which is the reference's whole surface vocabulary; a
    // third warm tint in the middle of it was the only cream left on the page.
    <Section id="for-salons" aria-labelledby="for-salons-title">
      <Container>
        <SectionHeading
          eyebrow={forSalons.eyebrow}
          title="Run the whole shop from _one screen_"
          body={forSalons.body}
          titleId="for-salons-title"
        />

        {/* Block flow on a phone, two columns from lg. This matters: in a
            single-column *grid* the mock's row is exactly its own height, so it
            would have no room to stick. In block flow its containing block is
            this whole wrapper, so it stays on screen while the list is read. */}
        <div className="mt-10 sm:mt-12 lg:grid lg:grid-cols-2 lg:items-start lg:gap-14">
          <div
            ref={mockRef}
            /* Sticks clear of the fixed bar rather than under it: the offset is the
               header's own token plus a gap, where it used to be a hardcoded
               `top-20`/`sm:top-24` guessed against a header that has since changed
               height twice. */
            className="sticky top-[calc(var(--site-header-height)+1.5rem)] z-10 mb-9 self-start lg:order-2 lg:mb-0"
          >
            <Reveal>
              <MockScreen active={active} />
            </Reveal>
          </div>

          <div
            role="tablist"
            aria-label="What you can do from one screen"
            aria-orientation="vertical"
            className="flex flex-col lg:order-1"
          >
            {forSalons.features.map((feature, i) => {
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
                  onClick={() => choose(i)}
                  className={cn(
                    "group border-hairline-soft border-b py-5 text-left first:border-t",
                    "transition-colors duration-200",
                  )}
                >
                  <span className="flex items-start gap-4">
                    {/* A circle, and no scale on activation. The reference's
                        `icon-button-circle` is a `surface-strong` disc; the accent
                        fill is what marks the active row, so a 5% scale on top of a
                        colour change was a second signal for the same state. */}
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
                          isActive ? "text-ink" : "text-muted group-hover:text-ink",
                        )}
                      >
                        {feature.title}
                      </span>
                      {/* Always in the DOM — crawlable, and readable at a glance
                          whether or not this row is the active one. */}
                      <span className="text-body mt-1.5 block text-body-md">
                        {feature.body}
                      </span>

                      {/* Dwell bar: shows which row the mock is showing, and how
                          long until it moves on. */}
                      <span className="bg-hairline-soft mt-4 block h-0.5 w-full overflow-hidden rounded-full">
                        <motion.span
                          key={`${i}-${isActive}-${paused}`}
                          className="bg-rausch block h-full origin-left rounded-full"
                          initial={{ scaleX: isActive ? 0 : 0 }}
                          animate={{ scaleX: isActive ? 1 : 0 }}
                          transition={
                            isActive && !paused && !reduced
                              ? { duration: DWELL_MS / 1000, ease: "linear" }
                              : { duration: 0.5, ease: EASE }
                          }
                        />
                      </span>
                    </span>
                  </span>
                </button>
              );
            })}

            <Reveal className="pt-8">
              <Button href="#salon-plans" size="lg" variant="ghost">
                See salon plans
              </Button>
            </Reveal>
          </div>
        </div>
      </Container>
    </Section>
  );
}

/** The salon's screen, one panel per feature. */
function MockScreen({ active }: { active: number }) {
  const panels = [
    <BookingsPanel key="bookings" />,
    <LinePanel key="line" />,
    <TeamPanel key="team" />,
    <WeekPanel key="week" />,
  ];
  const labels = forSalons.features.map((f) => f.title);

  return (
    <div className="bg-canvas ring-hairline shadow-card relative overflow-hidden rounded-md ring-1 ring-inset">
      {/* A window, not a browser: no URL bar, nothing to decode. */}
      <div className="border-hairline-soft flex items-center gap-3 border-b px-5 py-3.5">
        <span className="flex gap-1.5" aria-hidden>
          <span className="bg-hairline size-2.5 rounded-full" />
          <span className="bg-hairline size-2.5 rounded-full" />
          <span className="bg-hairline size-2.5 rounded-full" />
        </span>
        <span className="text-muted mx-auto text-caption font-medium">
          Norling Hair Studio
        </span>
      </div>

      {/* Tab rail mirroring the active feature. */}
      <div className="border-hairline-soft mask-edges flex gap-1 overflow-x-auto border-b px-4 py-2.5">
        {labels.map((label, i) => (
          <span
            key={label}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-caption font-medium transition-colors duration-500",
              active === i ? "bg-ink text-white" : "text-muted",
            )}
          >
            {label}
          </span>
        ))}
      </div>

      <div
        id="salon-panel"
        role="tabpanel"
        aria-labelledby={`salon-tab-${active}`}
        className="min-h-[17rem] p-5"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.45, ease: EASE }}
          >
            {panels[active]}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* The `animate-sheen` sweep that used to run across this card for ever is
          gone with the rest of the ambient motion. The panel already changes every
          five seconds; a light bar crossing it on a 3.2s loop was a second,
          unrelated animation on the same element. */}
    </div>
  );
}

function PanelHeading({ title, meta }: { title: string; meta: string }) {
  return (
    <div className="mb-4 flex items-baseline justify-between">
      <span className="text-ink text-ui font-semibold">{title}</span>
      <span className="text-muted text-caption">{meta}</span>
    </div>
  );
}

/** Today's chairs, hour by hour. */
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
            <span className="text-muted w-14 shrink-0 text-caption">
              {row.name}
            </span>
            {/*
              `bg-surface-soft`, not `bg-canvas` — and this was invisible before,
              not merely wrong. The mock's own surface is white and `--color-canvas`
              on the public pages *is* white, so every "background" inside this card
              resolved to the colour already behind it. Four rows had it.

              `rounded-md` too: `rounded-lg` in this repo is `--radius-lg`, **20px**,
              not Tailwind's 8px — on a 36px-tall track that is very nearly a pill.
            */}
            <div className="bg-surface-soft relative h-9 flex-1 rounded-md">
              {row.blocks.map((block) => (
                <motion.span
                  key={`${row.name}-${block.start}`}
                  initial={{ scaleX: 0, opacity: 0 }}
                  animate={{ scaleX: 1, opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.1, ease: EASE }}
                  className={cn(
                    // `rounded-sm` (8px), not `md` (14px) — on a 28px-tall block
                    // 14px is a full pill, and a day's bookings should read as
                    // blocks on a calendar rather than as tags.
                    "absolute inset-y-1 origin-left rounded-sm",
                    block.state === "confirmed" && "bg-rausch/85",
                    block.state === "next" && "bg-rausch ring-2 ring-rausch/25",
                    block.state === "pending" &&
                      "border border-dashed border-rausch/60 bg-rausch/10",
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
      <div className="text-muted mt-4 flex flex-wrap gap-4 text-caption-sm">
        <span className="flex items-center gap-1.5">
          <span className="bg-rausch/85 size-2.5 rounded-sm" /> Booked
        </span>
        <span className="flex items-center gap-1.5">
          <span className="border-rausch/60 bg-rausch/10 size-2.5 rounded-sm border border-dashed" />
          Waiting on the customer
        </span>
        <span className="flex items-center gap-1.5">
          <span className="bg-ink/15 size-2.5 rounded-sm" /> Finished
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
          <motion.div
            key={row.name}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: i * 0.06, ease: EASE }}
            className="bg-surface-soft flex items-center gap-3 rounded-md px-3.5 py-3"
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
          </motion.div>
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
      <div className="flex flex-col gap-2">
        {staff.map((person, i) => (
          <motion.div
            key={person.name}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: i * 0.06, ease: EASE }}
            className="flex items-center gap-3"
          >
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
          </motion.div>
        ))}
      </div>

      <div className="border-hairline-soft mt-4 flex flex-wrap gap-2 border-t pt-4">
        {services.map((service, i) => (
          <motion.span
            key={service.name}
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.15 + i * 0.05, ease: EASE }}
            className="bg-surface-soft rounded-full px-3 py-1.5 text-caption-sm"
          >
            <span className="text-ink font-medium">{service.name}</span>
            <span className="text-muted"> · {service.meta}</span>
          </motion.span>
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
      <div className="mb-5 grid grid-cols-3 gap-3">
        {[
          { label: "Bookings", value: 148, suffix: "" },
          { label: "Came back", value: 63, suffix: "%" },
          { label: "No-shows", value: 4, suffix: "" },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-surface-soft rounded-md px-3 py-2.5">
            <span className="text-ink block text-heading leading-tight font-semibold">
              <CountUp value={kpi.value} suffix={kpi.suffix} />
            </span>
            <span className="text-muted block text-caption-sm">
              {kpi.label}
            </span>
          </div>
        ))}
      </div>

      {/* Bar heights are in px, not %: a percentage would resolve against an
          auto-height flex parent and collapse to zero. */}
      <div className="flex h-24 items-end gap-2.5">
        {bars.map((bar, i) => (
          <motion.span
            key={i}
            className={cn(
              "flex-1 rounded-t-sm",
              bar.value >= 92 ? "bg-rausch" : "bg-surface-strong",
            )}
            initial={{ height: 0 }}
            animate={{ height: Math.round(bar.value * 0.9) }}
            transition={{ duration: 0.7, delay: i * 0.05, ease: EASE }}
          />
        ))}
      </div>
      <div className="mt-2 flex gap-2.5">
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
