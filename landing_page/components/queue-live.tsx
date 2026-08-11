"use client";

import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useInView,
  useReducedMotion,
} from "motion/react";
import { Bell, Scissors } from "lucide-react";
import { queueSection } from "@/lib/content";
import { cn } from "@/lib/utils";
import { MotifDiamond } from "./ui/bhutan";
import { Reveal } from "./ui/reveal";
import { Container, Section, SectionHeading } from "./ui/section";
import { Spotlight } from "./ui/spotlight";

const TICK_MS = 2600;

type Person = { name: string; service: string };

/**
 * The conveyor. A 5-deep window slides along this ring, so every tick one
 * person leaves the chair and one joins the back — and "You" climbs from the
 * back of the line to the chair once per lap.
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

export function QueueLive() {
  return (
    <Section
      id="queue"
      aria-labelledby="queue-title"
      className="bg-obsidian grain rounded-slab-lg relative mx-2 overflow-hidden sm:mx-4"
    >
      {/* Warm light trailing the cursor across the dark band. */}
      <Spotlight>
        <Container>
          <div className="grid gap-14 lg:grid-cols-2 lg:items-center lg:gap-20">
            <div>
              <SectionHeading
                eyebrow={queueSection.eyebrow}
                title="Watch the line _move, live_"
                body={queueSection.body}
                tone="light"
                titleId="queue-title"
              />

              <Reveal delay={0.15} className="mt-9">
                <div className="inline-flex items-center gap-4 rounded-2xl bg-white/8 p-4 ring-1 ring-white/12 ring-inset">
                  <QrTile />
                  <span>
                    <span className="block text-ui font-semibold text-white">
                      {queueSection.qrCaption}
                    </span>
                    <span className="block text-caption text-white/60">
                      {queueSection.qrSub}
                    </span>
                  </span>
                  <MotifDiamond className="text-saffron ml-2 size-5" />
                </div>
              </Reveal>
            </div>

            <Reveal direction="left" delay={0.1}>
              <QueueBoard />
            </Reveal>
          </div>
        </Container>
      </Spotlight>
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
      className="rounded-slab bg-obsidian-soft/90 relative p-5 ring-1 ring-white/12 ring-inset backdrop-blur-xl sm:p-6"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="bg-rausch grid size-10 place-items-center rounded-xl text-white">
            <Scissors className="size-5" strokeWidth={2.2} aria-hidden />
          </span>
          <span>
            <span className="block text-ui font-semibold text-white">
              Norling Hair Studio
            </span>
            <span className="block text-caption text-white/55">
              2 chairs · Thimphu
            </span>
          </span>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1.5 text-caption-sm font-semibold tracking-wider text-white uppercase">
          <span className="bg-rausch size-1.5 animate-pulse rounded-full" />
          Live
        </span>
      </div>

      <ul className="mt-6 flex flex-col gap-2.5">
        <AnimatePresence initial={false} mode="popLayout">
          {list.map((entry, i) => {
            const state = i === 0 ? "in-chair" : i === 1 ? "next" : "waiting";
            const isYou = entry.name === "You";

            return (
              <motion.li
                key={entry.id}
                layout
                initial={{ opacity: 0, y: 26, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 40, scale: 0.95 }}
                transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                className={cn(
                  "flex items-center gap-3.5 rounded-2xl px-4 py-3.5 ring-1 ring-inset",
                  isYou
                    ? "bg-rausch/14 ring-rausch/45"
                    : state === "in-chair"
                      ? "bg-white/10 ring-white/15"
                      : "bg-white/[0.04] ring-white/10",
                )}
              >
                <span
                  className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-full text-caption font-semibold",
                    state === "in-chair"
                      ? "bg-white text-ink"
                      : isYou
                        ? "bg-rausch text-white"
                        : "bg-white/10 text-white/70",
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
                      "block truncate text-ui font-medium",
                      isYou ? "text-white" : "text-white/85",
                    )}
                  >
                    {entry.name}
                  </span>
                  <span className="block truncate text-caption text-white/50">
                    {entry.service}
                  </span>
                </span>

                {state === "in-chair" && (
                  <span className="shrink-0 rounded-full bg-white/12 px-2.5 py-1 text-caption-sm font-semibold tracking-wider text-white/80 uppercase">
                    In chair
                  </span>
                )}
                {state === "next" && (
                  <span className="bg-rausch shrink-0 rounded-full px-2.5 py-1 text-caption-sm font-semibold tracking-wider text-white uppercase">
                    Next
                  </span>
                )}
                {state === "waiting" && (
                  <span className="shrink-0 text-caption text-white/45">
                    ~{i * 9} min
                  </span>
                )}
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>

      {/* The notification that fires when "You" is two turns out. */}
      <AnimatePresence>
        {youIndex === 2 && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="mt-4 flex items-center gap-3 rounded-2xl bg-white px-4 py-3.5"
          >
            <span className="bg-rausch-soft text-rausch grid size-9 shrink-0 place-items-center rounded-full">
              <Bell className="size-4" strokeWidth={2.2} aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="text-ink block text-body-sm font-semibold">
                You&apos;re two away — start heading back
              </span>
              <span className="text-muted block text-caption">
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
 * A stylised QR mark. The module pattern is derived from the cell coordinates
 * so server and client render identically (no `Math.random`, no hydration
 * mismatch) — it is decoration, not a scannable code.
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
      className="grid size-12 shrink-0 gap-[1px] rounded-lg bg-white p-1.5"
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
