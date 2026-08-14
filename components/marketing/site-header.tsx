"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { brand, nav, waitlist } from "@/lib/marketing/content";
import { cn } from "@/lib/marketing/utils";
import { Button } from "./ui/button";
import { useWaitlist } from "./waitlist-provider";

/**
 * The public top bar.
 *
 * ## What it is now
 *
 * The reference's `top-nav`: a white surface at a fixed 80px (72px below `sm`), the
 * wordmark flush left, the product links **dead centre**, and the one call to action
 * flush right, closed by a 1px bottom hairline. Everything about it is stated in
 * `../tho/DESIGN.md` down to the height.
 *
 * ## What it replaced
 *
 * A floating pill that changed shape at 28px of scroll — it grew a blurred white
 * capsule, side margins, a shadow and a full set of new paddings, all animated over
 * 500ms. Three things were wrong with it beyond taste. The shape change moved the
 * links horizontally while the page was moving vertically, so a pointer already on
 * its way to "Pricing" landed on "For salons". The pill's own width was
 * `max-w-[82rem]` while the bands beneath it were the same, so the wordmark never
 * lined up with the content edge it was supposed to anchor. And a
 * brand-coloured read-progress line sat above it, which is a blog affordance on a
 * page with no article to read.
 *
 * What is left that responds to scroll is the hairline, and only the hairline: it is
 * absent while the header sits on the canvas it matches, and fades in once there is
 * content passing underneath. Nothing reflows.
 *
 * ## The sheet is a real dialog now
 *
 * `AGENTS.md` records that this file's overlay had "no Escape handler and no focus
 * management" — the one overlay on the site that skipped both. It closes on Escape,
 * takes focus to its own close button on open, restores focus to the hamburger on
 * close, and carries `role="dialog"` / `aria-modal`. The scroll lock was already
 * here and stays.
 */
export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { open: openWaitlist } = useWaitlist();
  const reduced = useReducedMotion();

  const hamburger = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  // A plain listener rather than `useScroll`: the only thing it drives is one
  // boolean, and a spring plus a motion value for a border colour is a spring too
  // many. `passive` because nothing here calls `preventDefault`.
  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
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

  return (
    <>
      <header
        className={cn(
          "bg-canvas fixed inset-x-0 top-0 z-50 h-(--site-header-height)",
          "border-b transition-colors duration-300",
          scrolled ? "border-hairline" : "border-transparent",
        )}
      >
        {/* The same gutter and cap as every band, so the wordmark sits on the
            content's left edge rather than a few pixels inside or outside it. */}
        <div className="mx-auto flex h-full w-full max-w-[80rem] items-center gap-4 px-5 sm:px-8 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:px-10">
          {/* `next/link`, and root-relative rather than a bare `#top`: this header
              also renders on `/privacy`, where a bare hash would rewrite the URL and
              scroll nowhere. `@next/next/no-html-link-for-pages` enforces the
              component for any in-app route, which a hash on `/` is. */}
          <Link
            href="/#top"
            className="flex shrink-0 items-center gap-2.5"
            aria-label={`${brand.name} home`}
          >
            {/* The mark carries its own crimson ground, so it needs no tile — but it
                does need `overflow-hidden` to take the rounded corners. The hover
                rotate is gone with the rest of the header's motion. */}
            <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-md">
              <Image
                src="/tho-logo.webp"
                alt=""
                width={36}
                height={36}
                priority
                className="size-full object-cover"
              />
            </span>
            <span className="text-subheading text-ink font-semibold">
              {brand.name}
            </span>
          </Link>

          {/* Centre column. It is a real grid track rather than an absolutely
              positioned overlay, so a long label pushes the columns apart instead of
              silently sliding under the wordmark. */}
          <nav aria-label="Sections" className="hidden justify-center gap-1 lg:flex">
            {nav.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className={cn(
                  "text-ui text-body hover:text-ink relative rounded-full px-3.5 py-2 font-medium",
                  "transition-colors duration-200",
                  // The reference marks a nav tab with a 2px ink rule. Ink, not
                  // rausch: the accent belongs to the action on the right.
                  "after:bg-ink after:absolute after:bottom-1 after:left-3.5 after:h-0.5 after:w-0 after:rounded-full",
                  "after:transition-[width] after:duration-300 after:ease-[cubic-bezier(0.16,1,0.3,1)]",
                  "hover:after:w-[calc(100%-1.75rem)]",
                )}
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2 lg:ml-0 lg:justify-end">
            {/*
              **The Sign in pill is still removed until the product side is
              deployed.** It sat first here and pointed at `brand.appPaths.signIn`;
              see `signIn` in `lib/marketing/content.ts` for the restore, which is
              this block back with `variant="ghost"` beside the primary.

              The wrapper carries the breakpoint: a `hidden` passed into `Button`
              would lose to its own `inline-flex` in the cascade.
            */}
            <span className="hidden sm:inline-flex">
              <Button onClick={() => openWaitlist("header")}>
                {waitlist.cta}
              </Button>
            </span>

            {/* 40px, the reference's `icon-button-outline`. */}
            <button
              ref={hamburger}
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
              aria-expanded={open}
              className="text-ink ring-hairline hover:bg-surface-soft hover:ring-border-strong grid size-10 shrink-0 place-items-center rounded-full ring-1 ring-inset transition-colors lg:hidden"
            >
              <Menu className="size-5" strokeWidth={2} />
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            className="bg-canvas fixed inset-0 z-70 lg:hidden"
            initial={{ opacity: 0, y: reduced ? 0 : -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reduced ? 0 : -12 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex h-full flex-col overflow-y-auto">
              <div className="flex h-(--site-header-height) shrink-0 items-center justify-between px-5 sm:px-8">
                <span className="flex items-center gap-2.5">
                  <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-md">
                    <Image
                      src="/tho-logo.webp"
                      alt=""
                      width={36}
                      height={36}
                      className="size-full object-cover"
                    />
                  </span>
                  <span className="text-subheading font-semibold">
                    {brand.name}
                  </span>
                </span>
                <button
                  ref={closeButton}
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close menu"
                  className="text-ink ring-hairline hover:bg-surface-soft grid size-10 place-items-center rounded-full ring-1 ring-inset transition-colors"
                >
                  <X className="size-5" strokeWidth={2} />
                </button>
              </div>

              <nav
                aria-label="Sections"
                className="border-hairline-soft mt-2 flex flex-col border-t px-5 sm:px-8"
              >
                {nav.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="border-hairline-soft text-editorial-md text-ink hover:text-rausch border-b py-5 font-medium transition-colors"
                  >
                    {item.label}
                  </a>
                ))}
              </nav>

              {/* `mt-auto` pins this to the foot on a tall phone and lets it sit
                  under the links on a short one, rather than overlapping them. */}
              <div className="mt-auto px-5 pt-8 pb-8 sm:px-8">
                {/* Close the sheet first: two overlays at once would leave the
                    nav's scroll lock fighting the modal's, and the nav would
                    still be under the dialog when it closes. */}
                <Button
                  size="lg"
                  className="w-full"
                  onClick={() => {
                    setOpen(false);
                    openWaitlist("header");
                  }}
                >
                  {waitlist.cta}
                </Button>
                <p className="text-muted mt-4 text-center text-caption">
                  {brand.cities.join(" · ")}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
