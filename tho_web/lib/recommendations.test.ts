import { describe, expect, it } from "vitest";
import {
  availabilityScoreFromHours,
  distanceScore,
  historyScore,
  kmBetween,
  rank,
  reviewScore,
  visitCount,
} from "./recommendations";
import { thimphuDayOf, thimphuWeekday } from "./time";
import type { Booking, BookingStatus, WorkingHour } from "./types/booking";
import type { Business } from "./types/salon";

/**
 * A port of `tho/app/test/recommendations_test.dart`.
 *
 * One difference in the fixtures, for a reason: the Dart tests build `now` as a
 * *local* `DateTime` and derive the weekday from it, which is fine on a phone in
 * Bhutan. Our `availabilityScoreFromHours` compares in Thimphu time, so `now`
 * here is an explicit UTC instant that lands at 10:00 Thimphu, and the weekday is
 * derived through the same helpers the implementation uses. Same assertions, no
 * dependence on where the test runner happens to be.
 */

// Around Thimphu.
const CENTER = { lat: 27.4728, lng: 89.639 };

/** 2026-07-22 10:00 Thimphu === 04:00 UTC. */
const NOW = new Date("2026-07-22T04:00:00.000Z");
const DOW = thimphuWeekday(thimphuDayOf(NOW));

function biz(
  id: string,
  {
    name,
    lat,
    lng,
    rating,
    reviews = 0,
  }: {
    name?: string;
    lat?: number;
    lng?: number;
    rating?: number;
    reviews?: number;
  } = {},
): Business {
  return {
    id,
    name: name ?? `Salon ${id}`,
    description: null,
    addressText: null,
    phone: null,
    coverUrl: null,
    timezone: "Asia/Thimphu",
    cancellationWindowHours: 12,
    isActive: true,
    lat: lat ?? null,
    lng: lng ?? null,
    avgRating: rating ?? null,
    reviewCount: reviews,
    plan: "basic",
    businessType: "salon",
    serviceRadiusKm: null,
    whatsappPhone: null,
    queueEnabled: true,
    queueJoinMode: "anywhere",
    reminderChannel: "push",
    monthlyRevenueGoal: null,
    rebookingEnabled: false,
    rebookingDays: 30,
  };
}

const booking = (businessId: string, status: BookingStatus = "completed"): Booking => ({
  id: `bk-${businessId}-${status}`,
  status,
  startTs: new Date(Date.UTC(2026, 0, 1, 10)),
  endTs: new Date(Date.UTC(2026, 0, 1, 11)),
  totalPrice: 0,
  businessId,
});

const hours = (dayOfWeek: number, startTime: string, endTime: string): WorkingHour => ({
  id: `${dayOfWeek}-${startTime}`,
  dayOfWeek,
  startTime,
  endTime,
});

describe("distanceScore", () => {
  it("nearer salon scores higher than a far one; decays with km", () => {
    const near = kmBetween(biz("a", { lat: 27.4741, lng: 89.6377 }), CENTER); // ~1 km
    const far = kmBetween(biz("b", { lat: 27.4305, lng: 89.4164 }), CENTER); // ~22 km (Paro)
    expect(distanceScore(near)).toBeGreaterThan(distanceScore(far));
  });

  it("unknown distance (no location / no user fix) is neutral 0.5", () => {
    expect(distanceScore(null)).toBe(0.5);
    expect(kmBetween(biz("x"), CENTER)).toBeNull();
    expect(kmBetween(biz("y", { lat: 27.47, lng: 89.63 }), null)).toBeNull();
  });
});

describe("reviewScore (Bayesian)", () => {
  it("many solid reviews outrank a single perfect one", () => {
    const wellReviewed = reviewScore(biz("a", { rating: 4.6, reviews: 50 }), 4.0);
    const oneFiveStar = reviewScore(biz("b", { rating: 5.0, reviews: 1 }), 4.0);
    expect(wellReviewed).toBeGreaterThan(oneFiveStar);
  });

  it("unrated salon collapses to the global mean", () => {
    expect(reviewScore(biz("a"), 4.0)).toBeCloseTo((4.0 - 1) / 4, 9); // 0.75
  });
});

describe("availabilityScoreFromHours", () => {
  it("open right now scores 1.0", () => {
    expect(availabilityScoreFromHours([hours(DOW, "09:00:00", "18:00:00")], NOW)).toBe(1.0);
  });

  it("opens later today scores 0.7", () => {
    expect(availabilityScoreFromHours([hours(DOW, "14:00:00", "18:00:00")], NOW)).toBe(0.7);
  });

  it("closed today but open another day scores 0.35", () => {
    expect(
      availabilityScoreFromHours([hours((DOW + 1) % 7, "09:00:00", "18:00:00")], NOW),
    ).toBe(0.35);
  });

  it("no hours on record is neutral 0.5", () => {
    expect(availabilityScoreFromHours([], NOW)).toBe(0.5);
  });

  it("tiers are strictly ordered", () => {
    const openNow = availabilityScoreFromHours([hours(DOW, "09:00:00", "18:00:00")], NOW);
    const later = availabilityScoreFromHours([hours(DOW, "14:00:00", "18:00:00")], NOW);
    const closed = availabilityScoreFromHours(
      [hours((DOW + 1) % 7, "09:00:00", "18:00:00")],
      NOW,
    );
    expect(openNow).toBeGreaterThan(later);
    expect(later).toBeGreaterThan(closed);
  });

  it("is judged in Thimphu time, not the viewer's timezone", () => {
    // 23:00 UTC is already 05:00 the next day in Thimphu, so a salon open
    // 09:00-18:00 is closed — and a naive local-time port would disagree
    // depending on where the browser is.
    const lateUtc = new Date("2026-07-22T23:00:00.000Z");
    const thimphuDow = thimphuWeekday(thimphuDayOf(lateUtc));
    expect(
      availabilityScoreFromHours([hours(thimphuDow, "09:00:00", "18:00:00")], lateUtc),
    ).toBe(0.7); // opens later that Thimphu day
  });
});

