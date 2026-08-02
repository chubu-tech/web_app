"use client";

import { useEffect, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
  useSpring,
} from "motion/react";
import { Menu, Scissors, X } from "lucide-react";
import { brand, nav } from "@/lib/content";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";

export function SiteHeader() {
  const [condensed, setCondensed] = useState(false);
  const [open, setOpen] = useState(false);
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
            <span
              className={cn(
                "bg-rausch grid size-9 place-items-center rounded-xl text-white",
                "transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] hover:rotate-12",
              )}
            >
              <Scissors className="size-[1.1rem]" strokeWidth={2.2} />
            </span>
            <span
              className={cn(
                "text-[1.0625rem] font-semibold tracking-tight transition-colors duration-500",
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
                  "group/nav relative overflow-hidden rounded-full px-3.5 py-2 text-[0.9375rem] font-medium",
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
            <a
              href="#salon-plans"
              className="text-ink hover:bg-ink/5 hidden rounded-full px-4 py-2.5 text-[0.9375rem] font-medium transition-colors sm:inline-flex"
            >
              Salon sign in
            </a>
            {/* The wrapper carries the breakpoint: a `hidden` passed into
                Button would lose to its own `inline-flex` in the cascade. */}
            <span className="hidden sm:inline-flex">
              <Button href="#download" arrow={false}>
                Get the app
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
                  <span className="bg-rausch grid size-9 place-items-center rounded-xl text-white">
                    <Scissors className="size-[1.1rem]" strokeWidth={2.2} />
                  </span>
                  <span className="text-[1.0625rem] font-semibold">
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
                    className="border-hairline-soft border-b py-5 text-[2rem] leading-tight font-semibold tracking-tight"
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
                <Button href="#download" size="lg" className="w-full justify-center">
                  Get the app
                </Button>
                <Button
                  href="#salon-plans"
                  variant="ghost"
                  size="lg"
                  arrow={false}
                  className="w-full justify-center"
                >
                  Salon sign in
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
