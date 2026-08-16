import { describe, expect, it } from "vitest";
import {
  breadcrumbSchema,
  faqSchema,
  jsonLdScript,
  salonListSchema,
  salonSchema,
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
