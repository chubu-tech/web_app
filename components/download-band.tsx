import { download } from "@/lib/content";
import { parseHeading } from "@/lib/heading";
import { MountainRule } from "./ui/bhutan";
import { ParallaxImage } from "./ui/parallax-image";
import { Reveal } from "./ui/reveal";
import { Container } from "./ui/section";
import { StoreBadges } from "./ui/store-badges";
import { TextReveal } from "./ui/text-reveal";

/**
 * Closing download band. The page's primary action appears twice — here and in
 * the hero — because everything between them is the argument for tapping it.
 */
export function DownloadBand() {
  return (
    <section
      id="download"
      aria-labelledby="download-title"
      className="pb-6"
      style={{ scrollMarginTop: "6rem" }}
    >
      <Container>
        <ParallaxImage
          src={download.image}
          alt={download.alt}
          className="rounded-slab-lg grain min-h-[28rem] w-full sm:min-h-[32rem]"
          sizes="100vw"
          strength={9}
        >
          <div
            className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/35 to-black/75"
            aria-hidden
          />

          <div className="relative flex min-h-[28rem] flex-col items-center justify-center px-6 py-20 text-center sm:min-h-[32rem]">
            <Reveal>
              <span className="text-saffron text-[0.6875rem] font-semibold tracking-[0.16em] uppercase">
                {download.eyebrow}
              </span>
            </Reveal>

            <TextReveal
              as="h2"
              id="download-title"
              lines={parseHeading("The chair is ready _when you are_")}
              className="text-display-xl mt-4 max-w-3xl leading-[1.02] font-semibold text-white"
              accentClassName="text-saffron"
            />

            <Reveal delay={0.12}>
              <p className="mt-5 max-w-lg text-[1.0625rem] leading-relaxed text-white/80">
                {download.body}
              </p>
            </Reveal>

            <Reveal delay={0.2}>
              <StoreBadges tone="light" className="mt-8 justify-center" />
            </Reveal>
          </div>

          {/* Himalayan skyline closing the band — misted white so it reads
              against the photograph rather than disappearing into it. */}
          <MountainRule className="absolute inset-x-0 bottom-0 h-16 text-white/20 sm:h-20" />
        </ParallaxImage>
      </Container>
    </section>
  );
}
