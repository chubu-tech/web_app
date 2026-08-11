"use client";

import { useEffect, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
  useSpring,
} from "motion/react";
import Image from "next/image";
import { Menu, X } from "lucide-react";
import { brand, nav, waitlist } from "@/lib/marketing/content";
import { cn } from "@/lib/marketing/utils";
import { Button } from "./ui/button";
import { useWaitlist } from "./waitlist-provider";

export function SiteHeader() {
  const [condensed, setCondensed] = useState(false);
  const [open, setOpen] = useState(false);
  const { open: openWaitlist } = useWaitlist();
  const { scrollY, scrollYProgress } = useScroll();

  // Thin brand-coloured read-progress line pinned above the nav.
  const progress = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 30,
    restDelta: 0.001,
  });

  useMotionValueEvent(scrollY, "change", (latest) => {
    setCondensed(latest > 28);
  });

  // Lock the page while the mobile sheet is open.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <motion.div
        className="bg-rausch fixed inset-x-0 top-0 z-60 h-0.5 origin-left"
        style={{ scaleX: progress }}
        aria-hidden
      />

      <motion.header
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.9, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        className="fixed inset-x-0 top-0 z-50"
      >
        <div
          className={cn(
            "mx-auto flex w-full max-w-[82rem] items-center justify-between",
            "transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
            condensed
              ? "mt-3 gap-3 rounded-full bg-white/80 px-4 py-2.5 shadow-card backdrop-blur-xl sm:mx-4 sm:px-5 lg:mx-auto"
              : "mt-0 gap-3 rounded-none bg-transparent px-5 py-5 sm:px-8 lg:px-10",
          )}
        >
          <a
            href="#top"
            className="flex shrink-0 items-center gap-2.5"
            aria-label={`${brand.name} home`}
          >
            {/*
              The brand mark: the Dzongkha syllable "Tho" in gold on crimson. It replaced a
              lucide `Scissors` glyph on a rausch tile, and the tile geometry is deliberately
              unchanged — same 36px box, same `rounded-xl`, same hover rotate — so only what
              sits inside it is new.

              `bg-rausch` and `text-white` are gone because the artwork carries its own ground,
              and `overflow-hidden` is what clips a square JPEG to those corners. The crimson is
              NOT rausch and is not meant to be; see the note in `app/globals.css`.
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
            <span
              className={cn(
                "text-body-lg font-semibold tracking-tight transition-colors duration-500",
                condensed ? "text-ink" : "text-ink",
              )}
            >
              {brand.name}
            </span>
          </a>

          <nav className="hidden items-center gap-1 lg:flex">
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
              **The Sign in pill is removed until `../tho_web` is deployed.** It sat
              first here, and it pointed at `brand.appUrl` — which with no
              `NEXT_PUBLIC_APP_URL` set falls back to `http://localhost:3000`, so the
              header's primary action sent a visitor to their own machine. See `signIn`
              in `lib/content.ts` for the restore, which is this block back.

              What that leaves is one CTA, which is also the honest hierarchy right now:
              there is nothing to sign in to, and the waitlist is the only thing the site
              can actually do. The pair used to be deliberately identical — same
              `primary` fill, same magnetic hover, same height — with order and label
              carrying the hierarchy instead of size. Keep that if the pill comes back.

              It has to be `Button` rather than a styled `<a>`: the "animation" is
              the pointer-tracking spring inside that component, not a CSS
              transition, so it cannot be reproduced with class names.
            */}
            {/* The wrapper carries the breakpoint: a `hidden` passed into
                Button would lose to its own `inline-flex` in the cascade. */}
            <span className="hidden sm:inline-flex">
              <Button arrow={false} onClick={() => openWaitlist("header")}>
                {waitlist.cta}
              </Button>
            </span>
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
              className="text-ink ring-ink/12 hover:bg-ink/5 grid size-10 place-items-center rounded-full ring-1 ring-inset transition-colors lg:hidden"
            >
              <Menu className="size-5" strokeWidth={2} />
            </button>
          </div>
        </div>
      </motion.header>

      <AnimatePresence>
        {open && (
          <motion.div
            className="bg-canvas fixed inset-0 z-70 lg:hidden"
            initial={{ opacity: 0, clipPath: "circle(0% at 92% 5%)" }}
            animate={{ opacity: 1, clipPath: "circle(140% at 92% 5%)" }}
            exit={{ opacity: 0, clipPath: "circle(0% at 92% 5%)" }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex h-full flex-col px-6 py-6">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2.5">
                  {/* The sheet's lockup is the bar's, minus the hover rotate — it opens from
                      the bar and must not look like a different brand for the 600ms the
                      reveal takes. */}
                  <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-xl">
                    <Image
                      src="/tho-logo.webp"
                      alt=""
                      width={36}
                      height={36}
                      className="size-full object-cover"
                    />
                  </span>
                  <span className="text-body-lg font-semibold">
                    {brand.name}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close menu"
                  className="ring-ink/12 grid size-10 place-items-center rounded-full ring-1 ring-inset"
                >
                  <X className="size-5" strokeWidth={2} />
                </button>
              </div>

              <motion.nav
                className="mt-14 flex flex-col"
                initial="hidden"
                animate="shown"
                variants={{
                  hidden: {},
                  shown: { transition: { staggerChildren: 0.07, delayChildren: 0.15 } },
                }}
              >
                {nav.map((item) => (
                  <motion.a
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="border-hairline-soft text-editorial-md border-b py-5 font-semibold"
                    variants={{
                      hidden: { opacity: 0, y: 28 },
                      shown: {
                        opacity: 1,
                        y: 0,
                        transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
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
                  className="w-full justify-center"
                  onClick={() => {
                    setOpen(false);
                    openWaitlist("header");
                  }}
                >
                  {waitlist.cta}
                </Button>
                {/* The sheet's Sign in button was here, and is removed with the bar's
                    pill — same reason, same restore (`signIn` in `lib/content.ts`). Two
                    notes to keep for whoever puts it back, because both were learned the
                    hard way: it took no `onClick` to close the sheet, unlike the nav
                    links above, because `Button`'s link branch types `onClick` as
                    `never` — harmless for a cross-document navigation, which takes the
                    whole overlay with it, but it mattered when this jumped to
                    `#salon-plans` and left the page scrolling behind an opaque sheet. And
                    it wore `primary` to match the bar: two full-width brand pills stacked
                    is a lot of red, and it was accepted because the sheet's job is to
                    offer both doors equally. With one door there is nothing to balance. */}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
