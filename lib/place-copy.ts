import { areasOf, type Place, salonsIn, townOf } from "./places";
import type { Business } from "./types/salon";
import { runsQueue } from "./types/salon";

/**
 * The words on a place page, composed from that place's own salons.
 *
 * **Every sentence here is derived from rows.** Nothing about Thimphu is written down; the
 * count, the price floor, the categories and the walk-in claim are all read off the salons
 * that resolved to the place. That is what makes a page per town honest rather than a
 * template with a name substituted into it — which is the difference between a local
 * landing page and a doorway page, and it is a difference Google's guidelines draw
 * explicitly.
 *
 * It also means a place page cannot go stale or overstate. If a town's only salon stops
 * taking walk-ins, the sentence saying salons there take walk-ins disappears on the next
 * revalidation, because it was never a sentence about the town.
 *
 * The copy is written to the same extraction rules as `faq` in `lib/marketing/content.ts`:
 * the place and the country are named in the sentence rather than left to context, the
 * lead sentence answers the implied question, and figures are stated rather than described.
 */

export type PlaceCopy = {
  title: string;
  h1: string;
  description: string;
  intro: string;
  faq: { q: string; a: string }[];
};

/** "Thimphu" for a town, "Norzin Lam, Thimphu" for a neighbourhood. */
export function placeLabel(place: Place): string {
  const town = townOf(place);
  return place.kind === "area" && town.slug !== place.slug
    ? `${place.name}, ${town.name}`
    : place.name;
}

