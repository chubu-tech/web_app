import { describe, expect, it } from "vitest";
import { THIMPHU_CENTER } from "./geo";
import {
  areasOf,
  isIn,
  PLACES,
  placeAt,
  placeBySlug,
  placeOf,
  publishedPlaces,
  salonsIn,
  townOf,
} from "./places";

/**
 * The ten salons an anonymous visitor can see, read off the live database on 2026-08-16.
 *
 * These are fixtures rather than invented cases on purpose: seven of the ten have a
 * `city` that contradicts their address, and that contradiction is the entire reason
 * `lib/places.ts` exists. A test built on tidy made-up rows would pass against a
 * `city`-based implementation too, and prove nothing.
 */
const LIVE = [
  { name: "Clock Tower Cuts", addressText: "Clock Tower Square, Thimphu", lat: 27.4741, lng: 89.6377 },
  { name: "Druk Barber House", addressText: "Wogzin Lam, Thimphu", lat: 27.4715, lng: 89.6353 },
  { name: "Druk Beauty Lounge", addressText: "Norzin Lam, above Sonam Trophel", lat: null, lng: null },
  { name: "Kira Nails & Beauty", addressText: "Hogdzin Lam, Thimphu", lat: 27.4801, lng: 89.6367 },
  { name: "Lotus Spa & Wellness", addressText: "Doebum Lam, Thimphu", lat: 27.4665, lng: 89.6421 },
  { name: "Menjong Gents Grooming", addressText: "Phendey Lam, Thimphu", lat: 27.4849, lng: 89.644 },
  { name: "Norzin Salon & Spa", addressText: "Norzin Lam, Thimphu", lat: 27.4728, lng: 89.6386 },
  { name: "Paro Glow Beauty Lounge", addressText: "Tshongdue, Paro", lat: 27.4305, lng: 89.4164 },
  { name: "Serenity Day Spa", addressText: "Zhung Lam, Phuentsholing", lat: 26.8516, lng: 89.3884 },
  { name: "Zhiwa Ling Hair Studio", addressText: "Chang Lam, Thimphu", lat: 27.4772, lng: 89.6398 },
];

const thimphu = placeBySlug("thimphu")!;
const paro = placeBySlug("paro")!;
const phuentsholing = placeBySlug("phuentsholing")!;

