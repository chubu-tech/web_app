import { proof } from "@/lib/marketing/content";
import type { SalonIndex } from "@/lib/marketing/salons";
import { Reveal, RevealGroup } from "./ui/reveal";
import { Container, Section, SectionHeading } from "./ui/section";

/**
 * Four figures, all real.
 *
 * This occupies the slot a landing page normally gives to testimonials. There are
 * none on this site and there deliberately are none here — see the long note on
 * `proof` in `lib/marketing/content.ts` for why inventing them is out of scope for a
 * redesign. What the band offers instead is arithmetic over the same
 * prerendered `SalonIndex` the search band filters, so the numbers cannot disagree
 * with the salon grid a screen above them.
 *
 * Typographically this is the reference's one concession to loud type: it sets
 * everything modestly and then gives its single trust signal — a rating number, on
 * Airbnb — the largest step in the system. Four counts under hairlines is the same
 * move.
 *
 * Returns `null` on an empty index. A build that could not reach the database would
 * otherwise print "0 salons listed" under a heading reading "live right now", which
 * is worse than the section being absent — the same rule `FindSalon` follows.
 */
export function Proof({ index }: { index: SalonIndex }) {
  if (index.salons.length === 0) return null;

  const treatments = new Set(
    index.groups.flatMap((group) => group.treatments.map((t) => t.name)),
  ).size;

  const stats = [
    { label: proof.stats.salons, value: index.salons.length },
    { label: proof.stats.treatments, value: treatments },
    { label: proof.stats.professionals, value: index.professionals },
    { label: proof.stats.towns, value: index.cities.length },
    // A count of zero is a count nobody needs to read: a platform with no towns
    // recorded should not print a "0" beside three real figures.
  ].filter((stat) => stat.value > 0);

  return (
    <Section
      id="proof"
      aria-labelledby="proof-title"
      className="bg-surface-soft border-hairline-soft border-y"
    >
      <Container>
        <div className="grid gap-10 lg:grid-cols-12 lg:items-end lg:gap-14">
          <SectionHeading
            title={proof.title}
            body={proof.body}
            titleId="proof-title"
            className="lg:col-span-5"
          />

          <RevealGroup
            className="lg:col-span-7"
            stagger={0.07}
            // `<dl>` may contain `<div>` wrapping each dt/dd pair, and `dt` has to
            // come first in the DOM for the pairing to be valid. `flex-col-reverse`
            // is what puts the figure above its label on screen without reordering
            // the markup a screen reader walks.
          >
            <dl className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4">
              {stats.map((stat) => (
                <Reveal asChild key={stat.label}>
                  <div className="border-hairline flex flex-col-reverse border-t pt-4">
                    <dt className="text-muted mt-1.5 text-body-sm">
                      {stat.label}
                    </dt>
                    <dd className="text-ink text-editorial-lg font-display font-semibold tabular-nums">
                      {stat.value}
                    </dd>
                  </div>
                </Reveal>
              ))}
            </dl>
          </RevealGroup>
        </div>
      </Container>
    </Section>
  );
}
