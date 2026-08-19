import { Check, Smartphone, Sparkles, Store } from "lucide-react";
import { pricing } from "@/lib/marketing/content";
import { cn } from "@/lib/marketing/utils";
import { Button } from "./ui/button";
import { Reveal, RevealGroup } from "./ui/reveal";
import { Container, Section, SectionHeading } from "./ui/section";
import { WaitlistCta } from "./waitlist-cta";

/**
 * Who pays what. The customer panel comes first and is visually separate from the
 * salon plans, because the single most likely misreading of this page is "do I have
 * to pay to book?".
 *
 * ## Three decorations went, and the cards read as a price list now
 *
 * The recommended plan wore `rim-card` — a conic gradient rotating around its border
 * for ever, driven by an `@property` angle — plus `shadow-lift`, the page's second
 * elevation tier, plus a 16px upward offset that took it out of the row. The
 * customer panel had a 288px rausch halo behind it breathing on a 4.5s loop.
 *
 * All three are gone, and what marks the recommended plan now is what the reference
 * uses to mark anything: a 2px stroke in the brand colour, a small badge, and the
 * one filled call to action in the group. That is enough — it was always enough —
 * and it means the three cards sit on one baseline, which is how a price list is
 * read.
 *
 * The prices themselves are mirrored from `plans_config.dart` upstream and are not
 * set here. See the long note on `pricing` in `lib/marketing/content.ts` before
 * changing a figure.
 */
export function Pricing() {
  return (
    <Section id="pricing" aria-labelledby="pricing-title">
      <Container>
        <SectionHeading
          title="Customers never pay. _Only salons do._"
          body={pricing.body}
          titleId="pricing-title"
        />

        {/* ── 1. Customers — free ─────────────────────────────────────── */}
        <Reveal className="mt-10 sm:mt-12">
          <div className="bg-surface-soft ring-hairline rounded-lg p-6 ring-1 ring-inset sm:p-8">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between lg:gap-12">
              <div className="max-w-[36rem]">
                <span className="bg-paper text-ink ring-hairline inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-badge font-semibold tracking-[0.1em] uppercase ring-1 ring-inset">
                  <Smartphone
                    className="size-3.5"
                    strokeWidth={2.2}
                    aria-hidden
                  />
                  {pricing.customer.label}
                </span>

                {/* The band's one loud figure. The reference reserves its largest
                    type for a single trust signal per page and sets everything else
                    modestly; "Nu 0" is that signal here. */}
                <p className="mt-5 flex items-baseline gap-2">
                  <span className="text-ink text-editorial-lg font-display font-semibold">
                    {pricing.customer.price}
                  </span>
                  <span className="text-muted text-body-md">
                    {pricing.customer.period}
                  </span>
                </p>

                <p className="text-body text-body-lg mt-3">
                  {pricing.customer.body}
                </p>

                <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
                  {pricing.customer.points.map((point) => (
                    <li
                      key={point}
                      className="text-body flex items-center gap-2 text-body-sm"
                    >
                      <Check
                        className="text-rausch size-4 shrink-0"
                        strokeWidth={2.8}
                        aria-hidden
                      />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Pre-launch this is the waitlist, not a jump to the download
                  band — the band no longer has anything to download either. */}
              <WaitlistCta source="pricing" size="lg" className="shrink-0" />
            </div>
          </div>
        </Reveal>

        {/* ── 2. Salons — the three plans ─────────────────────────────────
            `#salon-plans` is reached from the footer's quick links, the
            `for-salons.tsx` call to action and the JSON-LD in
            `app/(marketing)/page.tsx`. The anchor sits on the heading, not the
            section, so the scroll margin lands the heading clear of the fixed
            header — and the margin is the header's own token now, where it used to
            be a hardcoded `7rem` against a bar that is 4.5–5rem. */}
        <div
          className="scroll-mt-[calc(var(--site-header-height)+2rem)]"
          id="salon-plans"
        >
          <Reveal className="mt-14 flex items-center gap-4 sm:mt-16">
            <h3 className="text-ink text-heading inline-flex shrink-0 items-center gap-2.5 font-semibold">
              <Store
                className="text-rausch size-5"
                strokeWidth={2}
                aria-hidden
              />
              {pricing.salonHeading}
            </h3>
            <span className="bg-hairline-soft h-px flex-1" aria-hidden />
          </Reveal>
        </div>

        <RevealGroup
          className="mt-8 grid items-stretch gap-5 lg:grid-cols-3"
          stagger={0.08}
        >
          {pricing.tiers.map((tier) => (
            <Reveal asChild key={tier.name}>
              <div
                className={cn(
                  "bg-paper relative flex h-full flex-col rounded-md p-6 ring-inset",
                  "transition-shadow duration-300",
                  tier.featured
                    ? "ring-rausch ring-2"
                    : "ring-hairline hover:shadow-card ring-1",
                )}
              >
                {tier.featured && (
                  <span className="bg-rausch-cta absolute -top-3 left-6 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-badge font-semibold tracking-[0.1em] text-white uppercase">
                    <Sparkles
                      className="size-3.5"
                      strokeWidth={2.4}
                      aria-hidden
                    />
                    Most salons pick this
                  </span>
                )}

                <h4 className="text-ink text-heading font-semibold">
                  {tier.name}
                </h4>
                <p className="text-muted text-title mt-1">{tier.tagline}</p>

                <p className="mt-6 flex items-baseline gap-1">
                  <span className="text-ink text-editorial-md font-display font-semibold">
                    {tier.price}
                  </span>
                  <span className="text-muted text-title">{tier.period}</span>
                </p>

                <ul className="border-hairline-soft mt-6 flex flex-1 flex-col gap-3 border-t pt-6">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <span className="bg-rausch-soft text-rausch mt-0.5 grid size-5 shrink-0 place-items-center rounded-full">
                        <Check
                          className="size-3"
                          strokeWidth={3.2}
                          aria-hidden
                        />
                      </span>
                      <span className="text-body text-body-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  href="#download"
                  variant={tier.featured ? "primary" : "ghost"}
                  className="mt-7 w-full"
                >
                  {tier.cta}
                </Button>
              </div>
            </Reveal>
          ))}
        </RevealGroup>

        <Reveal delay={0.12}>
          <p className="text-muted mt-8 max-w-[44rem] text-body-sm">
            {pricing.note}
          </p>
        </Reveal>
      </Container>
    </Section>
  );
}
