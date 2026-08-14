"use client";

import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useInView,
  useReducedMotion,
} from "motion/react";
import { Bell, Scissors } from "lucide-react";
import { queueSection } from "@/lib/marketing/content";
import { cn } from "@/lib/marketing/utils";
import { MotifDiamond } from "./ui/bhutan";
import { Reveal } from "./ui/reveal";
import { Container, Section, SectionHeading } from "./ui/section";

const TICK_MS = 2600;

type Person = { name: string; service: string };

/**
 * The conveyor. A 5-deep window slides along this ring, so every tick one person
 * leaves the chair and one joins the back — and "You" climbs from the back of the
 * line to the chair once per lap.
 */
const RING: Person[] = [
  ...queueSection.queue.map((q) => ({ name: q.name, service: q.service })),
  { name: "Ugyen T.", service: "Shave" },
  { name: "Chimi Z.", service: "Blow-dry" },
  { name: "Jigme N.", service: "Haircut" },
  { name: "Dechen K.", service: "Head massage" },
];

const WINDOW = 5;

/** The 5 people visible at `tick`, with ids stable across ticks. */
function windowAt(tick: number) {
  return Array.from({ length: WINDOW }, (_, offset) => {
    const absolute = tick + offset;
    return { id: `p-${absolute}`, ...RING[absolute % RING.length] };
  });
}

/**
 * The virtual queue, actually moving.
 *
 * ## It is a light band now
 *
 * This was an obsidian slab with a 2.75rem radius, film grain, and a warm saffron
 * spotlight that followed the cursor across it. Three separate effects on one
 * section, and the section's job is to show a list of five names changing.
 *
 * The reference has one surface vocabulary — canvas white, `surface-soft` #f7f7f7,
 * hairlines — and the page now uses it everywhere else, so a dark band here was the
 * one place the visitor crossed into a different design. `surface-soft` between two
 * hairlines does the same job the dark slab was doing (it separates this band from
 * the white ones either side) without introducing a second palette, and the board
 * reads far better as ink on white than as white on near-black.
 *
 * The page keeps exactly one dark moment, and it is the closing call to action —
 * which is a photograph, not a fill.
 */
export function QueueLive() {
  return (
    <Section
      id="queue"
      aria-labelledby="queue-title"
      className="bg-surface-soft border-hairline-soft border-y"
    >
      <Container>
        {/* `min-w-0` on both columns, and it is the fix for a page-wide bug rather
            than a precaution. A grid item's default `min-width: auto` refuses to
            shrink below its own min-content, and the board's notification row makes
            that 328px — so on any viewport under ~368 this one track pushed the
            **whole document** wider than the window and every section on the site
            scrolled sideways with it. Measured at 320px: 348 against a 320 window.
            The board's own rows already carry `truncate` and `min-w-0`, so the only
            thing that was missing was permission to use them. */}
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
          <div className="min-w-0">
            <SectionHeading
              eyebrow={queueSection.eyebrow}
              title="Watch the line _move, live_"
              body={queueSection.body}
              titleId="queue-title"
            />

            <Reveal delay={0.12} className="mt-8">
              <div className="bg-canvas ring-hairline shadow-card inline-flex items-center gap-4 rounded-md p-4 ring-1 ring-inset">
                <QrTile />
                <span className="min-w-0">
                  <span className="text-ink text-ui block font-semibold">
                    {queueSection.qrCaption}
                  </span>
                  <span className="text-muted block text-caption">
                    {queueSection.qrSub}
                  </span>
                </span>
                <MotifDiamond className="text-rausch/45 ml-1 size-5 shrink-0" />
              </div>
            </Reveal>
          </div>

          <Reveal delay={0.08} className="min-w-0">
            <QueueBoard />
          </Reveal>
        </div>
      </Container>
    </Section>
  );
}

