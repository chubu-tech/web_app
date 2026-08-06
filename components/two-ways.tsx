import { CalendarCheck, Check, QrCode } from "lucide-react";
import { twoWays } from "@/lib/content";
import { HoverZoomImage } from "./ui/parallax-image";
import { Reveal, RevealGroup } from "./ui/reveal";
import { Container, Section, SectionHeading } from "./ui/section";
import { Curtain } from "./ui/curtain";
import { Tilt } from "./ui/tilt";

const ICONS = [CalendarCheck, QrCode];

/**
 * The two paths into a chair — book ahead, or scan on arrival. This is the
 * whole product in one screen, so it sits directly under the hero.
 *
 * The photographs wear a dzong-window arch (`arch` utility) — the page's main
 * Bhutanese architectural cue.
 */
export function TwoWays() {
  return (
    <Section id="how-it-works" aria-labelledby="how-it-works-title">
      <Container>
        <SectionHeading
          eyebrow={twoWays.eyebrow}
          title="Two ways into _the chair_"
          body={twoWays.body}
          align="center"
          titleId="how-it-works-title"
        />

        <RevealGroup
          className="mt-14 grid gap-8 sm:mt-18 lg:grid-cols-2 lg:gap-12"
          stagger={0.12}
        >
          {twoWays.options.map((option, i) => {
            const Icon = ICONS[i];

            return (
              <Reveal asChild key={option.tag}>
                <article className="group flex flex-col items-center text-center">
                  <Tilt className="w-full max-w-sm">
                    <Curtain className="arch aspect-4/5 w-full overflow-hidden" delay={i * 0.1}>
                      <div className="absolute inset-0">
                        <HoverZoomImage
                          src={option.image}
                          alt={option.alt}
                          sizes="(min-width: 1024px) 44vw, 92vw"
                        />
                        <div
                          className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent"
                          aria-hidden
                        />
                        <span className="absolute top-6 left-1/2 inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/35 px-3.5 py-2 text-caption-sm font-semibold tracking-[0.14em] text-white uppercase ring-1 ring-white/25 ring-inset backdrop-blur-md">
                          <Icon
                            className="size-3.5"
                            strokeWidth={2.2}
                            aria-hidden
                          />
                          {option.tag}
                        </span>
                      </div>
                    </Curtain>
                  </Tilt>

                  <h3 className="text-ink mt-7 max-w-sm text-heading font-semibold">
                    {option.title}
                  </h3>
                  <p className="text-body mt-3 max-w-md leading-relaxed">
                    {option.body}
                  </p>

                  <ul className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2">
                    {option.points.map((point) => (
                      <li
                        key={point}
                        className="text-muted flex items-center gap-2 text-body-sm"
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
