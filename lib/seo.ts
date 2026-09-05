import type { Metadata } from "next";
import { brand } from "./marketing/content";
import type { WorkingHour } from "./types/booking";
import { placeOf } from "./places";
import { salonPath, stylistPath } from "./slug";
import type { Business, ServiceItem, StaffMember } from "./types/salon";
import { travels } from "./types/salon";
import { absoluteUrl } from "./site";

/**
 * schema.org structured data for the two public pages that describe a real-world thing.
 *
 * This is the highest-value SEO work in the app and it is worth being precise about why:
 * a salon page is a **local business listing**, and a local business listing that a
 * crawler can only read as prose competes with one it can read as data. `HairSalon` with
 * an address, coordinates, opening hours and a rating is what puts a salon in a map pack
 * and gives it stars in a result; the same page without it is a title and 155 characters.
 *
 * Pure functions here rather than JSX in the page, for the reason every other `lib/`
 * module in this repo gives: the shape is a **claim about the salon**, and claims get
 * tests. Three of the rules below are Google policy rather than taste, and each one is a
 * rich-result penalty if broken.
 */

/**
 * Serialise for a `<script type="application/ld+json">`.
 *
 * **`<` is escaped, and that is not cosmetic.** Every string in here is user-authored —
 * a salon's name and description are typed by its owner in `/business/settings/salon` —
 * so a description containing `</script>` would close the tag and put the rest of the
 * JSON into the document as markup. `<` is valid JSON, parses back to `<`, and
 * cannot terminate an element. This is the standard escape and it is the only reason
 * `dangerouslySetInnerHTML` is safe here.
 */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

/** schema.org's day names, indexed by `business_hours.day_of_week` (0 = Sunday). */
const SCHEMA_DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

/**
 * A salon, as `HairSalon` — a subtype of `LocalBusiness`.
 *
 * Three rules that are policy, not preference:
 *
 * 1. **`aggregateRating` is omitted entirely below one review.** Google treats a rating
 *    with no reviews behind it as a structured-data violation and can demote every rich
 *    result on the domain, not just this page. 4 of 13 live salons are unrated, so this
 *    branch is the normal path, not an edge case.
 * 2. **`openingHoursSpecification` describes the salon's own hours**, which gate nothing
 *    about booking — `private.is_bookable_window` reads `staff_working_hours` and never
 *    `business_hours`. That is exactly right here: this field is a promise about when the
 *    door is open, which is what the salon's hours are, and it is not a claim about
 *    availability.
 * 3. **A travelling business gets no `address` and no `geo`.** `home_based` and `mobile`
 *    salons have no shopfront to stand outside, and publishing a stylist's home as a
 *    business address is worse than publishing nothing. `travels()` is the same predicate
 *    the page uses to swap the address line for a coverage line.
 *
 * `priceRange` is derived from the live price list rather than guessed at with dollar
 * signs — schema.org allows free text, and "Nu 150–Nu 1,200" says more to a reader than
 * `$$` and is true.
 */