describe("historyScore", () => {
  const catsByBiz: Record<string, Set<string>> = {
    a: new Set(["hair", "spa"]),
    b: new Set(["hair"]),
    c: new Set(["nails"]),
  };

  it("previously visited salon scores above an unseen one", () => {
    const history = [booking("a"), booking("a")];
    const visited = historyScore(biz("a"), {
      history,
      favoriteIds: new Set(),
      categoriesByBusiness: catsByBiz,
    });
    const unseen = historyScore(biz("c"), {
      history,
      favoriteIds: new Set(),
      categoriesByBusiness: catsByBiz,
    });
    expect(visited).toBeGreaterThan(unseen);
  });

  it("favouriting boosts the score", () => {
    expect(
      historyScore(biz("b"), {
        history: [],
        favoriteIds: new Set(["b"]),
        categoriesByBusiness: catsByBiz,
      }),
    ).toBeGreaterThan(0);
  });

  it("category affinity rewards salons sharing the user's booked categories", () => {
    // User books salon 'a' (hair, spa). Salon 'b' (hair) shares a category;
    // salon 'c' (nails) shares none.
    const history = [booking("a")];
    const shares = historyScore(biz("b"), {
      history,
      favoriteIds: new Set(),
      categoriesByBusiness: catsByBiz,
    });
    const none = historyScore(biz("c"), {
      history,
      favoriteIds: new Set(),
      categoriesByBusiness: catsByBiz,
    });
    expect(shares).toBeGreaterThan(none);
    expect(none).toBe(0);
  });

  it("cold start: no history and no favourites is 0 for everyone", () => {
    expect(
      historyScore(biz("a"), {
        history: [],
        favoriteIds: new Set(),
        categoriesByBusiness: catsByBiz,
      }),
    ).toBe(0);
  });

  it("cancelled bookings do not count as visits", () => {
    expect(visitCount(biz("a"), [booking("a", "cancelled")])).toBe(0);
    expect(visitCount(biz("a"), [booking("a", "no_show")])).toBe(0);
    expect(visitCount(biz("a"), [booking("a")])).toBe(1);
  });
});

describe("rank", () => {
  it("ranks a near, open, well-reviewed, visited salon first", () => {
    const businesses = [
      biz("near", { lat: 27.4741, lng: 89.6377, rating: 4.7, reviews: 40 }),
      biz("far", { lat: 27.4305, lng: 89.4164, rating: 4.9, reviews: 40 }),
      biz("mid", { lat: 27.4665, lng: 89.6421, rating: 4.2, reviews: 10 }),
    ];
    const ranked = rank({
      businesses,
      now: NOW,
      userLocation: CENTER,
      history: [booking("near")],
      hoursByBusiness: Object.fromEntries(
        businesses.map((b) => [b.id, [hours(DOW, "09:00:00", "18:00:00")]]),
      ),
    });
    expect(ranked[0].business.id).toBe("near");
    expect(ranked[0].reason).toBe("You've visited");
  });

  it("cold start ranks by distance + reviews + availability, deterministically", () => {
    const businesses = [
      biz("near", { lat: 27.4741, lng: 89.6377, rating: 4.5, reviews: 20 }),
      biz("far", { lat: 27.4305, lng: 89.4164, rating: 4.5, reviews: 20 }),
    ];
    const ranked = rank({
      businesses,
      now: NOW,
      userLocation: CENTER,
      hoursByBusiness: Object.fromEntries(
        businesses.map((b) => [b.id, [hours(DOW, "09:00:00", "18:00:00")]]),
      ),
    });
    // Equal ratings and availability → the nearer salon wins on distance.
    expect(ranked[0].business.id).toBe("near");
    // The history term contributes nothing for a brand-new user.
    expect(ranked.every((r) => r.historyScore === 0)).toBe(true);
  });

  it("scores are sorted descending", () => {
    const ranked = rank({
      businesses: [
        biz("a", { lat: 27.47, lng: 89.63, rating: 3.0, reviews: 5 }),
        biz("b", { lat: 27.48, lng: 89.64, rating: 5.0, reviews: 30 }),
        biz("c", { lat: 27.5, lng: 89.6, rating: 4.0, reviews: 12 }),
      ],
      now: NOW,
      userLocation: CENTER,
    });
    for (let i = 0; i + 1 < ranked.length; i++) {
      expect(ranked[i].score).toBeGreaterThanOrEqual(ranked[i + 1].score);
    }
  });

  it("ties break on name, so the order is deterministic", () => {
    const ranked = rank({
      businesses: [biz("z", { name: "Zeta" }), biz("a", { name: "Alpha" })],
      now: NOW,
    });
    expect(ranked.map((r) => r.business.name)).toEqual(["Alpha", "Zeta"]);
  });
});