function list(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/**
 * Copy for a place that has salons.
 *
 * `categories` is passed in rather than read off `Business`, because the category names
 * live in a join table the page already loads for its cards — asking for them twice would
 * be a second round trip for a sentence.
 */
export function placeCopy({
  place,
  salons,
  categoryNames,
  services,
}: {
  place: Place;
  salons: Business[];
  /** Category names present among these salons, most common first. */
  categoryNames: string[];
  /** Prices of every active service at these salons, for the floor. */
  services: { price: number }[];
}): PlaceCopy {
  const label = placeLabel(place);
  const n = salons.length;
  const noun = n === 1 ? "salon" : "salons";

  const rated = salons.filter((s) => s.reviewCount > 0 && s.avgRating != null);
  const withQueue = salons.filter(runsQueue);
  const prices = services.map((s) => s.price).filter((p) => p > 0);
  const floor = prices.length > 0 ? Math.min(...prices) : null;
  const kinds = categoryNames.slice(0, 3).map((c) => c.toLowerCase());

  /*
    The title is the query, near enough verbatim. "Salons in Thimphu" is what people type,
    so it leads; "& Barbers" widens it to the barber half of the same intent without a
    second page; "Bhutan" is there because a search engine answering a geographic question
    cannot infer the country, and because "Thimphu" alone is ambiguous to anyone outside it.
  */
  const title = `Salons & Barbers in ${label}, Bhutan — Book Online`;
  const h1 = `Salons and barbers in ${label}`;

  const description =
    `Book an appointment at ${n === 1 ? "the" : "any of the"} ${n} ${noun} and barbershop${n === 1 ? "" : "s"} in ${label} on THO. ` +
    `Compare services, prices and reviews${floor != null ? `, from Nu ${floor.toLocaleString("en-US")}` : ""}, ` +
    `then book online or join a walk-in queue. Free for customers.`;

  const intro =
    `THO lists ${n} ${noun} and barbershop${n === 1 ? "" : "s"} in ${label}, Bhutan` +
    (kinds.length > 0 ? `, covering ${list(kinds)}` : "") +
    `. Each has its own page with its full price list, its team, its opening hours and its reviews, ` +
    `so you can see what a cut costs before you go. Booking is free — you pay the salon in the shop.`;

  const faq: { q: string; a: string }[] = [
    {
      q: `How do I book a salon appointment in ${label}?`,
      a:
        `Pick a salon from the ${n} listed in ${label} on THO, open its page and choose the services you want. ` +
        `Choose a stylist or leave it to the salon, then pick a time from what is actually free. ` +
        `The booking is confirmed straight away, and you can reschedule or cancel it from your bookings. Booking on THO is free.`,
    },
    {
      q: `How much does a haircut cost in ${label}?`,
      a:
        floor != null
          ? `Prices are set by each salon and every price is on its page before you book. Across the ${n} ${noun} in ${label} on THO, services start from Nu ${floor.toLocaleString("en-US")}. You pay the salon in the shop — THO takes no payment and charges no booking fee.`
          : `Prices are set by each salon, and every service price is shown on the salon's own page before you book. You pay the salon in the shop — THO takes no payment and charges no booking fee.`,
    },
  ];

  if (withQueue.length > 0) {
    /*
      The subject and the verb have to agree, and they did not.

      The first draft read *"1 of the 8 salons in Thimphu on THO **run** a live walk-in
      queue"* — caught in the rendered HTML, not in review. It matters more than a typo
      usually would: this sentence is published as an `acceptedAnswer` and is written to be
      quoted verbatim by an assistant, so the error would be repeated rather than skimmed
      past. `runsQueue` is `queue_enabled && hasFeature(plan, 'walkInQueue')`, and the
      queue is Growth-and-above, so **one of eight** is the ordinary Thimphu case rather
      than an edge case — the singular branch is the one that renders today.
    */
    const subject =
      withQueue.length === n
        ? `${n === 1 ? "The salon" : "Salons"} in ${label} on THO`
        : `${withQueue.length} of the ${n} ${noun} in ${label} on THO`;
    const verb = withQueue.length === 1 ? "runs" : "run";
    faq.push({
      q: `Can I join a walk-in queue in ${label} instead of booking?`,
      a:
        `Yes. ${subject} ${verb} a live walk-in queue. ` +
        `Scan the QR code at the door or join from the salon's page, and THO shows your position and the rough wait, updating by itself as each chair frees up — so you can wait somewhere other than the shop.`,
    });
  }

  if (rated.length > 0) {
    const best = [...rated].sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0))[0];
    faq.push({
      q: `Which is the best-rated salon in ${label}?`,
      a:
        `${best.name} is the highest-rated salon in ${label} on THO, at ${best.avgRating!.toFixed(1)} out of 5 from ${best.reviewCount} ${best.reviewCount === 1 ? "review" : "reviews"}. ` +
        `${rated.length} of the ${n} ${noun} in ${label} have been reviewed by customers. Ratings come only from customers who booked through THO.`,
    });
  }

  const areas = place.kind === "dzongkhag" ? areasOf(place.slug) : [];
  const populated = areas.filter((area) => salonsIn(salons, area).length > 0);
  if (populated.length > 0) {
    faq.push({
      q: `Which parts of ${place.name} have salons on THO?`,
      a: `Salons on THO in ${place.name} are in ${list(populated.map((a) => a.name))}. Each area has its own page listing the salons on it.`,
    });
  }

  return { title, h1, description, intro, faq };
}

/**
 * Copy for a registered place with **no** salons.
 *
 * This page exists, says so plainly, and carries `noindex` — see the route. It is not a
 * landing page waiting for traffic; it is the honest answer to a URL somebody may reach
 * from a breadcrumb or a guessed address, and the day a salon there is approved it becomes
 * a real page with no code change.
 */
export function emptyPlaceCopy(place: Place): PlaceCopy {
  const label = placeLabel(place);
  return {
    title: `Salons in ${label}, Bhutan`,
    h1: `Salons and barbers in ${label}`,
    description: `No salons in ${label} have joined THO yet. Browse every salon and barbershop in Bhutan on THO.`,
    intro: `No salons in ${label} are on THO yet. THO covers Thimphu, Paro and Phuentsholing today, and new salons join as they sign up — you can browse everything listed across Bhutan below.`,
    faq: [],
  };
}