/** The live board: entries advance, "You" climbs to the chair, then it loops. */
function QueueBoard() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.4 });
  const reduced = useReducedMotion();
  // The queue only advances while the board is on screen.
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!inView || reduced) return;
    const id = setInterval(() => setTick((t) => t + 1), TICK_MS);
    return () => clearInterval(id);
  }, [inView, reduced]);

  const list = windowAt(tick);
  const youIndex = list.findIndex((e) => e.name === "You");

  return (
    <div
      ref={ref}
      className="bg-canvas ring-hairline shadow-card relative rounded-md p-5 ring-1 ring-inset sm:p-6"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="bg-rausch-cta grid size-10 shrink-0 place-items-center rounded-full text-white">
            <Scissors className="size-5" strokeWidth={2.2} aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="text-ink text-ui block truncate font-semibold">
              Norling Hair Studio
            </span>
            <span className="text-muted block truncate text-caption">
              2 chairs · Thimphu
            </span>
          </span>
        </div>
        <span className="text-muted bg-surface-soft ring-hairline-soft inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-badge font-semibold tracking-[0.08em] uppercase ring-1 ring-inset">
          <span className="bg-rausch size-1.5 animate-pulse rounded-full" />
          Live
        </span>
      </div>

      <ul className="mt-5 flex flex-col gap-2">
        <AnimatePresence initial={false} mode="popLayout">
          {list.map((entry, i) => {
            const state = i === 0 ? "in-chair" : i === 1 ? "next" : "waiting";
            const isYou = entry.name === "You";

            return (
              <motion.li
                key={entry.id}
                layout
                initial={{ opacity: 0, y: 22, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 32, scale: 0.96 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3.5 py-3 ring-1 ring-inset",
                  isYou
                    ? "bg-rausch-soft ring-rausch/35"
                    : state === "in-chair"
                      ? "bg-surface-strong ring-transparent"
                      : "bg-surface-soft ring-transparent",
                )}
              >
                <span
                  className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-full text-caption font-semibold",
                    state === "in-chair"
                      ? "bg-ink text-white"
                      : isYou
                        ? "bg-rausch-cta text-white"
                        : "bg-canvas text-muted",
                  )}
                >
                  {state === "in-chair" ? (
                    <Scissors className="size-4" strokeWidth={2.4} aria-hidden />
                  ) : (
                    `#${i}`
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "text-ui block truncate font-medium",
                      isYou ? "text-ink font-semibold" : "text-ink",
                    )}
                  >
                    {entry.name}
                  </span>
                  <span className="text-muted block truncate text-caption">
                    {entry.service}
                  </span>
                </span>

                {state === "in-chair" && (
                  <span className="bg-canvas text-muted shrink-0 rounded-full px-2.5 py-1 text-badge font-semibold tracking-[0.08em] uppercase">
                    In chair
                  </span>
                )}
                {state === "next" && (
                  <span className="bg-rausch-cta shrink-0 rounded-full px-2.5 py-1 text-badge font-semibold tracking-[0.08em] text-white uppercase">
                    Next
                  </span>
                )}
                {state === "waiting" && (
                  <span className="text-muted-soft shrink-0 text-caption tabular-nums">
                    ~{i * 9} min
                  </span>
                )}
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>

      {/* The notification that fires when "You" is two turns out. Ink, so the one
          moment on this band that is meant to interrupt actually does. */}
      <AnimatePresence>
        {youIndex === 2 && (
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="bg-ink mt-4 flex items-center gap-3 rounded-md px-4 py-3.5"
          >
            <span className="bg-rausch-cta grid size-9 shrink-0 place-items-center rounded-full text-white">
              <Bell className="size-4" strokeWidth={2.2} aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-body-sm font-semibold text-white">
                You&apos;re two away — start heading back
              </span>
              <span className="block truncate text-caption text-white/60">
                Norling Hair Studio · about 18 min
              </span>
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * A stylised QR mark. The module pattern is derived from the cell coordinates so
 * server and client render identically (no `Math.random`, no hydration mismatch) —
 * it is decoration, not a scannable code. The real, scannable one is in the download
 * band.
 */
function QrTile() {
  const size = 11;
  const cells: boolean[] = [];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const finder =
        (x < 3 && y < 3) || (x > size - 4 && y < 3) || (x < 3 && y > size - 4);
      const hash = (x * 7 + y * 13 + ((x * y) % 5)) % 3;
      cells.push(finder || hash === 0);
    }
  }

  return (
    <span
      className="bg-surface-soft ring-hairline-soft grid size-12 shrink-0 gap-[1px] rounded-sm p-1.5 ring-1 ring-inset"
      style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}
      aria-hidden
    >
      {cells.map((on, i) => (
        <span
          key={i}
          className={cn("rounded-[0.5px]", on ? "bg-ink" : "bg-transparent")}
        />
      ))}
    </span>
  );
}
