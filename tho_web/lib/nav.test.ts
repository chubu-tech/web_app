import { describe, expect, it } from "vitest";
import { isCurrent } from "./nav";

/**
 * These cases were behaviour before they were tests: `isCurrent` shipped untested
 * inside the customer destination list for five milestones, and 3a moved it here when
 * the owner console became its second caller. The `/salon` case is the one that
 * mattered enough to be special-cased inline, so it leads.
 */
describe("isCurrent", () => {
  it("matches the root exactly and never prefixes it", () => {
    expect(isCurrent({ href: "/" }, "/")).toBe(true);
    // Without the exact test, "/" would claim every path in the app.
    expect(isCurrent({ href: "/" }, "/map")).toBe(false);
    expect(isCurrent({ href: "/" }, "/bookings")).toBe(false);
  });

  it("lights Discover on a salon page, which has no destination of its own", () => {
    const discover = { href: "/", alsoMatches: ["/salon"] };
    expect(isCurrent(discover, "/salon/0b000000-0000-4000-8000-000000000001")).toBe(true);
    expect(isCurrent(discover, "/salon")).toBe(true);
    expect(isCurrent(discover, "/")).toBe(true);
    expect(isCurrent(discover, "/map")).toBe(false);
  });

  it("matches a destination and anything below it", () => {
    expect(isCurrent({ href: "/bookings" }, "/bookings")).toBe(true);
    expect(isCurrent({ href: "/bookings" }, "/bookings/abc")).toBe(true);
    expect(isCurrent({ href: "/bookings" }, "/bookings/abc/reschedule")).toBe(true);
  });

  it("does not match a sibling that merely shares a prefix", () => {
    // The live pair this protects: /queue/<entryId> watches a place in line and
    // /q/<businessId> joins one. Neither may claim the other, and an owner's
    // /business/queue must not be claimed by /business.
    expect(isCurrent({ href: "/queue" }, "/queued-up")).toBe(false);
    expect(isCurrent({ href: "/q" }, "/queue/abc")).toBe(false);
    expect(isCurrent({ href: "/business" }, "/business-x")).toBe(false);
  });

  it("keeps a section root off its siblings' paths, but on the pages it opens", () => {
    // The owner console is the first place a destination is the prefix of another:
    // /business is the calendar and /business/queue is its own tab. Without `exact`,
    // both light up on the queue board.
    const calendar = {
      href: "/business",
      exact: true,
      alsoMatches: ["/business/bookings", "/business/walk-in"],
    };
    expect(isCurrent(calendar, "/business")).toBe(true);
    expect(isCurrent(calendar, "/business/bookings/abc")).toBe(true);
    expect(isCurrent(calendar, "/business/walk-in")).toBe(true);
    expect(isCurrent(calendar, "/business/queue")).toBe(false);

    const queue = { href: "/business/queue" };
    expect(isCurrent(queue, "/business/queue")).toBe(true);
    expect(isCurrent(queue, "/business")).toBe(false);
  });

  it("treats / as exact even when exact is not set", () => {
    expect(isCurrent({ href: "/", exact: false }, "/map")).toBe(false);
  });

  it("treats an empty alsoMatches as no exception", () => {
    expect(isCurrent({ href: "/", alsoMatches: [] }, "/salon/1")).toBe(false);
  });
});
