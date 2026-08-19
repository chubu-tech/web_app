import type { Coords } from "./discover-logic";
import type { Business } from "./types/salon";

/**
 * Where a salon is, expressed as somewhere a person would actually search for.
 *
 * This module exists to answer one question honestly — *which salons are in Thimphu?* —
 * and the honest answer was surprisingly hard to get, because the column that looks like
 * it holds it does not.
 *
 * ## `businesses.city` is wrong on 7 of the 10 live salons, and it is not close
 *
 * Measured against the live database on 2026-08-16, over the salons an anonymous visitor
 * can actually see (`status = 'approved' and is_active`):
 *
 * | Salon | `city` | `address_text` | Where it really is |
 * | --- | --- | --- | --- |
 * | Norzin Salon & Spa | Paro | Norzin Lam, Thimphu | Thimphu |
 * | Clock Tower Cuts | Paro | Clock Tower Square, Thimphu | Thimphu |
 * | Menjong Gents Grooming | Paro | Phendey Lam, Thimphu | Thimphu |
 * | Kira Nails & Beauty | Phuentsholing | Hogdzin Lam, Thimphu | Thimphu |
 * | Lotus Spa & Wellness | Phuentsholing | Doebum Lam, Thimphu | Thimphu |
 * | Serenity Day Spa | Paro | Zhung Lam, Phuentsholing | Phuentsholing |
 * | Paro Glow Beauty Lounge | Thimphu | Tshongdue, Paro | Paro |
 *
 * Every one of those is corroborated by the coordinates: Serenity is at 26.85 N, which is
 * Phuentsholing on the Indian border and 75 km from the Thimphu valley; Paro Glow is at
 * 89.41 E, which is Paro. So `address_text` and `lat`/`lng` agree with each other and
 * `city` disagrees with both. `lib/api/mappers.ts` already refuses to surface `city` for
 * this reason and `Business` carries no such field — this module is the same judgement
 * applied to the one place that still needs an answer.
 *
 * **The consequence, which is why this is worth a module rather than a helper:** the
 * marketing search band's "Where" dropdown is built on `city` (`lib/marketing/salons.ts`),
 * so today it files six Thimphu salons under Paro and Phuentsholing. A location landing
 * page built the same way would publish that error to a search engine.
 *
 * ## Coordinates first, address text second, and never `city`
 *
 * `placeOf` resolves a salon in that order. Coordinates are a fact the owner cannot
 * mistype into the wrong valley; address text is what they maintain and it names the town
 * in 9 of 10 cases; `city` is not consulted at all.
 *
 * ## Registered ≠ published
 *
 * `PLACES` names all twenty dzongkhags and the Thimphu neighbourhoods, which is far more
 * than has a salon in it. That is deliberate and it is the opposite of a doorway-page
 * farm: `publishedPlaces()` filters to places that hold **at least one live salon**, and
 * only those enter the sitemap and answer `index, follow`. A registered place with no
 * salons renders an honest empty page carrying `noindex`, and starts ranking by itself on
 * the day a salon there is approved — with no code change and no new file.
 *
 * The alternative — a page per dzongkhag on day one — is the shape Google names as a
 * doorway network, and the penalty for it is domain-wide rather than page-level.
 */

export type PlaceKind = "dzongkhag" | "area";

export type Place = {
  /** URL segment. Stable — it is the canonical, so renaming one is a redirect. */
  slug: string;
  /** As a person writes it. */
  name: string;
  kind: PlaceKind;
  /** For an `area`, the dzongkhag slug it sits in. */
  parent?: string;
  /**
   * Strings that mean this place in an owner-typed address, lowercased.
   *
   * `name` is always matched and is not repeated here. These are the spellings the live
   * data actually uses plus the common alternates — `Wangdue` for `Wangdue Phodrang`,
   * `P/ling` for Phuentsholing, which is how it is universally abbreviated in Bhutan.
   */
  aliases?: readonly string[];
  /**
   * A bounding box, for the coordinate pass: `[south, west, north, east]`.
   *
   * Only the towns carry one. A neighbourhood box would have to be drawn tighter than the
   * accuracy of an owner-dropped map pin, so areas are matched by name only — a wrong
   * neighbourhood is a worse answer than no neighbourhood.
   */
  bbox?: readonly [number, number, number, number];
};

/**
 * The twenty dzongkhags, plus the Thimphu neighbourhoods that appear in live addresses.
 *
 * The area list is drawn from `address_text` on real rows — `Norzin Lam`, `Chang Lam`,
 * `Doebum Lam`, `Phendey Lam`, `Wogzin Lam`, `Hogdzin Lam` and `Clock Tower Square` are
 * all live, and `Babesa`, `Olakha` and `Changzamtog` appear on salons that are not
 * currently approved. The last three are registered anyway: that is exactly the case this
 * registry is built for, and each will publish itself the day its salon is approved.
 */
