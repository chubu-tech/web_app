"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Plus } from "lucide-react";
import { faq } from "@/lib/content";
import { cn } from "@/lib/utils";
import { Reveal, RevealGroup } from "./ui/reveal";
import { Container, Section, SectionHeading } from "./ui/section";

const EASE = [0.16, 1, 0.3, 1] as const;

/** Accordion — one panel open at a time, height animated. */
export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <Section id="faq" aria-labelledby="faq-title">
      <Container>
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5 lg:sticky lg:top-28 lg:self-start">
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
                      className="group flex w-full items-center gap-5 py-6 text-left"
                    >
                      <span
                        className={cn(
                          "flex-1 text-[1.0625rem] font-medium transition-colors duration-300 sm:text-[1.125rem]",
                          isOpen ? "text-ink" : "text-ink/80 group-hover:text-ink",
                        )}
                      >
                        {item.q}
                      </span>
                      <span
                        className={cn(
                          "grid size-9 shrink-0 place-items-center rounded-full transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
                          isOpen
                            ? "bg-rausch rotate-135 text-white"
                            : "bg-ink/5 text-ink group-hover:bg-ink/10",
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
                          <p className="text-body max-w-2xl pb-6 leading-relaxed">
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
