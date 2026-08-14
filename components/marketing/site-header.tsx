"use client";

import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
} from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { brand, nav, waitlist } from "@/lib/marketing/content";
import { cn } from "@/lib/marketing/utils";
import { Button } from "./ui/button";
import { useWaitlist } from "./waitlist-provider";

const EASE = [0.16, 1, 0.3, 1] as const;

/** Past this much scroll the bar draws itself as a floating pill. */
const CONDENSE_AT = 28;

/** The CTA's lean toward the cursor, in px at the far edge of the pill. */
const MAGNET_X = 14;
const MAGNET_Y = 10;
const MAGNET_SPRING = { stiffness: 260, damping: 18, mass: 0.4 };

/**
 * The public top bar — **the original one, restored.**
 *
 * ## Why this file looks like a revert
 *
 * It is one. A redesign replaced this with the reference's `top-nav`: an opaque
 * white bar at a fixed 80px with the links dead centre, a hairline that faded in on
 * scroll, and no entrance, no read-progress line, no magnetic CTA and a plain fade
 * for the mobile sheet. That was reverted on request, and what is here is the
 * pre-redesign bar reproduced from `4e11786^` — layout, spacing, type, height,
 * background, borders, scroll behaviour, hover states and every animation.
 *
 * The redesign's objections are on the record and are **not** bugs to re-fix here:
 * the pill changes shape at 28px, which moves the links horizontally while the page
 * is moving vertically; its `max-w-[82rem]` is wider than the 80rem bands beneath
 * it, so the wordmark does not line up with the content edge; and the progress line
 * is an article affordance on a page with no article. All three are properties of
 * the design that was asked for. Leave them.
 *
 * ## What is kept from the redesign, because none of it is visible
 *
 * - **The logo is a `next/link` to `/#top`**, not a bare `#top`. This header also
 *   renders on `/privacy`, where a bare hash rewrites the URL and scrolls nowhere,
 *   and `@next/next/no-html-link-for-pages` requires the component for an in-app
 *   route anyway.
 * - **The sheet is a real dialog**: Escape closes it, focus moves to the close
 *   button on open and returns to the hamburger on close, and it carries
 *   `role="dialog"` / `aria-modal` / `aria-expanded`. The original had none of that
 *   and `AGENTS.md` records it as the one overlay on the site that skipped both.
 * - **`prefers-reduced-motion` is honoured** by the entrance, the sheet's circle
 *   reveal, its staggered links and the magnet. The original honoured none of them.
 *
 * ## Two things that are deliberately not verbatim
 *
 * - **The CTA keeps `--color-rausch-cta` (#e00b41), not `--color-rausch`
 *   (#ff385c).** The original pill was the brighter hue, and white on it measures
 *   3.53:1 — a WCAG AA failure `AGENTS.md` calls out by name as a bug that was
 *   already fixed once. The deeper step measures 4.89:1. Everything else about the
 *   pill — size, radius, weight, the lean — is the original.
 * - **The magnet lives here, not in `Button`.** Wrapping the pill in a spring that
 *   translates is the same rendered result as translating the pill itself, and it
 *   keeps the site's other ten call to actions the plain elements the redesign made
 *   them. See the note on the wrapper.
 *
 * `--site-header-height` is untouched and still reserves the page's top gutter
 * (hero, `/privacy`, every `scroll-mt`). The bar no longer *is* that height — it is
 * 88px open and 80px condensed at `sm` and up, 80/72 below it — but it floats over
 * the page, so nothing beneath it moved.
 */