export function salonSchema({
  business,
  hours,
  services,
}: {
  business: Business;
  hours: WorkingHour[];
  services: ServiceItem[];
}): Record<string, unknown> {
  const url = absoluteUrl(salonPath(business));
  const prices = services.map((s) => s.price).filter((p) => p > 0);

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "HairSalon",
    "@id": url,
    name: business.name,
    url,
  };

  if (business.description) schema.description = business.description;
  if (business.coverUrl) schema.image = business.coverUrl;
  if (business.phone) schema.telephone = business.phone;

  if (!travels(business)) {
    if (business.addressText) {
      /*
        `addressLocality` comes from `lib/places.ts`, never from `businesses.city`.

        A locality is the single most useful field on this node — it is what answers
        "salons in Thimphu" — and it is also the easiest to get wrong here, because the
        column named `city` holds the wrong town for **seven of the ten live salons**.
        Publishing it would tell Google that Norzin Salon & Spa, on Norzin Lam, is in
        Paro. `placeOf` resolves from coordinates first and the owner-typed address
        second, and returns null rather than guessing — so a salon nobody can place gets
        a street address with a country and no town, which is true.
      */
      const { town } = placeOf(business);
      schema.address = {
        "@type": "PostalAddress",
        streetAddress: business.addressText,
        ...(town ? { addressLocality: town.name } : {}),
        addressCountry: "BT",
      };
      if (town) schema.areaServed = { "@type": "City", name: town.name };
    }
    if (business.lat != null && business.lng != null) {
      schema.geo = {
        "@type": "GeoCoordinates",
        latitude: business.lat,
        longitude: business.lng,
      };
    }
  }

  if (business.reviewCount > 0 && business.avgRating != null) {
    schema.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: business.avgRating,
      reviewCount: business.reviewCount,
      bestRating: 5,
      worstRating: 1,
    };
  }

  if (hours.length > 0) {
    schema.openingHoursSpecification = hours.map((h) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: `https://schema.org/${SCHEMA_DAYS[h.dayOfWeek] ?? "Monday"}`,
      opens: h.startTime.slice(0, 5),
      closes: h.endTime.slice(0, 5),
    }));
  }

  if (prices.length > 0) {
    const low = Math.min(...prices);
    const high = Math.max(...prices);
    schema.priceRange =
      low === high ? `Nu ${low.toLocaleString("en-US")}` : `Nu ${low.toLocaleString("en-US")}–Nu ${high.toLocaleString("en-US")}`;
    schema.currenciesAccepted = "BTN";
  }

  /*
    The price list, as data rather than as a range string.

    `priceRange` above is honest and **unparseable** — "Nu 150–Nu 1,200" cannot answer
    *"how much is a beard trim in Thimphu"*, which is the shape of query this whole page
    exists to win. These nodes can. The services are already loaded to render the page, so
    this costs no read.

    Three things are deliberate:

    - **`BTN`, not `Nu`.** ISO 4217 for the Ngultrum. `priceCurrency: "Nu"` is invalid and
      drops the node silently, and the marketing graph already gets this right.
    - **This is the price list, not the availability.** `service_staff` is the authority on
      what can actually be booked and it is narrower — Norzin lists five services and its
      stylists perform three. Publishing `InStock` for a service nobody performs would
      advertise an appointment `create_booking` refuses. So `availability` is omitted
      entirely rather than asserted: the claim made here is *"this is on the menu at this
      price"*, which the row does support, and nothing more.
    - **`itemOffered.provider` points at the salon's own `@id`**, so a crawler reading a
      service joins it to the business rather than filing an unattached offer.
  */
  if (services.length > 0) {
    schema.hasOfferCatalog = {
      "@type": "OfferCatalog",
      name: `Services at ${business.name}`,
      itemListElement: services.map((s) => ({
        "@type": "Offer",
        ...(s.price > 0
          ? { price: s.price, priceCurrency: "BTN" }
          : {}),
        itemOffered: {
          "@type": "Service",
          name: s.name,
          ...(s.description ? { description: s.description } : {}),
          provider: { "@id": url },
        },
      })),
    };
  }

  // Cash on collection is the whole payment model — `place_order` records what is owed
  // and nothing in this product takes a card. Saying so is useful and true; naming a card
  // network would not be.
  schema.paymentAccepted = "Cash";

  return schema;
}

/**
 * A stylist, as `Person` employed by the salon.
 *
 * `worksFor` carries the salon's `@id`, which is the same URL `salonSchema` mints — so a
 * crawler reading both pages joins them into one graph rather than seeing two unrelated
 * entities that happen to share a name. That link is the whole reason this is worth
 * emitting at all; a bare `Person` with a job title ranks for nothing.
 *
 * No `aggregateRating` even though a stylist has reviews: `staff_follow_summary` is the
 * only aggregate this app reads for a stylist and it counts *followers*, not ratings.
 * Publishing a follower count in a rating field would be a false claim in a field crawlers
 * check.
 */