export const PLACES: readonly Place[] = [
  // ── The three towns the product actually serves today ────────────────────────
  {
    slug: "thimphu",
    name: "Thimphu",
    kind: "dzongkhag",
    aliases: ["thimpu", "thimphu thromde"],
    bbox: [27.38, 89.55, 27.62, 89.72],
  },
  {
    slug: "paro",
    name: "Paro",
    kind: "dzongkhag",
    bbox: [27.3, 89.28, 27.55, 89.52],
  },
  {
    slug: "phuentsholing",
    name: "Phuentsholing",
    kind: "dzongkhag",
    aliases: ["phuntsholing", "p/ling", "pling", "chukha", "chhukha"],
    bbox: [26.78, 89.3, 27.0, 89.48],
  },

  // ── The rest of the twenty ───────────────────────────────────────────────────
  { slug: "punakha", name: "Punakha", kind: "dzongkhag", bbox: [27.5, 89.78, 27.72, 90.02] },
  {
    slug: "wangdue-phodrang",
    name: "Wangdue Phodrang",
    kind: "dzongkhag",
    aliases: ["wangdue", "wangdi", "wangduephodrang"],
    bbox: [27.4, 89.85, 27.55, 90.15],
  },
  { slug: "bumthang", name: "Bumthang", kind: "dzongkhag", aliases: ["jakar", "chamkhar"], bbox: [27.5, 90.6, 27.72, 90.85] },
  { slug: "trongsa", name: "Trongsa", kind: "dzongkhag", aliases: ["tongsa"], bbox: [27.4, 90.4, 27.6, 90.6] },
  { slug: "trashigang", name: "Trashigang", kind: "dzongkhag", aliases: ["tashigang"], bbox: [27.2, 91.5, 27.4, 91.8] },
  { slug: "mongar", name: "Mongar", kind: "dzongkhag", aliases: ["monggar"], bbox: [27.2, 91.15, 27.35, 91.35] },
  {
    slug: "samdrup-jongkhar",
    name: "Samdrup Jongkhar",
    kind: "dzongkhag",
    aliases: ["samdrupjongkhar", "s/jongkhar"],
    bbox: [26.75, 91.4, 26.95, 91.65],
  },
  { slug: "gelephu", name: "Gelephu", kind: "dzongkhag", aliases: ["gelegphu"], bbox: [26.8, 90.4, 27.0, 90.6] },
  { slug: "samtse", name: "Samtse", kind: "dzongkhag", aliases: ["samchi"], bbox: [26.85, 88.9, 27.05, 89.2] },
  { slug: "haa", name: "Haa", kind: "dzongkhag", aliases: ["ha"], bbox: [27.28, 89.15, 27.45, 89.35] },
  { slug: "dagana", name: "Dagana", kind: "dzongkhag", aliases: ["daga"], bbox: [26.9, 89.85, 27.1, 90.05] },
  { slug: "tsirang", name: "Tsirang", kind: "dzongkhag", aliases: ["damphu"], bbox: [26.9, 90.05, 27.1, 90.25] },
  { slug: "zhemgang", name: "Zhemgang", kind: "dzongkhag", aliases: ["shemgang"], bbox: [26.9, 90.6, 27.3, 90.9] },
  { slug: "pemagatshel", name: "Pemagatshel", kind: "dzongkhag", aliases: ["pemagatsel", "pema gatshel"], bbox: [26.95, 91.3, 27.15, 91.5] },
  { slug: "lhuentse", name: "Lhuentse", kind: "dzongkhag", aliases: ["lhuntshi", "lhuntse"], bbox: [27.6, 91.1, 27.8, 91.3] },
  { slug: "trashiyangtse", name: "Trashiyangtse", kind: "dzongkhag", aliases: ["tashiyangtse", "yangtse"], bbox: [27.55, 91.4, 27.75, 91.6] },
  { slug: "gasa", name: "Gasa", kind: "dzongkhag", bbox: [27.85, 89.6, 28.1, 89.9] },
  { slug: "chukha", name: "Chukha", kind: "dzongkhag", aliases: ["chhukha", "tsimasham", "chapcha"], bbox: [26.85, 89.4, 27.2, 89.7] },
  { slug: "sarpang", name: "Sarpang", kind: "dzongkhag", bbox: [26.8, 90.2, 27.05, 90.5] },

  // ── Thimphu neighbourhoods, from live `address_text` ─────────────────────────
  { slug: "norzin-lam", name: "Norzin Lam", kind: "area", parent: "thimphu", aliases: ["norzin"] },
  { slug: "chang-lam", name: "Chang Lam", kind: "area", parent: "thimphu" },
  { slug: "doebum-lam", name: "Doebum Lam", kind: "area", parent: "thimphu", aliases: ["debsi", "doebum"] },
  { slug: "phendey-lam", name: "Phendey Lam", kind: "area", parent: "thimphu", aliases: ["phendey"] },
  { slug: "wogzin-lam", name: "Wogzin Lam", kind: "area", parent: "thimphu", aliases: ["wogzin"] },
  { slug: "hogdzin-lam", name: "Hogdzin Lam", kind: "area", parent: "thimphu", aliases: ["hongdzin", "hogdzin"] },
  {
    slug: "clock-tower",
    name: "Clock Tower Square",
    kind: "area",
    parent: "thimphu",
    aliases: ["clock tower", "clocktower"],
  },
  { slug: "babesa", name: "Babesa", kind: "area", parent: "thimphu", aliases: ["babena", "babesa expressway"] },
  { slug: "olakha", name: "Olakha", kind: "area", parent: "thimphu" },
  { slug: "changzamtog", name: "Changzamtog", kind: "area", parent: "thimphu", aliases: ["changzamtok"] },
  { slug: "motithang", name: "Motithang", kind: "area", parent: "thimphu" },
  { slug: "changangkha", name: "Changangkha", kind: "area", parent: "thimphu" },
  { slug: "taba", name: "Taba", kind: "area", parent: "thimphu" },
  { slug: "dechencholing", name: "Dechencholing", kind: "area", parent: "thimphu" },
  { slug: "hejo", name: "Hejo", kind: "area", parent: "thimphu", aliases: ["hejo langjuphakha", "langjuphakha"] },
  { slug: "lungtenphu", name: "Lungtenphu", kind: "area", parent: "thimphu" },
  { slug: "simtokha", name: "Simtokha", kind: "area", parent: "thimphu" },
  { slug: "kawajangsa", name: "Kawajangsa", kind: "area", parent: "thimphu", aliases: ["kawang jangsa"] },
] as const;