export function SiteHeader() {
  const [condensed, setCondensed] = useState(false);
  const [open, setOpen] = useState(false);
  const { open: openWaitlist } = useWaitlist();
  const reduced = useReducedMotion();
  const { scrollY, scrollYProgress } = useScroll();

  const hamburger = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  // Thin brand-coloured read-progress line pinned above the nav.
  const progress = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 30,
    restDelta: 0.001,
  });

  useMotionValueEvent(scrollY, "change", (latest) => {
    setCondensed(latest > CONDENSE_AT);
  });

  // `useMotionValueEvent` fires on *change*, so a reload at a scrolled position
  // paints the open bar over content until the first wheel tick. One read on mount
  // closes that, and it is a plain call rather than a setter in the effect body
  // because `react-hooks/set-state-in-effect` rejects the latter.
  useEffect(() => {
    function sync() {
      setCondensed(window.scrollY > CONDENSE_AT);
    }
    sync();
  }, []);

  // Lock the page, take focus in, and hand it back on the way out.
  useEffect(() => {
    if (!open) return;

    const opener = hamburger.current;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
      opener?.focus();
    };
  }, [open]);

  // The CTA's magnet. Two springs on the wrapper, driven by the pointer's offset
  // from the pill's centre and capped so it never detaches from its layout slot.
  const magnetX = useSpring(useMotionValue(0), MAGNET_SPRING);
  const magnetY = useSpring(useMotionValue(0), MAGNET_SPRING);

  function pull(event: React.PointerEvent<HTMLElement>) {
    if (reduced || event.pointerType !== "mouse") return;
    const box = event.currentTarget.getBoundingClientRect();
    magnetX.set(
      ((event.clientX - (box.left + box.width / 2)) / box.width) * MAGNET_X,
    );
    magnetY.set(
      ((event.clientY - (box.top + box.height / 2)) / box.height) * MAGNET_Y,
    );
  }

  function release() {
    magnetX.set(0);
    magnetY.set(0);
  }

  return (
    <>
      <motion.div
        className="bg-rausch fixed inset-x-0 top-0 z-60 h-0.5 origin-left"
        style={{ scaleX: progress }}
        aria-hidden
      />

      <motion.header
        initial={reduced ? { opacity: 0 } : { y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: reduced ? 0.2 : 0.9, delay: 0.15, ease: EASE }}
        className="fixed inset-x-0 top-0 z-50"
      >
        {/*
          No `w-full`. The original had it, and `w-full` + `sm:mx-4` is 100% of the
          viewport *plus* 32px of margin — a real overflow that only ever hid behind
          the root layout's `overflow-x-hidden`. A block-level flex container with
          auto width fills the same space minus its margins, so every state renders
          identically and nothing pokes out from under the mask.
        */}
        <div
          className={cn(
            "mx-auto flex max-w-[82rem] items-center justify-between",
            "transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
            condensed
              ? "mt-3 gap-3 rounded-full bg-white/80 px-4 py-2.5 shadow-card backdrop-blur-xl sm:mx-4 sm:px-5 lg:mx-auto"
              : "mt-0 gap-3 rounded-none bg-transparent px-5 py-5 sm:px-8 lg:px-10",
          )}
        >
          <Link
            href="/#top"
            className="flex shrink-0 items-center gap-2.5"
            aria-label={`${brand.name} home`}
          >
            {/*
              The brand mark: the Dzongkha syllable "Tho" in gold on crimson. The
              tile carries no fill of its own — the artwork brings its ground — and
              `overflow-hidden` is what clips a square JPEG to those corners.
              `rounded-xl` is 32px against a 36px box, so the browser clamps it to a
              circle; that is what the original rendered and it is why the mark is
              round here and was a squircle in the redesign.
            */}
            <span
              className={cn(
                "grid size-9 shrink-0 place-items-center overflow-hidden rounded-xl",
                "transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:rotate-12",
              )}
            >
              <Image
                src="/tho-logo.webp"
                alt=""
                width={36}
                height={36}
                priority
                className="size-full object-cover"
              />
            </span>
            <span className="text-ink text-body-lg font-semibold tracking-tight">
              {brand.name}
            </span>
          </Link>

          <nav
            aria-label="Sections"
            className="hidden items-center gap-1 lg:flex"
          >
            {nav.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className={cn(
                  "group/nav relative overflow-hidden rounded-full px-3.5 py-2 text-ui font-medium",
                  // Underline grows from the left on hover.
                  "after:bg-rausch after:absolute after:bottom-1.5 after:left-3.5 after:h-px after:w-0 after:transition-all after:duration-300 after:ease-[cubic-bezier(0.16,1,0.3,1)] hover:after:w-[calc(100%-1.75rem)]",
                )}
              >
                {/* The label slides out of the top while a brand-coloured copy
                    rises to take its place. */}
                <span className="text-body block transition-transform duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/nav:-translate-y-[130%]">
                  {item.label}
                </span>
                <span
                  className="text-ink absolute inset-0 flex translate-y-[130%] items-center justify-center transition-transform duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/nav:translate-y-0"
                  aria-hidden
                >
                  {item.label}
                </span>
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {/*
              **The Sign in pill is still removed until the product side is
              deployed.** It sat first here and pointed at `brand.appPaths.signIn`;
              see `signIn` in `lib/marketing/content.ts` for the restore, which is
              this block back beside the primary. The pair was deliberately
              identical — same fill, same magnet, same height — with order and label
              carrying the hierarchy instead of size. Keep that if it comes back.

              The wrapper carries three jobs at once and all three are why it is a
              wrapper: the breakpoint (a `hidden` passed into `Button` would lose to
              its own `inline-flex` in the cascade), the magnet's springs, and the
              pointer handlers. Translating the wrapper renders identically to
              translating the pill, and it leaves `Button` the plain element every
              other band on the site now uses.
            */}
            <motion.span
              className="hidden sm:inline-flex"
              style={reduced ? undefined : { x: magnetX, y: magnetY }}
              onPointerMove={pull}
              onPointerLeave={release}
            >
              <Button onClick={() => openWaitlist("header")}>
                {waitlist.cta}
              </Button>
            </motion.span>

            <button
              ref={hamburger}
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
              aria-expanded={open}
              className="text-ink ring-ink/12 hover:bg-ink/5 grid size-10 shrink-0 place-items-center rounded-full ring-1 ring-inset transition-colors lg:hidden"
            >
              <Menu className="size-5" strokeWidth={2} />
            </button>
          </div>
        </div>
      </motion.header>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="bg-canvas fixed inset-0 z-70 lg:hidden"
            // The circle opens from the hamburger's own corner. Under
            // `prefers-reduced-motion` it is a plain fade — the sheet still
            // arrives, it just does not sweep across the screen to get here.
            initial={
              reduced
                ? { opacity: 0 }
                : { opacity: 0, clipPath: "circle(0% at 92% 5%)" }
            }
            animate={
              reduced
                ? { opacity: 1 }
                : { opacity: 1, clipPath: "circle(140% at 92% 5%)" }
            }
            exit={
              reduced
                ? { opacity: 0 }
                : { opacity: 0, clipPath: "circle(0% at 92% 5%)" }
            }
            transition={{ duration: reduced ? 0.2 : 0.6, ease: EASE }}
          >
            {/* `overflow-y-auto` is the one addition, and it changes nothing that
                fits: it is what stops the links being unreachable on a short
                landscape phone, where `mt-auto` would otherwise push the CTA off
                the bottom with no way to scroll to it. */}
            <div className="flex h-full flex-col overflow-y-auto px-6 py-6">
              <div className="flex shrink-0 items-center justify-between">
                <span className="flex items-center gap-2.5">
                  {/* The sheet's lockup is the bar's, minus the hover rotate — it
                      opens from the bar and must not look like a different brand
                      for the 600ms the reveal takes. */}
                  <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-xl">
                    <Image
                      src="/tho-logo.webp"
                      alt=""
                      width={36}
                      height={36}
                      className="size-full object-cover"
                    />
                  </span>
                  <span className="text-body-lg font-semibold tracking-tight">
                    {brand.name}
                  </span>
                </span>
                <button
                  ref={closeButton}
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close menu"
                  className="text-ink ring-ink/12 grid size-10 shrink-0 place-items-center rounded-full ring-1 ring-inset"
                >
                  <X className="size-5" strokeWidth={2} />
                </button>
              </div>

              <motion.nav
                aria-label="Sections"
                className="mt-14 flex flex-col"
                initial="hidden"
                animate="shown"
                variants={{
                  hidden: {},
                  shown: {
                    transition: {
                      staggerChildren: reduced ? 0 : 0.07,
                      delayChildren: reduced ? 0 : 0.15,
                    },
                  },
                }}
              >
                {nav.map((item) => (
                  <motion.a
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="border-hairline-soft text-editorial-md border-b py-5 font-semibold"
                    variants={{
                      hidden: { opacity: 0, y: reduced ? 0 : 28 },
                      shown: {
                        opacity: 1,
                        y: 0,
                        transition: {
                          duration: reduced ? 0.2 : 0.7,
                          ease: EASE,
                        },
                      },
                    }}
                  >
                    {item.label}
                  </motion.a>
                ))}
              </motion.nav>

              <div className="mt-auto flex flex-col gap-3 pt-8">
                {/* Close the sheet first: two overlays at once would leave the
                    nav's scroll lock fighting the modal's, and the nav would
                    still be under the dialog when it closes. */}
                <Button
                  size="lg"
                  arrow
                  className="w-full"
                  onClick={() => {
                    setOpen(false);
                    openWaitlist("header");
                  }}
                >
                  {waitlist.cta}
                </Button>
                {/* The sheet's Sign in button was here, and is removed with the
                    bar's pill — same reason, same restore (`signIn` in
                    `lib/marketing/content.ts`). Two notes for whoever puts it
                    back, both learned the hard way: it took no `onClick` to close
                    the sheet, unlike the nav links above, because `Button`'s link
                    branch types `onClick` as `never` — harmless for a
                    cross-document navigation, which takes the whole overlay with
                    it, but it mattered when this jumped to `#salon-plans` and left
                    the page scrolling behind an opaque sheet. And it wore the
                    primary fill to match the bar: two full-width brand pills
                    stacked is a lot of red, and it was accepted because the sheet's
                    job is to offer both doors equally. With one door there is
                    nothing to balance. */}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
