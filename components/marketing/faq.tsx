"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Plus } from "lucide-react";
import { faq } from "@/lib/marketing/content";
import { cn } from "@/lib/marketing/utils";
import { Reveal, RevealGroup } from "./ui/reveal";
import { Container, Section, SectionHeading } from "./ui/section";

const EASE = [0.16, 1, 0.3, 1] as const;

/** Accordion — one panel open at a time, height animated. */
export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <Section id="faq" aria-labelledby="faq-title">
      <Container>
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
          <div className="lg:sticky lg:top-[calc(var(--site-header-height)+2rem)] lg:col-span-5 lg:self-start">
            <SectionHeading
              eyebrow="Questions"
              title="The things _everyone asks_"
              body="Still stuck? Message us on WhatsApp — a real person in Thimphu answers."
              titleId="faq-title"
            />
          </div>

          <RevealGroup className="lg:col-span-7" stagger={0.06}>
            {faq.map((item, i) => {
              const isOpen = open === i;

              return (
                <Reveal asChild key={item.q}>
                  <div className="border-hairline-soft border-b first:border-t">
                    <button
                      type="button"
                      onClick={() => setOpen(isOpen ? null : i)}
                      aria-expanded={isOpen}
                      className="group flex w-full items-center gap-5 py-5 text-left"
                    >
                      <span
                        className={cn(
                          "text-subheading flex-1 font-medium transition-colors duration-200",
                          isOpen ? "text-ink" : "text-body group-hover:text-ink",
                        )}
                      >
                        {item.q}
                      </span>
                      {/* `icon-button-circle` from the reference — a
                          `surface-strong` disc, taking the accent only while the
                          panel it controls is open. */}
                      <span
                        className={cn(
                          "grid size-9 shrink-0 place-items-center rounded-full transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
                          isOpen
                            ? "bg-rausch-cta rotate-135 text-white"
                            : "bg-surface-strong text-ink",
                        )}
                      >
                        <Plus className="size-4" strokeWidth={2.4} />
                      </span>
                    </button>

                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          key="panel"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.5, ease: EASE }}
                          className="overflow-hidden"
                        >
                          <p className="text-body text-body-md max-w-[38rem] pb-6">
                            {item.a}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
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
