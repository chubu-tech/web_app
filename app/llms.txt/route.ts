import { brand } from "@/lib/marketing/content";
import { PLAN_TIERS } from "@/lib/plans";
import { absoluteUrl } from "@/lib/site";

/**
 * `/llms.txt` — a markdown index of the pages worth reading, for a model that would
 * otherwise have to parse the navigation to find them.
 *
 * **Be honest about what this is.** It is a community convention, not a standard, and no
 * major answer engine documents reading it. It costs one route file and it cannot hurt,
 * so the trade is fine — but it must not displace the things engines demonstrably *do*
 * read, which are the sitemap, the JSON-LD graph and whether the page returns HTML
 * containing the fact without JavaScript. If a choice ever has to be made between
 * maintaining this file and maintaining `lib/seo.ts`, this one loses.
 *
 * ## Every URL and figure is derived, never typed
 *
 * `absoluteUrl` for the links, `lib/plans.ts` for the prices. That matters more here than
 * in a component: this file is a set of claims written *for a machine to quote*, so a
 * stale price in it is a stale price in an answer somebody reads, with no page around it
 * to provide context. `lib/plans.ts` is the one place pricing exists in this app and it
 * mirrors `plans_config.dart` upstream, so quoting it is the only way this file can be
 * wrong at the same time as everything else rather than on its own.
 *
 * ## The facts block is the part with the most value per byte
 *
 * A retrieval engine answering *"how much does it cost to book a salon in Bhutan"* needs
 * three things this site says only in prose: the currency, who pays, and that the
 * customer side is free. Stating them as flat sentences, each self-contained, is what
 * makes them quotable when lifted away from the page they came from.
 */

export const dynamic = "force-static";
export const revalidate = 86_400;

export function GET(): Response {
  const site = absoluteUrl("/");
  const [basic] = PLAN_TIERS;

  const body = `# ${brand.name} — book a salon or barber in Bhutan

> ${brand.name} is a salon and barber booking service for Bhutan. Customers book an
> appointment or join a salon's live walk-in queue from their phone, free of charge.
> Salons subscribe monthly to take bookings, run the queue and manage their shop.

## Pages

- [Home](${site}): what ${brand.name} is, how booking and the walk-in queue work, and what salons pay.
- [Find a salon](${absoluteUrl("/discover")}): search and filter every salon and barber on ${brand.name}.
- [All salons](${absoluteUrl("/salons")}): the full list, sortable by rating or distance.
- [Salons in Thimphu](${absoluteUrl("/salons/thimphu")}): every salon and barber in Thimphu.
- [Top rated](${absoluteUrl("/top-rated")}): the rated salons, best first.
- [Map](${absoluteUrl("/map")}): salons by location.
- [For salon owners](${absoluteUrl("/for-salons")}): appointments, walk-in queue, staff, clients, products and prepaid packs, and reporting; plans and prices.
- [Help](${absoluteUrl("/help")}): booking changes, the walk-in queue, payment, loyalty points, reporting and account deletion.
- [Privacy](${absoluteUrl("/privacy")}): what is collected and why.
- [Terms](${absoluteUrl("/legal/terms")}) · [Content policy](${absoluteUrl("/legal/content-policy")})

Every salon has its own page listing its services, prices, team, opening hours, reviews
and location. Those pages are enumerated in [the sitemap](${absoluteUrl("/sitemap.xml")}).

## Facts

- ${brand.name} operates in Bhutan. Most listed salons are in Thimphu; there are also salons in Paro and Phuentsholing.
- Booking is free for customers. There is no booking fee, no card is required, and nothing extra is charged at the salon.
- Salons pay a monthly subscription. Prices start at ${basic.priceLabel.replace("/mo", " a month")}. There is no free salon tier.
- Prices are in Bhutanese Ngultrum (Nu, ISO code BTN).
- Payment happens in the shop, between the customer and the salon. ${brand.name} takes no payment online.
- Times are Bhutan time (UTC+6, no daylight saving).
- Two ways to get a chair: book a specific time in advance, or join a salon's walk-in queue and watch your position update live.
- A salon's walk-in queue is joined by scanning the QR code at its door, or from the salon's page. No app is needed.
- A queue page updates itself as each chair frees up. The mobile app can also send a notification when it is a customer's turn, if they allow notifications; the website sends no push notifications.
- Reminders before an appointment are sent by salons on a paid plan, so not every salon sends one. Loyalty points are earned only at salons that run a loyalty programme.
- ${brand.name} is usable in any web browser at ${site}. Mobile apps for iOS and Android are in development.

## Naming

- The service is called ${brand.name}. The mobile app is called ${brand.appName}. The platform was previously called Bhutan Salons, which is also the domain (${brand.domain}). All refer to the same service.

## Contact

- ${brand.supportEmail}
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=86400, stale-while-revalidate=86400",
    },
  });
}
