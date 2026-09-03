import { describe, expect, it } from "vitest";
import { LAUNCHER_LIFT, launcherLift } from "./placement";

const lift = (pathname: string, opts: { cartVisible?: boolean; wide?: boolean } = {}) =>
  launcherLift({ pathname, ...opts });

describe("launcherLift", () => {
  it("sits in the corner on an ordinary route", () => {
    expect(lift("/discover")).toBe(LAUNCHER_LIFT.base);
    expect(lift("/bookings")).toBe(LAUNCHER_LIFT.base);
    expect(lift("/business")).toBe(LAUNCHER_LIFT.base);
    expect(lift("/")).toBe(LAUNCHER_LIFT.base);
  });

  describe("/map", () => {
    it("draws nothing — OSM's required attribution owns that corner", () => {
      expect(lift("/map")).toBeNull();
    });

    it("matches exactly, so a neighbouring route does not inherit the refusal", () => {
      expect(lift("/maps")).toBe(LAUNCHER_LIFT.base);
      expect(lift("/map/nearby")).toBe(LAUNCHER_LIFT.base);
    });
  });

  describe("the cart bar", () => {
    it("lifts clear when something is in the cart", () => {
      expect(lift("/discover", { cartVisible: true })).toBe(LAUNCHER_LIFT.cart);
    });

    it("does not lift when the cart is empty", () => {
      expect(lift("/discover", { cartVisible: false })).toBe(LAUNCHER_LIFT.base);
    });
  });

  describe("CTA footers", () => {
    it("clears the salon page's Book bar below desktop", () => {
      expect(lift("/salon/abc")).toBe(LAUNCHER_LIFT.cta);
    });

    it("clears the booking wizard's summary bar below desktop", () => {
      expect(lift("/salon/abc/book")).toBe(LAUNCHER_LIFT.cta);
    });

    it("does NOT lift for those two at desktop — the footers are desktop:hidden", () => {
      expect(lift("/salon/abc", { wide: true })).toBe(LAUNCHER_LIFT.base);
      expect(lift("/salon/abc/book", { wide: true })).toBe(LAUNCHER_LIFT.base);
    });

    it("clears the reschedule footer at every width — it is not desktop:hidden", () => {
      expect(lift("/bookings/abc/reschedule")).toBe(LAUNCHER_LIFT.cta);
      expect(lift("/bookings/abc/reschedule", { wide: true })).toBe(LAUNCHER_LIFT.cta);
    });

    it("clears the owner walk-in footer at every width", () => {
      expect(lift("/business/walk-in")).toBe(LAUNCHER_LIFT.cta);
      expect(lift("/business/walk-in", { wide: true })).toBe(LAUNCHER_LIFT.cta);
    });

    it("does not confuse /salons with /salon/<id>", () => {
      expect(lift("/salons")).toBe(LAUNCHER_LIFT.base);
      expect(lift("/salons", { wide: true })).toBe(LAUNCHER_LIFT.base);
    });

    it("does not lift on a booking detail, which has no pinned CTA", () => {
      expect(lift("/bookings/abc")).toBe(LAUNCHER_LIFT.base);
    });
  });

  describe("the chat composer", () => {
    it("clears it on a customer thread", () => {
      expect(lift("/messages/abc")).toBe(LAUNCHER_LIFT.composer);
    });

    it("clears it on an owner thread", () => {
      expect(lift("/business/messages/abc")).toBe(LAUNCHER_LIFT.composer);
    });

    it("does not lift on the inbox itself", () => {
      expect(lift("/messages")).toBe(LAUNCHER_LIFT.base);
      expect(lift("/business/messages")).toBe(LAUNCHER_LIFT.base);
    });
  });

  describe("when two lanes are occupied", () => {
    it("takes the taller — a salon page can show a Book bar AND a cart bar", () => {
      expect(lift("/salon/abc", { cartVisible: true })).toBe(LAUNCHER_LIFT.cta);
    });

    it("falls back to the cart when the CTA is gone at desktop", () => {
      expect(lift("/salon/abc", { cartVisible: true, wide: true })).toBe(
        LAUNCHER_LIFT.cart,
      );
    });
  });

  it("tolerates a trailing slash", () => {
    expect(lift("/map/")).toBeNull();
    expect(lift("/salon/abc/")).toBe(LAUNCHER_LIFT.cta);
  });
});
