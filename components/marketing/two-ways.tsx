import { CalendarCheck, Check, QrCode } from "lucide-react";
import { twoWays } from "@/lib/marketing/content";
import { HoverZoomImage } from "./ui/parallax-image";
import { Reveal, RevealGroup } from "./ui/reveal";
import { Container, Section, SectionHeading } from "./ui/section";

const ICONS = [CalendarCheck, QrCode];

/**
 * The two paths into a chair — book ahead, or scan on arrival. This is the whole
 * product in one screen, so it sits directly under the search band.
 *
 * ## The arch is gone, and that was a considered trade
 *
 * The photographs used to sit inside a dzong-window arch: an elliptical head over a
 * squared foot, drawn by a five-value `border-radius` in the `arch` utility, lifted
 * by a `Curtain` on entry and leaned toward the cursor by a `Tilt`. It was the
 * strongest Bhutanese architectural cue on the page.
 *
 * It went because the brief here is the reference's **card language**, and that
 * language has exactly one card shape — a rounded rectangle at `{rounded.md}` — with
 * the meta stacked beneath it. An arch is a different object, and once the salon
 * grid, the plan cards and the live board are all rounded rectangles, two arches in
 * the middle of the page read as a section that belongs to another site.
 *
 * THO's Bhutanese identity is not carried by this shape and does not leave with it:
 * the kira rule opens the hero and the footer, the woven diamond runs through the
 * category strip and the section divider, the greeting is above the headline, and
 * the Himalayan skyline still closes the page. Identity here is ornament and
 * language, which is what `MARKETING-ARCHITECTURE.md` says it was always meant to
 * be — "deliberately restrained; three motifs, used as ornament only".
 *
 * If the arch is wanted back, it is one utility in `app/marketing-tokens.css` and
 * one class on the photo box; nothing else depended on it.
 */
export function TwoWays() {
  return (
    <Section id="how-it-works" aria-labelledby="how-it-works-title">
      <Container>
        <SectionHeading
          eyebrow={twoWays.eyebrow}
          title="Two ways into _the chair_"
          body={twoWays.body}
          titleId="how-it-works-title"
        />

        <RevealGroup
          className="mt-10 grid gap-8 sm:mt-12 lg:grid-cols-2 lg:gap-10"
          stagger={0.1}
        >
          {twoWays.options.map((option, i) => {
            const Icon = ICONS[i];

            return (
              <Reveal asChild key={option.tag}>
                <article className="group flex flex-col">
                  <div className="bg-surface-soft relative aspect-[4/3] w-full overflow-hidden rounded-md">
                    <HoverZoomImage
                      src={option.image}
                      alt={option.alt}
                      sizes="(min-width: 1024px) 46vw, 92vw"
                    />

                    {/* The reference's floating badge: white pill, one shadow tier,
                        top-left over the photo. It was a dark glass capsule centred
                        on the arch's crown — which only had a crown to sit on. */}
                    <span className="bg-canvas text-ink shadow-card absolute top-4 left-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-badge font-semibold tracking-[0.08em] uppercase">
                      <Icon className="size-3.5" strokeWidth={2.4} aria-hidden />
                      {option.tag}
                    </span>
                  </div>

                  <h3 className="text-ink text-heading mt-5 font-semibold">
                    {option.title}
                  </h3>
                  <p className="text-body text-body-lg mt-2 max-w-[34rem]">
                    {option.body}
                  </p>

                  {/* Stacked, hairline-separated rows rather than a wrapped inline
                      list. The reference's `amenity-row` is a one-column list with
                      12px of row padding closed by a rule, and it is the right shape
                      here for the same reason: two short claims side by side read as
                      one run-on sentence at 390px. */}
                  <ul className="border-hairline-soft mt-5 flex flex-col border-t">
                    {option.points.map((point) => (
                      <li
                        key={point}
                        className="border-hairline-soft text-body flex items-center gap-3 border-b py-3 text-body-md"
                      >
                        <Check
                          className="text-rausch size-4 shrink-0"
                          strokeWidth={2.6}
                          aria-hidden
                        />
                        {point}
                      </li>
                    ))}
                  </ul>
                </article>
              </Reveal>
            );
          })}
        </RevealGroup>
      </Container>
    </Section>
  );
}