const BY_SLUG = new Map(PLACES.map((p) => [p.slug, p]));

/** A place by URL segment, or `null` — which is what makes an unknown slug a 404. */
export function placeBySlug(slug: string): Place | null {
  return BY_SLUG.get(slug.toLowerCase()) ?? null;
}

/** The dzongkhag a place belongs to. A dzongkhag is its own town. */
export function townOf(place: Place): Place {
  return place.kind === "area" && place.parent
    ? (BY_SLUG.get(place.parent) ?? place)
    : place;
}

/** The neighbourhoods registered under a town, in registry order. */
export function areasOf(townSlug: string): Place[] {
  return PLACES.filter((p) => p.kind === "area" && p.parent === townSlug);
}

function inBox(lat: number, lng: number, bbox: readonly [number, number, number, number]) {
  const [south, west, north, east] = bbox;
  return lat >= south && lat <= north && lng >= west && lng <= east;
}

/**
 * Does this salon's address name this place?
 *
 * Word-boundary matching, not `includes`. `"Haa"` inside `"Chhaangkha"` and `"Taba"`
 * inside `"Batabari"` are both false positives a substring test would accept, and a
 * salon filed under the wrong dzongkhag is precisely the error this module exists to
 * stop making.
 */
function addressNames(addressText: string, place: Place): boolean {
  const haystack = ` ${addressText.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
  const needles = [place.name, ...(place.aliases ?? [])];
  return needles.some((needle) => {
    const cleaned = needle.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    return cleaned.length > 0 && haystack.includes(` ${cleaned} `);
  });
}

/**
 * Whether a salon belongs to a place.
 *
 * **Coordinates decide a town; text decides a neighbourhood.** A bounding box drawn
 * around Thimphu is reliable at 20 km and meaningless at 200 m, so an `area` is matched
 * only by what the owner wrote. That asymmetry is the point: it means a salon can be
 * confidently placed in Thimphu while remaining unplaced on any particular street, which
 * is the true state of `Druk Beauty Lounge` (address `"Norzin Lam, above Sonam Trophel"`,
 * no coordinates at all).
 *
 * `businesses.city` is deliberately never consulted — see this module's header.
 */
export function isIn(business: Pick<Business, "addressText" | "lat" | "lng">, place: Place): boolean {
  const address = business.addressText?.trim();

  if (place.kind === "area") return address ? addressNames(address, place) : false;

  if (business.lat != null && business.lng != null && place.bbox) {
    return inBox(business.lat, business.lng, place.bbox);
  }
  if (address && addressNames(address, place)) return true;

  /*
    A registered neighbourhood implies its town, and without this the count is wrong.

    `Druk Beauty Lounge` is the live case: its address is `"Norzin Lam, above Sonam
    Trophel"` and it has no coordinates, so neither pass above can place it — yet Norzin
    Lam is registered as being in Thimphu, which is knowledge this file already holds.
    Reading it back is inference from the registry, not a guess about the salon.

    Without this the Thimphu page listed 7 of the 8 Thimphu salons and silently dropped
    the one whose owner wrote a street instead of a town.
  */
  return address
    ? areasOf(place.slug).some((area) => addressNames(address, area))
    : false;
}