export function stylistSchema({
  staff,
  business,
  services = [],
}: {
  staff: StaffMember;
  business: Business;
  /** What this stylist performs, from `service_staff` — not the salon's whole menu. */
  services?: ServiceItem[];
}): Record<string, unknown> {
  const url = absoluteUrl(stylistPath(staff));
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": url,
    name: staff.displayName,
    url,
    worksFor: {
      "@type": "HairSalon",
      "@id": absoluteUrl(salonPath(business)),
      name: business.name,
    },
  };

  /*
    **Not `staff.role`.** That column is a permission flag — the live values across all 21
    active rows are `staff` and `owner`, which is what `private.is_business_member` reads —
    so emitting it produced `jobTitle: "staff"`, a field a crawler takes as a job title and
    which says nothing about what the person does. `jobTitle` is a public claim, so it gets
    the word the product itself uses for this person on every customer-facing surface.
  */
  schema.jobTitle = "Hair Stylist";
  if (staff.photoUrl) schema.image = staff.photoUrl;

  /*
    What this person actually does — the edge that makes a stylist page answerable by
    capability ("who does beard trims at Norzin") rather than only by name.

    **`service_staff` is the source, and here it is the correct one**, which is the
    opposite of the call made in `salonSchema` above. The difference is what the node
    claims: a salon's catalogue is a menu, so the menu table is right; a person's
    `makesOffer` is a claim that *this stylist performs this service*, and
    `service_staff` is the only table that knows. It is also what `compute_availability`
    and `create_booking` both require, so every offer listed here is genuinely bookable
    with this person.
  */
  if (services.length > 0) {
    schema.makesOffer = services.map((s) => ({
      "@type": "Offer",
      ...(s.price > 0 ? { price: s.price, priceCurrency: "BTN" } : {}),
      itemOffered: {
        "@type": "Service",
        name: s.name,
        provider: { "@id": absoluteUrl(salonPath(business)) },
      },
    }));
  }

  return schema;
}

/**
 * A `BreadcrumbList`, from a trail the page already renders.
 *
 * This answers no question on its own. What it does is tell an engine where a page sits,
 * which is what turns a bare URL in a result into a described one, and what stops a salon
 * page reading as though it were about the whole site.
 *
 * **Positions are 1-based** — a 0-based list is silently rejected — and the last crumb is
 * the page itself, which is required rather than optional.
 */
export function breadcrumbSchema(
  trail: readonly { name: string; path: string }[],
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  };
}

/**
 * A list page — `/salons`, `/top-rated`, a place page — as a `CollectionPage` whose
 * `mainEntity` is the ordered list of salons on it.
 *
 * Worth emitting because these are the pages that answer *"salons in Thimphu"*, and
 * without it they are prose with links: an engine has to infer that the twelve headings
 * are businesses and that their order means something. With it, the page states that it
 * is a list of `N` named `HairSalon` entities, each one addressable by an `@id` that
 * resolves to its own page and its own full markup.
 *
 * **Only `@id` and `name` per item, deliberately.** The full node lives on the salon's own
 * page; repeating the address, hours and rating on every list page would be three
 * competing copies of one business's data, and the copy on a list page is the one most
 * likely to go stale.
 */
export function salonListSchema({
  name,
  description,
  path,
  salons,
}: {
  name: string;
  description: string;
  path: string;
  salons: readonly { id: string; name: string }[];
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": absoluteUrl(path),
    url: absoluteUrl(path),
    name,
    description,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: salons.length,
      itemListElement: salons.map((salon, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: {
          "@type": "HairSalon",
          "@id": absoluteUrl(salonPath(salon)),
          name: salon.name,
          url: absoluteUrl(salonPath(salon)),
        },
      })),
    },
  };
}

