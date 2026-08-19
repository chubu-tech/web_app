"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Plus } from "lucide-react";
import { faq } from "@/lib/marketing/content";
import { cn } from "@/lib/marketing/utils";
import { Reveal, RevealGroup } from "./ui/reveal";
import { Container, Section, SectionHeading } from "./ui/section";

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Accordion — one panel open at a time, height animated.
 *
 * ## Every answer is in the HTML, and it did not used to be
 *
 * The panel was wrapped in `AnimatePresence` and rendered only while `isOpen`, so a
 * closed question's answer **was not in the document at all**. With one panel open by
 * default that put exactly one answer in the server HTML — and the page's `FAQPage`
 * markup published all of them. That combination is the specific thing Google's
 * structured-data policy prohibits: the marked-up answer has to be present on the page,
 * and eleven of twelve were not. It is also self-defeating for an answer engine, which
 * quotes what it can retrieve without running JavaScript.
 *
 * So the panel is now **always mounted** and its height is animated between 0 and auto.
 * The visual behaviour is identical; the difference is only visible in `curl`, which is
 * exactly the audience it was failing.
 *
 * `aria-hidden` still tracks the open state, because a zero-height panel is a real
 * element and a screen reader would otherwise read twelve answers to somebody who asked
 * for none. **That is safe for the crawler**: `aria-hidden` describes the accessibility
 * tree and neither search engines nor answer engines treat it as a signal to skip
 * indexing. The panel holds only text, so there is nothing focusable inside it to be
 * hidden from the tab order.
 *
 * ## The question is a heading
 *
 * Each question was a `<span>` inside a `<button>`, which left the section's `<h2>` with
 * no children and a crawler with no outline of what is answered here. It is an `<h3>`
 * wrapping the button now — the pattern the WAI accordion guidance uses — so the
 * questions form a real sub-outline under "The things everyone asks", and the button
 * keeps its `aria-expanded` and gains the `aria-controls` it was missing.
 */
export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <Section id="faq" aria-labelledby="faq-title">
      <Container>
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
          <div className="lg:sticky lg:top-[calc(var(--site-header-height)+2rem)] lg:col-span-5 lg:self-start">
            <SectionHeading
              title="The things _everyone asks_"
              body="Still stuck? Message us on WhatsApp"
              titleId="faq-title"
            />
          </div>

          <RevealGroup className="lg:col-span-7" stagger={0.06}>
            {faq.map((item, i) => {
              const isOpen = open === i;
              const panelId = `faq-panel-${i}`;
              const buttonId = `faq-question-${i}`;

              return (
                <Reveal asChild key={item.q}>
                  <div className="border-hairline-soft border-b first:border-t">
                    <h3>
                      <button
                        type="button"
                        id={buttonId}
                        onClick={() => setOpen(isOpen ? null : i)}
                        aria-expanded={isOpen}
                        aria-controls={panelId}
                        className="group flex w-full items-center gap-5 py-5 text-left"
                      >
                        <span
                          className={cn(
                            "text-subheading flex-1 font-medium transition-colors duration-200",
                            isOpen
                              ? "text-ink"
                              : "text-body group-hover:text-ink",
                          )}
                        >
                          {item.q}
                        </span>
                        {/* `icon-button-circle` from the reference — a
                            `surface-strong` disc, taking the accent only while the
                            panel it controls is open. */}
                        <span
                          className={cn(
                            // The disc swaps fill and label colour and rotates. Those three, named — the
                            // rotate is a `transform`, so it composites; the blanket transition was
                            // also animating layout properties it never changes.
                            "grid size-9 shrink-0 place-items-center rounded-full",
                            "transition-[background-color,color,transform] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
                            isOpen
                              ? "bg-rausch-cta rotate-135 text-white"
                              : "bg-surface-strong text-ink",
                          )}
                        >
                          <Plus className="size-4" strokeWidth={2.4} />
                        </span>
                      </button>
                    </h3>

                    {/*
                      Always mounted — see this component's doc comment. `initial={false}`
                      stops the open panel animating its height on first paint, which is
                      what `AnimatePresence initial={false}` used to do.
                    */}
                    <motion.div
                      id={panelId}
                      role="region"
                      aria-labelledby={buttonId}
                      aria-hidden={!isOpen}
                      initial={false}
                      animate={{
                        height: isOpen ? "auto" : 0,
                        opacity: isOpen ? 1 : 0,
                      }}
                      transition={{ duration: 0.5, ease: EASE }}
                      className="overflow-hidden"
                    >
                      <p className="text-body text-body-md max-w-[38rem] pb-6">
                        {item.a}
                      </p>
                    </motion.div>
                  </div>
                </Reveal>
              );
            })}
          </RevealGroup>
        </div>
      </Container>
    </Section>
  );
}
