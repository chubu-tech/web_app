import { describe, expect, it } from "vitest";
import { jsonLdScript, salonSchema, stylistSchema } from "./seo";
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

const service = (price: number): ServiceItem =>
  ({ id: `s${price}`, name: "Cut", price, durationMinutes: 30 }) as ServiceItem;

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
});
