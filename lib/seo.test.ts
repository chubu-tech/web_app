import { describe, expect, it } from "vitest";
import {
  breadcrumbSchema,
  faqSchema,
  jsonLdScript,
  salonListSchema,
  salonSchema,
  sameAsBlock,
  SHARE_CARD,
  shareCard,
  stylistSchema,
} from "./seo";
import type { WorkingHour } from "./types/booking";
import type { Business, ServiceItem, StaffMember } from "./types/salon";

function salon(over: Partial<Business> = {}): Business {
  return {
    id: "b1",
    name: "Norzin Salon & Spa",
    description: "Full-service salon in the heart of Thimphu.",
    addressText: "Norzin Lam, Thimphu",
    phone: "+97512345678",
    coverUrl: "https://example.test/cover.jpg",
    timezone: "Asia/Thimphu",
    cancellationWindowHours: 4,
    isActive: true,
    lat: 27.47,
    lng: 89.63,
    avgRating: 4.5,
    reviewCount: 4,
    plan: "growth",
    businessType: "salon",
    serviceRadiusKm: null,
    whatsappPhone: null,
    queueEnabled: true,
    queueJoinMode: "anywhere",
    reminderChannel: "none",
    monthlyRevenueGoal: null,
    rebookingEnabled: false,
    rebookingDays: 42,
    ...over,
  } as Business;
}

const service = (price: number, name = "Cut"): ServiceItem =>
  ({ id: `s${price}`, name, price, durationMinutes: 30 }) as ServiceItem;

const hour = (dayOfWeek: number): WorkingHour => ({
  id: `h${dayOfWeek}`,
  dayOfWeek,
  startTime: "09:00:00",
  endTime: "18:30:00",
});

describe("jsonLdScript", () => {
  it("escapes `<` so a description cannot close the script tag", () => {
    const out = jsonLdScript({ d: "</script><img src=x onerror=alert(1)>" });
    expect(out).not.toContain("</script>");
    expect(out).toContain("\\u003c/script");
  });

  it("still parses back to the original string", () => {
    const value = "a < b </script>";
    expect(JSON.parse(jsonLdScript({ value })).value).toBe(value);
  });
});

