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
 * Where the QR points. An absolute URL because the whole point is that it is read by
 * a camera on a different device, which has no origin to resolve against — and
 * `?src=qr` is what makes a scan distinguishable from a click in
 * `app_waitlist.source`.
 */
const QR_TARGET = `https://${brand.domain}/waitlist?src=qr`;

/**
 * Closing call to action. The page's primary action appears twice — here and in the
 * hero — because everything between them is the argument for tapping it.
 *
 * **This is the page's one dark surface, and it is a photograph rather than a
 * fill.** The queue band and the footer were both dark before; with those on the
 * light system this band is the single full stop, which is what it was always for.
 * The reference's canvas is white everywhere and its contrast comes from
 * photography — this is that, once.
 *
 * The scannable QR sits here rather than in the hero for the same reason the band
 * exists: somebody at the bottom of the page has read the argument, and they are the
 * ones who will pick up a phone. It resolves to `/waitlist` — a real route — because
 * a camera cannot open a modal.
 */
export function DownloadBand() {
  return (
    <section
      id="download"
      aria-labelledby="download-title"
      className="scroll-mt-[calc(var(--site-header-height)+1.5rem)] pt-2 pb-14 sm:pb-16 lg:pb-20"
    >
      <Container>
        <ParallaxImage
          src={download.image}
          alt={download.alt}
          className="grain min-h-[26rem] w-full sm:min-h-[30rem]"
          rounded="rounded-lg"
          sizes="(min-width: 1280px) 1280px, 100vw"
          strength={8}
        >
          <div
            className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-black/75"
            aria-hidden
          />

          <div className="relative flex min-h-[26rem] flex-col items-center justify-center px-6 py-16 text-center sm:min-h-[30rem] sm:px-10">
            <Reveal>
              <span className="text-rausch text-caption-sm font-semibold tracking-[0.14em] uppercase">
                {download.eyebrow}
              </span>
            </Reveal>

            <TextReveal
              as="h2"
              id="download-title"
              lines={parseHeading("The chair is ready _when you are_")}
              className="text-editorial-xl mt-3 max-w-[38rem] font-semibold text-white"
              accentClassName="text-rausch"
            />

            <Reveal delay={0.1}>
              {/* 32rem written out, not `max-w-lg` — that resolves to
                  `--spacing-lg`, 24px. See `components/ui/sheet.tsx`. */}
              <p className="text-body-lg mt-4 max-w-[32rem] text-white/80">
                {download.body}
              </p>
            </Reveal>

            <Reveal delay={0.14}>
              <div className="mt-8 flex flex-col items-center gap-5 sm:flex-row sm:justify-center">
                <WaitlistCta source="download_button" size="lg" />

                {/* The scan route, offered beside the tap route rather than instead
                    of it — a laptop reader taps, a phone reader scans, and neither
                    should have to switch device. */}
                <div className="bg-canvas shadow-card flex items-center gap-4 rounded-md p-3 pr-4">
                  {/*
                    Square corners, and `rounded-none` rather than dropping the class
                    — stating the zero is what stops the next reader "restoring" a
                    radius. The white square here *is* the quiet zone
                    (`qr-code.tsx` bakes `margin: 0` into the SVG precisely so this
                    element owns it), and a camera needs it square to lock onto the
                    finder patterns in the corners.
                  */}
                  <div className="rounded-none bg-white">
                    <QrCode
                      value={QR_TARGET}
                      label={`QR code — scan to ${waitlist.cta.toLowerCase()} for ${brand.appName}`}
                      className="size-16"
                    />
                  </div>
                  <span className="text-left">
                    <span className="text-ink text-ui block font-semibold">
                      {waitlist.qr.caption}
                    </span>
                    <span className="text-muted block text-caption">
                      {waitlist.qr.sub}
                    </span>
                  </span>
                </div>
              </div>
            </Reveal>

            <Reveal delay={0.2}>
              <StoreBadges tone="light" className="mt-7 justify-center" />
            </Reveal>
          </div>

          {/* Himalayan skyline closing the band — misted white so it reads against
              the photograph rather than disappearing into it. */}
          <MountainRule className="absolute inset-x-0 bottom-0 h-14 text-white/20 sm:h-20" />
        </ParallaxImage>
      </Container>
    </section>
  );
}
