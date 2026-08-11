import type { WorkingHour } from "./types/booking";
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
  const url = absoluteUrl(`/salon/${business.id}`);
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
      schema.address = {
        "@type": "PostalAddress",
        streetAddress: business.addressText,
        addressCountry: "BT",
      };
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
}: {
  staff: StaffMember;
  business: Business;
}): Record<string, unknown> {
  const url = absoluteUrl(`/stylist/${staff.id}`);
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": url,
    name: staff.displayName,
    url,
    worksFor: {
      "@type": "HairSalon",
      "@id": absoluteUrl(`/salon/${business.id}`),
      name: business.name,
    },
  };

  if (staff.role) schema.jobTitle = staff.role;
  if (staff.photoUrl) schema.image = staff.photoUrl;

  return schema;
}