describe("salonSchema", () => {
  const base = { hours: [], services: [] };

  it("is a HairSalon with a self @id matching its canonical", () => {
    const s = salonSchema({ business: salon(), ...base });
    expect(s["@type"]).toBe("HairSalon");
    expect(s["@id"]).toBe(s.url);
    expect(String(s.url)).toMatch(/\/salon\/b1$/);
  });

  // Google demotes rich results across a domain for a rating with nothing behind it,
  // and 4 of 13 live salons are unrated — so this is the normal path.
  it("omits aggregateRating entirely when unrated", () => {
    const s = salonSchema({
      business: salon({ reviewCount: 0, avgRating: null }),
      ...base,
    });
    expect(s).not.toHaveProperty("aggregateRating");
  });

  it("includes aggregateRating once there is a review", () => {
    const s = salonSchema({ business: salon(), ...base });
    expect(s.aggregateRating).toMatchObject({ ratingValue: 4.5, reviewCount: 4 });
  });

  it("publishes no address or coordinates for a travelling business", () => {
    for (const businessType of ["home_based", "mobile"] as const) {
      const s = salonSchema({ business: salon({ businessType }), ...base });
      expect(s, businessType).not.toHaveProperty("address");
      expect(s, businessType).not.toHaveProperty("geo");
    }
  });

  it("publishes both for a shopfront", () => {
    const s = salonSchema({ business: salon(), ...base });
    expect(s.address).toMatchObject({ streetAddress: "Norzin Lam, Thimphu", addressCountry: "BT" });
    expect(s.geo).toMatchObject({ latitude: 27.47, longitude: 89.63 });
  });

  it("maps day_of_week 0 to Sunday, not Monday", () => {
    const s = salonSchema({ business: salon(), hours: [hour(0)], services: [] });
    const spec = (s.openingHoursSpecification as Record<string, unknown>[])[0]!;
    expect(spec.dayOfWeek).toBe("https://schema.org/Sunday");
    // Seconds are trimmed: schema.org wants HH:MM.
    expect(spec.opens).toBe("09:00");
    expect(spec.closes).toBe("18:30");
  });

  it("states a price range from the live list, and one price when they match", () => {
    expect(
      salonSchema({ business: salon(), hours: [], services: [service(150), service(1200)] })
        .priceRange,
    ).toBe("Nu 150–Nu 1,200");
    expect(
      salonSchema({ business: salon(), hours: [], services: [service(150)] }).priceRange,
    ).toBe("Nu 150");
  });

  it("omits priceRange rather than inventing one when nothing is priced", () => {
    const s = salonSchema({ business: salon(), hours: [], services: [] });
    expect(s).not.toHaveProperty("priceRange");
    expect(s).not.toHaveProperty("currenciesAccepted");
  });

  it("omits optional fields that are null rather than emitting nulls", () => {
    const s = salonSchema({
      business: salon({ description: null, coverUrl: null, phone: null }),
      ...base,
    });
    for (const key of ["description", "image", "telephone"]) {
      expect(s, key).not.toHaveProperty(key);
    }
  });

  describe("locality", () => {
    it("names the town from the address, never from `businesses.city`", () => {
      const s = salonSchema({ business: salon(), ...base });
      expect(s.address).toMatchObject({ addressLocality: "Thimphu" });
      expect(s.areaServed).toMatchObject({ "@type": "City", name: "Thimphu" });
    });

    it("trusts the coordinates when the address text disagrees with them", () => {
      // The live shape of `Paro Glow Beauty Lounge`: pin in the Paro valley.
      const s = salonSchema({
        business: salon({ addressText: "Tshongdue, Paro", lat: 27.4305, lng: 89.4164 }),
        ...base,
      });
      expect(s.address).toMatchObject({ addressLocality: "Paro" });
    });

    it("omits the locality rather than guessing one", () => {
      const s = salonSchema({
        business: salon({ addressText: "behind the shop", lat: null, lng: null }),
        ...base,
      });
      expect(s.address).not.toHaveProperty("addressLocality");
      expect(s).not.toHaveProperty("areaServed");
      // The street line is still true and is still published.
      expect(s.address).toMatchObject({ streetAddress: "behind the shop" });
    });

    it("publishes no locality for a travelling business either", () => {
      const s = salonSchema({ business: salon({ businessType: "mobile" }), ...base });
      expect(s).not.toHaveProperty("address");
      expect(s).not.toHaveProperty("areaServed");
    });
  });

  describe("hasOfferCatalog", () => {
    it("prices each service in BTN, the ISO code — not 'Nu'", () => {
      const s = salonSchema({
        business: salon(),
        hours: [],
        services: [service(150, "Beard Trim"), service(1200, "Hair Colour")],
      });
      const catalog = s.hasOfferCatalog as Record<string, unknown>;
      const items = catalog.itemListElement as Record<string, unknown>[];
      expect(items).toHaveLength(2);
      expect(items[0]).toMatchObject({ price: 150, priceCurrency: "BTN" });
      expect(items[0].itemOffered).toMatchObject({
        "@type": "Service",
        name: "Beard Trim",
      });
    });

    it("joins each service to the salon by the salon's own @id", () => {
      const s = salonSchema({ business: salon(), hours: [], services: [service(150)] });
      const items = (s.hasOfferCatalog as Record<string, unknown>)
        .itemListElement as Record<string, unknown>[];
      const offered = items[0].itemOffered as Record<string, unknown>;
      expect((offered.provider as Record<string, unknown>)["@id"]).toBe(s["@id"]);
    });

    it("never asserts availability, because service_staff is narrower than the menu", () => {
      // Norzin lists five services and its stylists perform three; `InStock` on the other
      // two would advertise an appointment `create_booking` refuses.
      const s = salonSchema({ business: salon(), hours: [], services: [service(150)] });
      const items = (s.hasOfferCatalog as Record<string, unknown>)
        .itemListElement as Record<string, unknown>[];
      expect(items[0]).not.toHaveProperty("availability");
    });

    it("omits price on an unpriced service rather than publishing zero", () => {
      const s = salonSchema({ business: salon(), hours: [], services: [service(0)] });
      const items = (s.hasOfferCatalog as Record<string, unknown>)
        .itemListElement as Record<string, unknown>[];
      expect(items[0]).not.toHaveProperty("price");
    });

    it("is absent entirely when there are no services", () => {
      expect(salonSchema({ business: salon(), ...base })).not.toHaveProperty(
        "hasOfferCatalog",
      );
    });
  });

  it("states cash, the only payment model this product has", () => {
    expect(salonSchema({ business: salon(), ...base }).paymentAccepted).toBe("Cash");
  });
});