/**
 * A `FAQPage` from question-and-answer copy the page also renders.
 *
 * **The markup and the visible text must be the same words.** Google requires it, and it
 * is also the only way the node stays true as the copy changes — which is why every
 * caller passes the same array the component renders rather than a second copy written
 * for crawlers.
 */
export function faqSchema(
  items: readonly { q: string; a: string }[],
  id?: string,
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    ...(id ? { "@id": absoluteUrl(id) } : {}),
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}

/**
 * `sameAs` for the `Organization` node — the profiles that corroborate this entity, and
 * nothing else.
 *
 * The rule encoded here is the one the homepage graph used to state as its reason for
 * having no `sameAs` at all: an empty string is invalid structured data, and an array
 * filtered to nothing is a field claiming *"no corroborating profiles"* rather than saying
 * nothing. So this returns a **spreadable fragment** — `{ sameAs: [...] }` when something is
 * real, `{}` when nothing is — and the key disappears from the graph rather than appearing
 * empty.
 *
 * Trimmed and de-duplicated, because the call site is a list of hand-pasted URLs and a
 * repeated entry is the same claim made twice.
 *
 * A single readonly array rather than a rest parameter: a `readonly` rest parameter is a
 * type error, and the array form keeps the call site's intent visible.
 */
export function sameAsBlock(
  urls: readonly (string | null | undefined)[],
): { sameAs?: string[] } {
  const real = [
    ...new Set(urls.map((url) => url?.trim() ?? "").filter((url) => url.length > 0)),
  ];
  return real.length > 0 ? { sameAs: real } : {};
}

/* ────────────────────────────────────────────────────────────────────────────
   Share cards — the Open Graph and Twitter metadata a link unfurls into.
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * The branded share card's route, its dimensions, and the density it is drawn at.
 *
 * `app/opengraph-image.tsx` imports these rather than declaring its own, so the numbers
 * a platform is *told* in `og:image:width`/`height` and the numbers the PNG actually has
 * come from one place and cannot drift. Facebook and WhatsApp both crop against the
 * declared aspect ratio, so a card that lies about its own size is a card with somebody's
 * headline sliced in half.
 *
 * ## The ratio is fixed; the resolution is not
 *
 * **1.91:1 is not a preference.** It is the shape Facebook, LinkedIn and X's
 * `summary_large_image` all expect, and 1200×630 is Facebook's documented minimum for the
 * large format (600×315) at 2×. That ratio must not change.
 *
 * The *pixel count* is a separate question, and 1200×630 was only the floor. Every surface
 * that shows this card downscales it — WhatsApp Web renders a ~100 px square crop, and a
 * phone's large card is retina — so the source is resampled on the way to the screen, and
 * resampling from more pixels is what keeps 30 px body copy from turning to mush. The card
 * is therefore **drawn at 1200×630 and emitted at `scale`×**, which is why `scale` lives
 * here rather than as a loose `2` in the route: the design's own numbers stay readable at
 * their natural size and one constant moves all of them.
 *
 * **The binding constraint is WhatsApp, not Facebook.** Facebook allows 8 MB and LinkedIn
 * and X allow 5 MB, so none of those are close. WhatsApp is the strict one — a large
 * preview wants a few hundred KB, not megabytes — and it is the one to re-measure before
 * raising `scale` again. At 2× this card is a flat-colour PNG well inside that.
 */
export const SHARE_CARD = {
  path: "/opengraph-image",
  /** Emitted pixels per design pixel. Raise only after re-measuring the PNG's size. */
  scale: 2,
  /**
   * Cache-buster for the image URL. **Bump this whenever the card's pixels change.**
   *
   * Facebook, WhatsApp and LinkedIn cache a share image against its URL and hold it for
   * a long time — re-scraping the *page* does not re-fetch an image whose URL has not
   * moved, so a redraw at a new resolution would keep unfurling as the old one. Next's own
   * file convention solves this by appending a build hash, which `shareCard` gives up by
   * constructing the URL itself; this is the explicit equivalent.
   */
  version: 2,
  width: 1200 * 2,
  height: 630 * 2,
  contentType: "image/png",
} as const;

