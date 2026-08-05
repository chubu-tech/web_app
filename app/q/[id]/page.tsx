import type { Metadata } from "next";
import { MapPin } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/section";
import { brand, queueLanding } from "@/lib/content";
import { getSalonIndex, type Salon } from "@/lib/salons";

/**
 * `/q/<businessId>` — where a shop's printed walk-in-queue QR code lands.
 *
 * Anyone with the app installed should never reach this page: once
 * `public/.well-known/assetlinks.json` and `apple-app-site-association` are
 * live and verified, Android and iOS hand this URL straight to Tho. This is the
 * page for everyone else, so it leads with "get the app".
 *
 * The custom scheme stays `bhutansalons://q/<id>` — every QR already printed for
 * a shop encodes it. See `app/lib/business/queue/queue_links.dart` in the tho
 * repo; changing the scheme would invalidate physical signage.
 *
 * There is deliberately no automatic redirect to that scheme: on a phone without
 * the app it raises a browser error dialog, which is a worse first impression
 * than a page that explains itself.
 */

/** Matches the salon index on the home page — see `app/page.tsx`. */
export const revalidate = 3600;

/**
 * A shop code is a Postgres uuid. Anything else is a truncated or mistyped link,
 * so it is not worth a lookup and must not be echoed into a deep link.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Prerender one page per salon we already know about, so a scan resolves to
 * static HTML with the shop's name in it and no request on load.
 *
 * A salon approved after the last build is not in this list; `dynamicParams`
 * defaults to true, so its page is rendered on demand and then cached. Nothing
 * 404s just because the index is an hour stale.
 */
export async function generateStaticParams() {
  const { salons } = await getSalonIndex();
  return salons.map((salon) => ({ id: salon.id }));
}

async function findSalon(id: string): Promise<Salon | null> {
  if (!UUID.test(id)) return null;
  const { salons } = await getSalonIndex();
  return salons.find((salon) => salon.id === id) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const salon = await findSalon(id);
  const title = salon
    ? `${salon.name} — join the queue in ${brand.appName}`
    : queueLanding.title;

  return {
    title,
    description: `Join this salon's walk-in queue in the ${brand.appName} app.`,
    // A per-shop utility page, not something to rank. Matches the old
    // `site/q.html`, which carried `<meta name="robots" content="noindex">`.
    robots: { index: false, follow: false },
  };
}

export default async function QueueLandingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const valid = UUID.test(id);
  const salon = await findSalon(id);

  const heading = salon
    ? queueLanding.titleWithSalon.replace("{salon}", salon.name)
    : queueLanding.title;

  return (
    <>
      <SiteHeader />
      <main id="main" className="flex-1 pt-28 pb-24 sm:pt-32">
        <Container>
          <div className="mx-auto max-w-[38rem]">
            <h1 className="text-display-lg leading-[1.06] font-semibold">
              {heading}
            </h1>
            <p className="text-body mt-5 text-[1.0625rem] leading-relaxed">
              {valid ? queueLanding.lede : queueLanding.badId}
            </p>

            {/* The shop card only appears when we actually know the shop. */}
            {salon && (
              <div className="bg-paper ring-hairline-soft mt-8 rounded-slab p-6 ring-1 ring-inset">
                <h2 className="text-ink text-[1.125rem] font-semibold">
                  {salon.name}
                </h2>
                {salon.city && (
                  <p className="text-muted mt-1.5 inline-flex items-center gap-1.5 text-[0.9375rem]">
                    <MapPin className="size-4" strokeWidth={2} aria-hidden />
                    {salon.city}
                  </p>
                )}
              </div>
            )}

            <div className="mt-9 flex flex-wrap gap-3">
              {/* `#download`, not the old site's `#get` — this repo's band id. */}
              <Button href="/#download" variant="primary" size="lg">
                {queueLanding.getApp}
              </Button>
              {valid && (
                <Button
                  href={`bhutansalons://q/${encodeURIComponent(id)}`}
                  variant="ghost"
                  size="lg"
                  arrow={false}
                >
                  {queueLanding.openApp}
                </Button>
              )}
            </div>

            <p className="text-muted mt-10 text-[0.9375rem] leading-relaxed">
              {queueLanding.reassurance}
            </p>
          </div>
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}