describe("stylistSchema", () => {
  const staff = {
    id: "st1",
    displayName: "Sonam Dorji",
    role: "Senior stylist",
    photoUrl: null,
  } as StaffMember;

  it("links to the salon by the same @id the salon page mints", () => {
    const s = stylistSchema({ staff, business: salon() });
    const worksFor = s.worksFor as Record<string, unknown>;
    const salonId = salonSchema({ business: salon(), hours: [], services: [] })["@id"];
    expect(worksFor["@id"]).toBe(salonId);
  });

  // `staff_follow_summary` counts followers, not ratings — putting that number in a
  // rating field would be a false claim in a field crawlers check.
  it("never carries a rating", () => {
    expect(stylistSchema({ staff, business: salon() })).not.toHaveProperty("aggregateRating");
  });

  it("never publishes the role column as a job title", () => {
    // `staff_members.role` is a permission flag whose only live values are `staff` and
    // `owner`. `jobTitle: "staff"` is a claim a crawler reads and a reader cannot use.
    const s = stylistSchema({ staff: { ...staff, role: "staff" } as StaffMember, business: salon() });
    expect(s.jobTitle).toBe("Hair Stylist");
  });

  it("lists what this stylist performs, joined to the salon", () => {
    const s = stylistSchema({
      staff,
      business: salon(),
      services: [service(150, "Beard Trim")],
    });
    const offers = s.makesOffer as Record<string, unknown>[];
    expect(offers).toHaveLength(1);
    expect(offers[0]).toMatchObject({ price: 150, priceCurrency: "BTN" });
    expect(offers[0].itemOffered).toMatchObject({ name: "Beard Trim" });
  });

  it("omits makesOffer when the stylist is mapped to nothing", () => {
    // Two of Norzin's five services are mapped to nobody; a stylist with no mappings is
    // the same shape and must not publish an empty list.
    expect(stylistSchema({ staff, business: salon() })).not.toHaveProperty("makesOffer");
  });
});

describe("breadcrumbSchema", () => {
  it("numbers from 1, because a 0-based list is rejected", () => {
    const b = breadcrumbSchema([
      { name: "Salons", path: "/salons" },
      { name: "Thimphu", path: "/salons/thimphu" },
    ]);
    const items = b.itemListElement as Record<string, unknown>[];
    expect(items.map((i) => i.position)).toEqual([1, 2]);
    expect(String(items[1].item)).toMatch(/\/salons\/thimphu$/);
  });
});

