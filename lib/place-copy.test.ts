import { describe, expect, it } from "vitest";
import { emptyPlaceCopy, placeCopy, placeLabel } from "./place-copy";
import { placeBySlug } from "./places";
import type { Business } from "./types/salon";

const thimphu = placeBySlug("thimphu")!;
const norzinLam = placeBySlug("norzin-lam")!;
const punakha = placeBySlug("punakha")!;

function salon(over: Partial<Business> = {}): Business {
  return {
    id: "b1",
    name: "Norzin Salon & Spa",
    description: null,
    addressText: "Norzin Lam, Thimphu",
    phone: null,
    coverUrl: null,
    timezone: "Asia/Thimphu",
    cancellationWindowHours: 4,
    isActive: true,
    lat: 27.47,
    lng: 89.63,
    avgRating: null,
    reviewCount: 0,
    // Basic does not include the walk-in queue, so this is the no-queue default.
    plan: "basic",
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

const base = { categoryNames: [], services: [] };

describe("placeLabel", () => {
  it("qualifies a neighbourhood with its town", () => {
    expect(placeLabel(norzinLam)).toBe("Norzin Lam, Thimphu");
  });

  it("leaves a town alone", () => {
    expect(placeLabel(thimphu)).toBe("Thimphu");
  });
});

describe("placeCopy", () => {
  it("names the place and the country in the title", () => {
    // An engine answering a geographic query cannot infer Bhutan from context it did not
    // retrieve, and "Thimphu" alone is ambiguous to anyone outside it.
    const copy = placeCopy({ place: thimphu, salons: [salon()], ...base });
    expect(copy.title).toContain("Thimphu");
    expect(copy.title).toContain("Bhutan");
    expect(copy.h1).toContain("Thimphu");
  });

  it("counts the salons it was given rather than asserting a number", () => {
    const copy = placeCopy({
      place: thimphu,
      salons: [salon(), salon({ id: "b2" }), salon({ id: "b3" })],
      ...base,
    });
    expect(copy.intro).toContain("3 salons");
  });

  it("uses the singular throughout for one salon", () => {
    const copy = placeCopy({ place: thimphu, salons: [salon()], ...base });
    expect(copy.intro).toContain("1 salon and barbershop");
    expect(copy.intro).not.toContain("salons");
  });

  describe("the walk-in queue answer", () => {
    // `runsQueue` is `queueEnabled && hasFeature(plan, "walkInQueue")`, and the queue is
    // Growth-and-above — so on live data exactly one of Thimphu's eight salons qualifies.
    const withQueue = salon({ id: "q1", plan: "growth" });

    it("agrees subject with verb when only one salon runs a queue", () => {
      // This is the live case, and the first draft rendered "1 of the 8 salons … run".
      const copy = placeCopy({
        place: thimphu,
        salons: [withQueue, salon({ id: "b2" }), salon({ id: "b3" })],
        ...base,
      });
      const answer = copy.faq.find((f) => f.q.includes("walk-in queue"))!.a;
      expect(answer).toContain("1 of the 3 salons in Thimphu on THO runs");
      expect(answer).not.toContain("salons in Thimphu on THO run a");
    });

    it("uses the plural verb when several do", () => {
      const copy = placeCopy({
        place: thimphu,
        salons: [withQueue, salon({ id: "q2", plan: "growth" }), salon({ id: "b3" })],
        ...base,
      });
      const answer = copy.faq.find((f) => f.q.includes("walk-in queue"))!.a;
      expect(answer).toContain("2 of the 3 salons in Thimphu on THO run a");
    });

    it("drops the count when every salon runs one", () => {
      const copy = placeCopy({ place: thimphu, salons: [withQueue], ...base });
      const answer = copy.faq.find((f) => f.q.includes("walk-in queue"))!.a;
      expect(answer).toContain("The salon in Thimphu on THO runs a live walk-in queue");
    });

    it("asks nothing about walk-ins when no salon there offers one", () => {
      // A Basic salon's customers are refused by `join_queue`, so claiming otherwise
      // would advertise something the server declines.
      const copy = placeCopy({ place: thimphu, salons: [salon()], ...base });
      expect(copy.faq.some((f) => f.q.includes("walk-in queue"))).toBe(false);
    });
  });

  describe("the price answer", () => {
    it("states the floor from the services it was given", () => {
      const copy = placeCopy({
        place: thimphu,
        salons: [salon()],
        categoryNames: [],
        services: [{ price: 1200 }, { price: 120 }, { price: 350 }],
      });
      const answer = copy.faq.find((f) => f.q.includes("How much"))!.a;
      expect(answer).toContain("from Nu 120");
    });

    it("makes no price claim when nothing is priced", () => {
      const copy = placeCopy({ place: thimphu, salons: [salon()], ...base });
      const answer = copy.faq.find((f) => f.q.includes("How much"))!.a;
      expect(answer).not.toContain("from Nu");
      expect(answer).toContain("set by each salon");
    });

    it("ignores a zero price rather than claiming free haircuts", () => {
      const copy = placeCopy({
        place: thimphu,
        salons: [salon()],
        categoryNames: [],
        services: [{ price: 0 }, { price: 250 }],
      });
      expect(copy.faq.find((f) => f.q.includes("How much"))!.a).toContain("from Nu 250");
    });
  });

  describe("the best-rated answer", () => {
    it("names the highest-rated salon and its real figures", () => {
      const copy = placeCopy({
        place: thimphu,
        salons: [
          salon({ id: "a", name: "Lotus Spa", avgRating: 4.8, reviewCount: 4 }),
          salon({ id: "b", name: "Menjong", avgRating: 4.0, reviewCount: 2 }),
        ],
        ...base,
      });
      const answer = copy.faq.find((f) => f.q.includes("best-rated"))!.a;
      expect(answer).toContain("Lotus Spa");
      expect(answer).toContain("4.8 out of 5");
      expect(answer).toContain("4 reviews");
    });

    it("says nothing about ratings when nothing is rated", () => {
      // 4 of the live salons have no reviews; an unrated place must not claim a best.
      const copy = placeCopy({ place: thimphu, salons: [salon()], ...base });
      expect(copy.faq.some((f) => f.q.includes("best-rated"))).toBe(false);
    });

    it("uses the singular for one review", () => {
      const copy = placeCopy({
        place: thimphu,
        salons: [salon({ avgRating: 5, reviewCount: 1 })],
        ...base,
      });
      expect(copy.faq.find((f) => f.q.includes("best-rated"))!.a).toContain("1 review");
    });
  });

  it("never asks which areas have salons for a neighbourhood page", () => {
    // A street has no sub-areas; the question only makes sense on a town.
    const copy = placeCopy({ place: norzinLam, salons: [salon()], ...base });
    expect(copy.faq.some((f) => f.q.includes("Which parts"))).toBe(false);
  });
});

describe("emptyPlaceCopy", () => {
  it("says plainly that nothing is there, and claims nothing else", () => {
    const copy = emptyPlaceCopy(punakha);
    expect(copy.h1).toContain("Punakha");
    expect(copy.description).toContain("No salons in Punakha");
    // No fabricated FAQ — there is no inventory to answer questions about, and an
    // `FAQPage` here would be a quotable claim about a town with no salons in it.
    expect(copy.faq).toEqual([]);
  });
});
