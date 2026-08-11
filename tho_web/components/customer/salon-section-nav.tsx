"use client";

import { useEffect, useState } from "react";
import { Carousel } from "@/components/ui/carousel";
import { cn } from "@/lib/utils";

/**
 * The sticky section nav — Fresha's *Photos · Services · Team · Reviews · About*, and the
 * thing that replaced this page's tab bar.
 *
 * ## Anchors, not tabs, and that is a content decision rather than a styling one
 *
 * `SalonTabs` showed **one** panel at a time: picking Reviews unmounted Specialists. That
 * is right on a phone screen with no room for both, which is where it was ported from —
 * and wrong for a page whose whole job is to answer *"is this salon any good"*, because
 * the answer is spread across four panels and the visitor has to know to go looking. Every
 * section is on the page now and this scrolls to them, so the reading is continuous and
 * the nav is a shortcut rather than a gate.
 *
 * Three things follow from that, all of them improvements rather than costs:
 *
 * - **Everything is in the document**, so browser find-in-page reaches a stylist's name
 *   and a review's text. Under tabs it could only find the open panel.
 * - **Every section is linkable.** `/salon/<id>#reviews` is a URL now; `?tab=Reviews`
 *   was one too, but only this one survives being scrolled past.
 * - **No client state decides what renders.** The page is server-rendered whole; this
 *   component only highlights.
 *
 * ## The highlight is derived from an observer, never from the click
 *
 * Setting `active` in the click handler is the version that lies: it lights the target
 * immediately and then disagrees with the page for the whole smooth scroll, and it stays
 * lit when the visitor scrolls away by hand. One `IntersectionObserver` over the section
 * elements is the single source, so a click and a scroll produce the same answer by the
 * same route.
 *
 * **The observer decides *when* to re-read, and the geometry decides *what* is current.**
 * That split is deliberate: `rootMargin` cannot express the rule, because it takes only
 * lengths and percentages — a `calc()` in it is a `SyntaxError` that throws at construction
 * and leaves the nav permanently on its first item. So the margin stays trivial and the
 * answer comes from measuring the sections when something crosses the viewport: the current
 * section is the **last** one whose top has passed the reading line, which is the rule a
 * reader actually uses.
 */

/**
 * The chrome above a section when it is scrolled "to the top": the fixed header plus this
 * bar. A CSS string, because its only consumer is `scroll-margin-top` — where `calc()` is
 * fine, unlike in the observer.
 */
const CHROME = "calc(var(--header-height) + 3.25rem)";

/** How far down the viewport a section's top must be before it counts as the one being read. */
const READING_LINE = 0.45;

export function SalonSectionNav({
  sections,
}: {
  /** In document order. `id` must match the section element's `id`. */
  sections: { id: string; label: string }[];
}) {
  const [active, setActive] = useState<string | null>(sections[0]?.id ?? null);

  // The ids, as a primitive, so the effect does not re-run on every render — `sections`
  // is a fresh array literal from the page each time and would restart the observer.
  const key = sections.map((s) => s.id).join("|");

  useEffect(() => {
    const ids = key.split("|").filter(Boolean);
    const nodes = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el != null);
    if (nodes.length === 0) return;

    // The live set is re-measured on every fire rather than read out of `entries`:
    // entries carry only what *changed*, so a scroll that crosses no threshold would
    // leave the highlight on a section that has left the screen.
    function recompute() {
      const line = window.innerHeight * READING_LINE;
      const passed = nodes.filter((node) => {
        const box = node.getBoundingClientRect();
        return box.top <= line && box.bottom > 0;
      });
      setActive((current) => passed[passed.length - 1]?.id ?? current ?? ids[0]!);
    }

    const observer = new IntersectionObserver(recompute, {
      threshold: [0, 0.25, 0.5, 0.75, 1],
    });
    for (const node of nodes) observer.observe(node);
    recompute();
    return () => observer.disconnect();
  }, [key]);

  if (sections.length === 0) return null;

  return (
    <div
      className="bg-canvas/85 border-hairline-soft sticky z-20 border-b backdrop-blur-md"
      style={{ top: "var(--header-height)" }}
    >
      <div className="px-base tablet:px-lg mx-auto w-full max-w-[1280px]">
        {/* The same carousel every other row on the site uses, so this scrolls with a
            drag or a swipe and shows no scrollbar — six labels overflow a 390px phone. */}
        <Carousel label="Sections" itemGap="gap-lg">
          {sections.map((s) => {
            const current = s.id === active;
            return (
              <li key={s.id} className="shrink-0 snap-start">
                <a
                  href={`#${s.id}`}
                  aria-current={current ? "true" : undefined}
                  className={cn(
                    "text-title relative flex min-h-13 items-center font-medium",
                    "after:absolute after:inset-x-0 after:bottom-0 after:h-0.5",
                    "after:transition-colors after:duration-[var(--duration-base)]",
                    current
                      ? "text-ink after:bg-ink"
                      : "text-muted hover:text-ink after:bg-transparent",
                  )}
                >
                  {s.label}
                </a>
              </li>
            );
          })}
        </Carousel>
      </div>
    </div>
  );
}

/**
 * A section that the nav above can reach.
 *
 * `scrollMarginTop` is the whole reason this is a component rather than a bare `<section
 * id>`: an anchor jump lands the element's top at the viewport's top, which on this page
 * is underneath a fixed header and a sticky bar. Every section needs the same offset, and
 * one that forgot it would put its own heading behind the chrome.
 */
export function SalonSection({
  id,
  children,
  className,
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} style={{ scrollMarginTop: CHROME }} className={className}>
      {children}
    </section>
  );
}