describe("salonListSchema", () => {
  const salons = [
    { id: "0b000000-0000-4000-8000-000000000001", name: "Norzin Salon & Spa" },
    { id: "0b000000-0000-4000-8000-000000000009", name: "Clock Tower Cuts" },
  ];

  it("counts the list and preserves its order", () => {
    const s = salonListSchema({
      name: "Salons in Thimphu",
      description: "d",
      path: "/salons/thimphu",
      salons,
    });
    const list = s.mainEntity as Record<string, unknown>;
    expect(list.numberOfItems).toBe(2);
    const items = list.itemListElement as Record<string, unknown>[];
    expect(items.map((i) => i.position)).toEqual([1, 2]);
  });

  it("addresses each salon by the same @id its own page mints", () => {
    // The join that makes a list page and a salon page one graph rather than two.
    const s = salonListSchema({ name: "n", description: "d", path: "/salons", salons });
    const items = (s.mainEntity as Record<string, unknown>)
      .itemListElement as Record<string, unknown>[];
    const item = items[0].item as Record<string, unknown>;
    const own = salonSchema({ business: salon(salons[0]), hours: [], services: [] });
    expect(item["@id"]).toBe(own["@id"]);
  });

  it("carries no address, hours or rating per item", () => {
    // Those live on the salon's own page. Three copies of one business's data is three
    // chances to be stale.
    const s = salonListSchema({ name: "n", description: "d", path: "/salons", salons });
    const items = (s.mainEntity as Record<string, unknown>)
      .itemListElement as Record<string, unknown>[];
    const item = items[0].item as Record<string, unknown>;
    for (const key of ["address", "openingHoursSpecification", "aggregateRating"]) {
      expect(item, key).not.toHaveProperty(key);
    }
  });

  it("is valid with an empty list", () => {
    const s = salonListSchema({ name: "n", description: "d", path: "/salons", salons: [] });
    expect((s.mainEntity as Record<string, unknown>).numberOfItems).toBe(0);
  });
});

describe("faqSchema", () => {
  it("carries the same words the page renders", () => {
    const items = [{ q: "Does it cost anything?", a: "No — never." }];
    const s = faqSchema(items, "/help");
    const entities = s.mainEntity as Record<string, unknown>[];
    expect(entities[0].name).toBe(items[0].q);
    expect((entities[0].acceptedAnswer as Record<string, unknown>).text).toBe(items[0].a);
  });
});

/*
  Next models `Metadata["openGraph"]` as a discriminated union that also admits `null`,
  so a test cannot read `type` or `images` off it without narrowing first. These two
  views are that narrowing, done once, so the assertions below stay about values rather
  than about TypeScript. The production return type is deliberately the `Metadata` one —
  that is what makes the nine `...shareCard(...)` spreads typecheck.
*/
type OgView = {
  type: string;
  siteName: string;
  locale: string;
  title: string;
  description: string;
  images: { url: string; width?: number; height?: number; alt?: string }[];
};

type TwView = {
  card: string;
  title: string;
  description: string;
  images: { url: string }[];
};

function view(args: Parameters<typeof shareCard>[0]) {
  const { openGraph, twitter } = shareCard(args);
  return {
    og: openGraph as unknown as OgView,
    tw: twitter as unknown as TwView,
  };
}

describe("sameAsBlock", () => {
  it("omits the key entirely when nothing is real", () => {
    const node = { "@type": "Organization", ...sameAsBlock(["", "  ", null, undefined]) };
    /*
      `"sameAs" in node`, not `toEqual({})`, and the distinction is the whole point of the
      test: `toEqual` ignores properties whose value is `undefined`, so `{ sameAs: undefined }`
      would satisfy it while still putting the key into the emitted JSON-LD. `in` is the
      assertion that actually pins the requirement.
    */
    expect("sameAs" in node).toBe(false);
  });

  it("keeps only the non-empty members, trimmed", () => {
    expect(
      sameAsBlock([
        "",
        " https://www.facebook.com/tho ",
        "",
        "https://apps.apple.com/bt/app/tho-bt/id6801982891",
      ]),
    ).toEqual({
      sameAs: [
        "https://www.facebook.com/tho",
        "https://apps.apple.com/bt/app/tho-bt/id6801982891",
      ],
    });
  });

  it("does not repeat a URL pasted twice", () => {
    expect(sameAsBlock(["https://x.test/tho", "https://x.test/tho"])).toEqual({
      sameAs: ["https://x.test/tho"],
    });
  });
});

