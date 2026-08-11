import { brand, download, waitlist } from "@/lib/marketing/content";
import { parseHeading } from "@/lib/marketing/heading";
import { MountainRule } from "./ui/bhutan";
import { ParallaxImage } from "./ui/parallax-image";
import { QrCode } from "./ui/qr-code";
import { Reveal } from "./ui/reveal";
import { Container } from "./ui/section";
import { StoreBadges } from "./ui/store-badges";
import { TextReveal } from "./ui/text-reveal";
import { WaitlistCta } from "./waitlist-cta";

/**
 * Where the QR points. An absolute URL because the whole point is that it is
 * read by a camera on a different device, which has no origin to resolve
 * against — and `?src=qr` is what makes a scan distinguishable from a click in
 * `app_waitlist.source`.
 */
const QR_TARGET = `https://${brand.domain}/waitlist?src=qr`;

/**
 * Closing download band. The page's primary action appears twice — here and in
 * the hero — because everything between them is the argument for tapping it.
 *
 * Pre-launch that action is the waitlist, and this band is the one place that
 * gets a **scannable** QR beside it. It is here rather than in the hero for the
 * same reason the band exists at all: somebody at the bottom of the page has
 * read the argument, and they are the ones who will pick up a phone. It
 * resolves to `/waitlist` — a real route — because a camera cannot open a
 * modal.
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
              <span className="text-rausch text-caption-sm font-semibold tracking-[0.16em] uppercase">
                {download.eyebrow}
              </span>
            </Reveal>

            {/* Rausch, matching the eyebrow above and the Sign in button — this band
                was the last saffron text on the page. Note this accent does sit beside
                real controls (the waitlist button and the QR card below), which the
                hero's accent deliberately does not; the weight drop and the display
                size are what keep it reading as a headline rather than a link. */}
            <TextReveal
              as="h2"
              id="download-title"
              lines={parseHeading("The chair is ready _when you are_")}
              className="text-editorial-xl mt-4 max-w-3xl font-semibold text-white"
              accentClassName="text-rausch"
            />

            <Reveal delay={0.12}>
              <p className="mt-5 max-w-lg text-body-lg leading-relaxed text-white/80">
                {download.body}
              </p>
            </Reveal>

            <Reveal delay={0.16}>
              <div className="mt-8 flex flex-col items-center gap-6 sm:flex-row sm:items-stretch sm:justify-center">
                <WaitlistCta source="download_button" size="lg" />

                {/* The scan route, offered beside the tap route rather than
                    instead of it — a laptop reader taps, a phone reader scans,
                    and neither should have to switch device. */}
                <div className="flex items-center gap-4 rounded-2xl bg-white/10 p-3 ring-1 ring-white/20 ring-inset backdrop-blur-md">
                  <div className="rounded-xl bg-white p-2">
                    <QrCode
                      value={QR_TARGET}
                      label={`QR code — scan to ${waitlist.cta.toLowerCase()} for ${brand.appName}`}
                      className="size-16"
                    />
                  </div>
                  <span className="pr-2 text-left">
                    <span className="block text-ui font-semibold text-white">
                      {waitlist.qr.caption}
                    </span>
                    <span className="block text-caption text-white/65">
                      {waitlist.qr.sub}
                    </span>
                  </span>
                </div>
              </div>
            </Reveal>

            <Reveal delay={0.24}>
              <StoreBadges tone="light" className="mt-7 justify-center" />
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
