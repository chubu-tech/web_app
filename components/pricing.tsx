import { Check, Smartphone, Sparkles, Store } from "lucide-react";
import { pricing } from "@/lib/content";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Reveal, RevealGroup } from "./ui/reveal";
import { Container, Section, SectionHeading } from "./ui/section";
import { WaitlistCta } from "./waitlist-cta";

/**
 * Who pays what. The customer panel comes first and is visually separate from
 * the salon plans, because the single most likely misreading of this page is
 * "do I have to pay to book?".
 */
export function Pricing() {
  return (
    <Section id="pricing" aria-labelledby="pricing-title">
      <Container>
        <SectionHeading
          eyebrow={pricing.eyebrow}
          title="Customers never pay. _Only salons do._"
          body={pricing.body}
          align="center"
          titleId="pricing-title"
        />

        {/* 1. Customers — free. */}
        <Reveal className="mt-14 sm:mt-16">
          <div className="rounded-slab bg-ink relative overflow-hidden p-7 text-white sm:p-9">
            {/* Soft brand halo, breathing. */}
            <span
              className="bg-rausch/25 animate-glow pointer-events-none absolute -top-24 -right-16 size-72 rounded-full blur-3xl"
              aria-hidden
            />
            <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-xl">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-caption-sm font-semibold tracking-[0.14em] uppercase ring-1 ring-white/20 ring-inset">
                  <Smartphone className="size-3.5" strokeWidth={2.2} aria-hidden />
                  {pricing.customer.label}
                </span>

                <p className="mt-5 flex items-baseline gap-2">
                  <span className="text-[3.25rem] leading-none font-semibold tracking-tight">
                    {pricing.customer.price}
                  </span>
                  <span className="text-body-md text-white/60">
                    {pricing.customer.period}
                  </span>
                </p>

                <p className="mt-4 text-body-lg leading-relaxed text-white/75">
                  {pricing.customer.body}
                </p>

                <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2">
                  {pricing.customer.points.map((point) => (
                    <li
                      key={point}
                      className="flex items-center gap-2 text-body-sm text-white/85"
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

        {/* 2. Salons — the three plans. `#salon-plans` is reached from the footer's
            "List your shop" (`lib/content.ts`), the `for-salons.tsx` CTA and the
            JSON-LD in `app/page.tsx`. The header used to jump here as well, then
            pointed at the app's sign-in instead; that button is now removed until
            `../tho_web` is deployed, so the header reaches this section not at all.
            The anchor sits on the heading, not the section, so the scroll-margin
            below lands the heading clear of the fixed header. */}
        <div id="salon-plans" style={{ scrollMarginTop: "7rem" }}>
          <Reveal className="mt-16 flex items-center gap-4 sm:mt-20">
            <h3 className="text-ink inline-flex shrink-0 items-center gap-2.5 text-subheading font-semibold">
              <Store className="text-rausch size-5" strokeWidth={2} aria-hidden />
              {pricing.salonHeading}
            </h3>
            <span className="bg-hairline-soft h-px flex-1" aria-hidden />
          </Reveal>
        </div>

        <RevealGroup
          className="mt-8 grid items-start gap-5 lg:grid-cols-3"
          stagger={0.1}
        >
          {pricing.tiers.map((tier) => (
            <Reveal asChild key={tier.name}>
              <div
                className={cn(
                  "rounded-slab relative flex h-full flex-col p-7 sm:p-8",
                  "transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]",
                  tier.featured
                    ? // The rim rotates slowly around this card only.
                      "rim-card shadow-lift lg:-mt-4 lg:pb-11"
                    : "bg-white shadow-card hover:-translate-y-1.5",
                )}
              >
                {tier.featured && (
                  <span className="bg-rausch absolute -top-3 left-7 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-caption-sm font-semibold tracking-[0.14em] text-white uppercase sm:left-8">
                    <Sparkles className="size-3.5" strokeWidth={2.4} aria-hidden />
                    Most salons pick this
                  </span>
                )}

                <h4 className="text-ink text-subheading font-semibold">
                  {tier.name}
                </h4>
                <p className="text-muted mt-1.5 text-ui">
                  {tier.tagline}
                </p>

                <p className="mt-7 flex items-baseline gap-1">
                  <span className="text-ink text-[2.5rem] leading-none font-semibold tracking-tight">
                    {tier.price}
                  </span>
                  <span className="text-muted text-ui">
                    {tier.period}
                  </span>
                </p>

                <ul className="mt-7 flex flex-1 flex-col gap-3">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <span className="bg-rausch-soft text-rausch mt-0.5 grid size-5 shrink-0 place-items-center rounded-full">
                        <Check className="size-3" strokeWidth={3.2} aria-hidden />
                      </span>
                      <span className="text-body text-ui leading-snug">
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                <Button
                  href="#download"
                  variant={tier.featured ? "primary" : "ghost"}
                  size="lg"
                  arrow={false}
                  className="mt-8 w-full justify-center"
                >
                  {tier.cta}
                </Button>
              </div>
            </Reveal>
          ))}
        </RevealGroup>

        <Reveal delay={0.15}>
          <p className="text-muted mx-auto mt-10 max-w-2xl text-center text-body-sm leading-relaxed">
            {pricing.note}
          </p>
        </Reveal>
      </Container>
    </Section>
  );
}