describe("shareCard", () => {
  const copy = {
    title: "Norzin Salon — Salon in Thimphu",
    description: "Book a chair at Norzin Salon.",
    url: "/salon/norzin-b1",
  };

  it("always yields an image, even with none supplied", () => {
    /*
      This is the whole reason the helper exists. Nine pages exported an `openGraph`
      without `images` and lost the `opengraph-image.tsx` fallback to Next's shallow
      merge, so the homepage unfurled on WhatsApp with no picture at all. If this
      assertion ever fails, that bug is back.
    */
    const { og, tw } = view(copy);

    expect(og.images).toHaveLength(1);
    expect(tw.images).toHaveLength(1);
  });

  it("points the fallback image at the branded card, absolutely", () => {
    // Absolute, not a bare path: an unfurler has no origin to resolve one against.
    expect(view(copy).og.images[0].url).toMatch(/^https?:\/\/.+\/opengraph-image\?v=\d+$/);
  });

  it("carries the card's version in the image URL, so a redraw beats the platform caches", () => {
    /*
      Facebook, WhatsApp and LinkedIn cache a share image against its URL. Redrawing the
      card without moving the URL leaves every one of them unfurling the old pixels, which
      is exactly what happened when the card went from 1200×630 to 2×. Asserting the two
      are joined means bumping `SHARE_CARD.version` is the whole change.
    */
    expect(view(copy).og.images[0].url).toContain(`?v=${SHARE_CARD.version}`);
  });

  it("declares the dimensions the PNG actually has", () => {
    // `og:image:width`/`height` are what Facebook and WhatsApp crop against, so a card that
    // misreports its own size is a card with a headline sliced in half.
    const image = view(copy).og.images[0];
    expect(image.width).toBe(1200 * SHARE_CARD.scale);
    expect(image.height).toBe(630 * SHARE_CARD.scale);
  });

  it("declares the dimensions the card is actually rendered at", () => {
    // `app/opengraph-image.tsx` reads the same constant for its `size` export, so this
    // guards the pair rather than restating one half of it.
    const [image] = view(copy).og.images;

    expect(image.width).toBe(SHARE_CARD.width);
    expect(image.height).toBe(SHARE_CARD.height);
    // Facebook's documented large-format minimum, which X and LinkedIn also clear.
    expect(SHARE_CARD.width).toBeGreaterThanOrEqual(600);
    expect(SHARE_CARD.height).toBeGreaterThanOrEqual(315);
    // 1200×630 is 1.905:1 — the ratio everyone writes as "1.91:1". One decimal, because
    // asserting 1.91 to two would be asserting a number this card does not have.
    expect(SHARE_CARD.width / SHARE_CARD.height).toBeCloseTo(1.9, 1);
  });

  it("prefers a supplied photo over the branded card", () => {
    const cover = "https://cdn.test/norzin.jpg";
    const { og, tw } = view({ ...copy, images: [{ url: cover }] });

    expect(og.images).toEqual([{ url: cover }]);
    // Both blocks take the same picture — they cannot drift.
    expect(tw.images).toEqual(og.images);
  });

  it("treats an empty array as no photo", () => {
    // `coverUrl ? [...] : undefined` is the caller's shape, but a `.filter()` upstream
    // could hand this an empty array; that must fall back rather than emit `images: []`.
    expect(view({ ...copy, images: [] }).og.images[0].url).toContain(SHARE_CARD.path);
  });

  it("keeps the Twitter card copy identical to the Open Graph copy", () => {
    /*
      The second half of the original bug: no page declared a `twitter` block, so every
      route served the root layout's generic title to X — and to LinkedIn and Slack,
      which read `twitter:*` when they prefer it.
    */
    const { og, tw } = view(copy);

    expect(tw.title).toBe(og.title);
    expect(tw.description).toBe(og.description);
    expect(tw.card).toBe("summary_large_image");
  });

  it("carries site name and locale that a page override used to drop", () => {
    const { og } = view(copy);

    expect(og.siteName).toBe("THO");
    expect(og.locale).toBe("en_BT");
  });

  it("defaults to website and passes a profile through", () => {
    expect(view(copy).og.type).toBe("website");
    expect(view({ ...copy, type: "profile" }).og.type).toBe("profile");
  });
});