/** The share card's alt text. Read by `app/opengraph-image.tsx` and by `shareCard`. */
export const SHARE_CARD_ALT = `${brand.name} — ${brand.tagline}`;

/** One image in a share card, as both Open Graph and Twitter want it. */
type ShareImage = { url: string; alt?: string; width?: number; height?: number };

/**
 * The branded card, absolute. Every page falls back to this when it has no photo of
 * its own, which is the whole point of the function below.
 */
const BRANDED_IMAGE: ShareImage = {
  // `?v=` is what makes a redraw reach a platform that already cached this URL — see
  // `SHARE_CARD.version`. The route ignores the query; only the caches read it.
  url: absoluteUrl(`${SHARE_CARD.path}?v=${SHARE_CARD.version}`),
  width: SHARE_CARD.width,
  height: SHARE_CARD.height,
  alt: SHARE_CARD_ALT,
};

/**
 * Build a page's `openGraph` **and** `twitter` metadata together, from one set of copy.
 *
 * ## The bug this exists to make impossible
 *
 * Next merges metadata **shallowly**, one field at a time. A page that exports
 * `openGraph: { title, description, url }` therefore does not *extend* the root layout's
 * `openGraph` — it **replaces** it, and takes `siteName`, `locale` and, decisively, the
 * `opengraph-image.tsx` file convention's `images` down with it.
 *
 * Nine pages did exactly that, so the nine most valuable URLs on the domain — the
 * homepage, `/for-salons`, `/help`, Discover, `/salons`, `/top-rated`, `/map`, and every
 * salon and stylist without a photo — unfurled on WhatsApp with **no image at all**,
 * while `/privacy`, which overrides nothing, unfurled correctly. Measured against the
 * live site, not reasoned about: `curl https://bhutansalons.com/ | grep og:image` matched
 * nothing, and the same grep on `/privacy` matched five tags.
 *
 * Twitter was the same failure a second time. Not one page declared a `twitter` block, so
 * every route on the domain inherited the root layout's generic title and description —
 * `/for-salons` told X it was about booking a haircut. And because `twitter:*` is what
 * LinkedIn and Slack read when they prefer it, that is not an X-only cost.
 *
 * A helper rather than a convention to remember: the two blocks are built from the same
 * three arguments, so they cannot disagree, and there is no way to set a title here
 * without also getting an image.
 *
 * ## `images` is a fallback, not a default
 *
 * Pass a salon's cover or a stylist's photo and the card is the shop. Pass nothing — or
 * an empty array, which is what `coverUrl ?? undefined` yields for the salons that have
 * no photo — and it is the branded card. That branch is the normal path, not an edge
 * case: `MARKETING.md` records that real salons routinely have no cover, and
 * `staff_photos` holds 2 rows platform-wide.
 *
 * @param url A path this app serves, starting with `/`. Resolved against `metadataBase`.
 */
export function shareCard({
  title,
  description,
  url,
  type = "website",
  images,
}: {
  title: string;
  description: string;
  url: string;
  /** `profile` for a person, `article` for a document. Anything else is a `website`. */
  type?: "website" | "profile" | "article";
  /** The page's own imagery. Empty or absent falls back to the branded card. */
  images?: readonly ShareImage[];
}): Required<Pick<Metadata, "openGraph" | "twitter">> {
  const picture = images?.length ? [...images] : [BRANDED_IMAGE];

  return {
    openGraph: {
      type,
      siteName: brand.name,
      locale: "en_BT",
      title,
      description,
      url,
      images: picture,
    },
    twitter: {
      /*
        `summary_large_image` on every page, matching the 1200×630 card. The small
        `summary` card would letterbox it into a square thumbnail, and a photograph of a
        salon interior does not survive that crop.
      */
      card: "summary_large_image",
      title,
      description,
      images: picture,
    },
  };
}