/** Every salon in `places` order — the list a place page renders. */
export function salonsIn<T extends Pick<Business, "addressText" | "lat" | "lng">>(
  salons: readonly T[],
  place: Place,
): T[] {
  return salons.filter((s) => isIn(s, place));
}

/**
 * The best single place for a salon, for a breadcrumb or a card's location line.
 *
 * Returns the narrowest confident answer: the neighbourhood when the address names one,
 * otherwise the town, otherwise `null`. **`null` is a real answer and is rendered as
 * "Bhutan"** — an unplaceable salon gets the country rather than a guess, which is the
 * same rule `discover.tsx` already applies to its own location header after it was caught
 * telling a viewer in Thimphu they were in Paro.
 */
export function placeOf(
  business: Pick<Business, "addressText" | "lat" | "lng">,
): { town: Place | null; area: Place | null } {
  const matchedTown = PLACES.find((p) => p.kind === "dzongkhag" && isIn(business, p)) ?? null;
  const area =
    PLACES.find(
      (p) =>
        p.kind === "area" &&
        (!matchedTown || p.parent === matchedTown.slug) &&
        isIn(business, p),
    ) ?? null;

  // The neighbourhood knows its own town, so a salon that named only a street still gets
  // one. Same inference as the last branch of `isIn`, and the same live case.
  const town = matchedTown ?? (area?.parent ? placeBySlug(area.parent) : null);
  return { town, area };
}

/**
 * The town a **point** falls in, or `null` when it falls outside every box.
 *
 * This is {@link placeOf}'s coordinate pass with no salon attached, and its caller is the
 * viewer rather than a business: Discover's location line uses it to name where a GPS fix
 * actually is instead of saying "Near you" — see `LocationHeader` in
 * `components/customer/discover.tsx`.
 *
 * Three properties it has to keep:
 *
 * - **Town-level, and no finer.** Only a `dzongkhag` carries a `bbox`, so a fix can resolve
 *   to Thimphu and never to Norzin Lam. A neighbourhood is matched by owner-typed text
 *   everywhere else in this module, and there is no such text for a viewer — drawing
 *   neighbourhood boxes to fill the gap would be inventing boundaries this repo does not
 *   have, and the wrong street is a worse answer than the right town.
 * - **`null` is a real answer**, not a failure. Bhutan is mostly not inside one of these
 *   boxes: a fix in the Punakha valley 40 km from Thimphu matches nothing, and the caller
 *   renders "Near you" — which is still true, because the distances below it are measured
 *   from that fix.
 * - **Registry order breaks an overlap.** Phuentsholing's box sits inside Chukha's and is
 *   listed first, so a fix on the border town resolves to the town somebody would name
 *   rather than to the dzongkhag containing it.
 *
 * It stays coordinate-only for the reason in this module's header: `businesses.city` is
 * wrong on 7 of 10 live rows, and a location line that reported Paro to a viewer standing on
 * Norzin Lam is the bug this whole module was written after.
 */
export function placeAt(coords: Coords): Place | null {
  return (
    PLACES.find(
      (p) => p.kind === "dzongkhag" && p.bbox && inBox(coords.lat, coords.lng, p.bbox),
    ) ?? null
  );
}

/**
 * The places that have at least one salon — the only ones that may be indexed.
 *
 * This is the whole safety mechanism. Everything else in the registry is a name waiting
 * for inventory; this function is what decides whether a name has become a page. Callers
 * use it for the sitemap and for `robots`, so the two can never disagree about which
 * places are real.
 */
export function publishedPlaces<T extends Pick<Business, "addressText" | "lat" | "lng">>(
  salons: readonly T[],
): { place: Place; count: number }[] {
  return PLACES.map((place) => ({ place, count: salonsIn(salons, place).length }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count || a.place.name.localeCompare(b.place.name));
}