describe("the registry itself", () => {
  it("has unique slugs", () => {
    const slugs = PLACES.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("gives every area a parent that exists", () => {
    for (const area of PLACES.filter((p) => p.kind === "area")) {
      expect(area.parent, `${area.slug} has no parent`).toBeDefined();
      expect(placeBySlug(area.parent!), `${area.parent} is not a place`).not.toBeNull();
    }
  });

  it("gives every dzongkhag a bounding box", () => {
    for (const town of PLACES.filter((p) => p.kind === "dzongkhag")) {
      expect(town.bbox, `${town.slug} has no bbox`).toBeDefined();
    }
  });

  it("draws every box south-west to north-east", () => {
    for (const town of PLACES.filter((p) => p.bbox)) {
      const [south, west, north, east] = town.bbox!;
      expect(north, town.slug).toBeGreaterThan(south);
      expect(east, town.slug).toBeGreaterThan(west);
    }
  });

  it("keeps every box inside Bhutan", () => {
    // Bhutan spans roughly 26.7–28.4 N, 88.7–92.2 E. A box outside it is a typo that
    // would quietly file a salon in the wrong country.
    for (const town of PLACES.filter((p) => p.bbox)) {
      const [south, west, north, east] = town.bbox!;
      expect(south, town.slug).toBeGreaterThanOrEqual(26.6);
      expect(north, town.slug).toBeLessThanOrEqual(28.5);
      expect(west, town.slug).toBeGreaterThanOrEqual(88.6);
      expect(east, town.slug).toBeLessThanOrEqual(92.3);
    }
  });
});

describe("placing the live salons", () => {
  it("puts all eight Thimphu salons in Thimphu", () => {
    const found = salonsIn(LIVE, thimphu).map((s) => s.name);
    expect(found).toHaveLength(8);
    expect(found).toContain("Norzin Salon & Spa");
    // The one with no coordinates whose address names only a street.
    expect(found).toContain("Druk Beauty Lounge");
  });

  it("does not put a Thimphu salon in Paro, whatever `city` says", () => {
    // `Norzin Salon & Spa`, `Clock Tower Cuts` and `Menjong Gents Grooming` are all
    // filed under Paro in `businesses.city`. This is the regression that matters.
    const paroNames = salonsIn(LIVE, paro).map((s) => s.name);
    expect(paroNames).toEqual(["Paro Glow Beauty Lounge"]);
  });

  it("does not put a Thimphu salon in Phuentsholing, whatever `city` says", () => {
    // `Kira Nails & Beauty` and `Lotus Spa & Wellness` are filed under Phuentsholing.
    const names = salonsIn(LIVE, phuentsholing).map((s) => s.name);
    expect(names).toEqual(["Serenity Day Spa"]);
  });

  it("trusts coordinates over the town written in the address", () => {
    // `Paro Glow Beauty Lounge` is `city: "Thimphu"`; its pin is in the Paro valley.
    const glow = LIVE.find((s) => s.name === "Paro Glow Beauty Lounge")!;
    expect(isIn(glow, paro)).toBe(true);
    expect(isIn(glow, thimphu)).toBe(false);
  });

  it("accounts for every live salon exactly once across the three towns", () => {
    const total =
      salonsIn(LIVE, thimphu).length +
      salonsIn(LIVE, paro).length +
      salonsIn(LIVE, phuentsholing).length;
    expect(total).toBe(LIVE.length);
  });
});

describe("neighbourhoods", () => {
  it("matches a street from the address text", () => {
    const norzinLam = placeBySlug("norzin-lam")!;
    expect(salonsIn(LIVE, norzinLam).map((s) => s.name)).toEqual([
      "Druk Beauty Lounge",
      "Norzin Salon & Spa",
    ]);
  });

  it("matches on a word boundary, not a substring", () => {
    // "Taba" inside "Batabari" is the trap. A substring test files a salon in the wrong
    // neighbourhood, which is exactly the class of error this module exists to prevent.
    const taba = placeBySlug("taba")!;
    expect(isIn({ addressText: "Batabari Road", lat: null, lng: null }, taba)).toBe(false);
    expect(isIn({ addressText: "Taba, Thimphu", lat: null, lng: null }, taba)).toBe(true);
  });

  it("does not place a salon in a neighbourhood on coordinates alone", () => {
    // A map pin is not accurate enough to name a street, so an area needs the words.
    const norzinLam = placeBySlug("norzin-lam")!;
    expect(isIn({ addressText: null, lat: 27.4728, lng: 89.6386 }, norzinLam)).toBe(false);
  });

  it("lists a town's registered areas", () => {
    const areas = areasOf("thimphu");
    expect(areas.length).toBeGreaterThan(5);
    expect(areas.every((a) => a.parent === "thimphu")).toBe(true);
  });

  it("resolves an area up to its town", () => {
    expect(townOf(placeBySlug("babesa")!).slug).toBe("thimphu");
    expect(townOf(thimphu).slug).toBe("thimphu");
  });
});

describe("placeOf", () => {
  it("returns the narrowest confident answer", () => {
    const norzin = LIVE.find((s) => s.name === "Norzin Salon & Spa")!;
    const { town, area } = placeOf(norzin);
    expect(town?.slug).toBe("thimphu");
    expect(area?.slug).toBe("norzin-lam");
  });

  it("infers the town from the area when the address names only a street", () => {
    const lounge = LIVE.find((s) => s.name === "Druk Beauty Lounge")!;
    const { town, area } = placeOf(lounge);
    expect(area?.slug).toBe("norzin-lam");
    expect(town?.slug).toBe("thimphu");
  });

  it("returns a town and no area when the street is not registered", () => {
    const glow = LIVE.find((s) => s.name === "Paro Glow Beauty Lounge")!;
    const { town, area } = placeOf(glow);
    expect(town?.slug).toBe("paro");
    expect(area).toBeNull();
  });

  it("returns nulls rather than guessing for an unplaceable salon", () => {
    // Rendered as "Bhutan". A wrong town is worse than the country.
    expect(placeOf({ addressText: null, lat: null, lng: null })).toEqual({
      town: null,
      area: null,
    });
    expect(placeOf({ addressText: "behind the shop", lat: null, lng: null }).town).toBeNull();
  });
});

describe("placeAt — naming where the viewer is", () => {
  it("names the town a fix is standing in", () => {
    // Discover's location line renders these as "Thimphu, Bhutan" / "Paro, Bhutan".
    const norzin = LIVE.find((s) => s.name === "Norzin Salon & Spa")!;
    const glow = LIVE.find((s) => s.name === "Paro Glow Beauty Lounge")!;
    expect(placeAt({ lat: norzin.lat!, lng: norzin.lng! })?.slug).toBe("thimphu");
    expect(placeAt({ lat: glow.lat!, lng: glow.lng! })?.slug).toBe("paro");
  });

  it("names the border town rather than the dzongkhag containing it", () => {
    // Phuentsholing's box sits inside Chukha's, and registry order is what decides.
    // A person on the border names the town, not the dzongkhag.
    const serenity = LIVE.find((s) => s.name === "Serenity Day Spa")!;
    expect(placeAt({ lat: serenity.lat!, lng: serenity.lng! })?.slug).toBe("phuentsholing");
  });

  it("agrees with the copy the fallback branch hardcodes", () => {
    // `LocationHeader` writes "Thimphu, Bhutan" literally for a fallback fix, and derives
    // the same words from the registry for a real one. This is what stops an edit to
    // Thimphu's box making the two branches disagree about the same coordinates.
    expect(placeAt(THIMPHU_CENTER)?.name).toBe("Thimphu");
  });

  it("returns null for a fix between towns, which reads as 'Near you'", () => {
    // ~40 km from Thimphu, so `plausibleFix` keeps it — most of Bhutan is not in a box,
    // and "Near you" is still exactly true there.
    expect(placeAt({ lat: 27.2, lng: 89.9 })).toBeNull();
  });

  it("returns null for a fix outside Bhutan", () => {
    // Unreachable through `resolveLocation`, which replaces an implausible fix with the
    // Thimphu centre — but this function must not name a town for London regardless.
    expect(placeAt({ lat: 51.5074, lng: -0.1278 })).toBeNull();
  });
});

describe("publishedPlaces — the doorway-page guard", () => {
  const published = publishedPlaces(LIVE);
  const slugs = published.map((p) => p.place.slug);

  it("publishes only places that hold a salon", () => {
    expect(published.every((p) => p.count > 0)).toBe(true);
  });

  it("publishes far fewer places than are registered", () => {
    // The registry names 20 dzongkhags and 18 areas. Publishing all of them on this
    // inventory is the doorway-page pattern; this assertion is the guard against a
    // future change quietly turning that on.
    expect(published.length).toBeLessThan(PLACES.length / 2);
  });

  it("does not publish a dzongkhag with no salons", () => {
    expect(slugs).not.toContain("punakha");
    expect(slugs).not.toContain("bumthang");
    expect(slugs).not.toContain("trashigang");
  });

  it("does not publish a registered Thimphu area with no salons", () => {
    expect(slugs).not.toContain("motithang");
    expect(slugs).not.toContain("babesa");
  });

  it("publishes the three real towns", () => {
    expect(slugs).toContain("thimphu");
    expect(slugs).toContain("paro");
    expect(slugs).toContain("phuentsholing");
  });

  it("orders by salon count, busiest first", () => {
    expect(published[0].place.slug).toBe("thimphu");
    expect(published[0].count).toBe(8);
  });

  it("publishes nothing at all when there are no salons", () => {
    // A failed read must not publish 38 empty pages.
    expect(publishedPlaces([])).toEqual([]);
  });
});
