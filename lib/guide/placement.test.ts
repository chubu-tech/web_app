import { describe, expect, it } from "vitest";
import { launcherLift, LIFT_BASE_PX, LIFT_CART_PX, LIFT_CTA_PX } from "./placement";

const at = (pathname: string, cartVisible = false) => launcherLift({ pathname, cartVisible });

/**
 * The list of surfaces that pin something to the bottom edge, as measured on 2026-08-18.
 * These are the cases that make the launcher "not obstruct important content": if a page
 * grows a fixed footer and this file is not updated, the button lands on it.
 */
describe("launcherLift", () => {
  it("rests 16px up on an ordinary route", () => {
    expect(at("/discover")).toBe(LIFT_BASE_PX);
    expect(at("/bookings")).toBe(LIFT_BASE_PX);
    expect(at("/business")).toBe(LIFT_BASE_PX);
    expect(at("/business/insights")).toBe(LIFT_BASE_PX);
    expect(at("/rewards")).toBe(LIFT_BASE_PX);
  });

  it("is not drawn on the map, because the tile attribution owns that corner", () => {
    // OpenStreetMap's credit is rendered bottom-right and the tile policy requires it to
    // stay visible. This is the one route where hiding beats lifting.
    expect(at("/map")).toBeNull();
    expect(at("/map", true)).toBeNull();
  });

  it("clears the salon page's Book bar and the wizard's total", () => {
    expect(at("/salon/0b000000-0000-4000-8000-000000000001")).toBe(LIFT_CTA_PX);
    expect(at("/salon/0b000000-0000-4000-8000-000000000001/book")).toBe(LIFT_CTA_PX);
  });

  it("does not mistake /salons for a salon page", () => {
    // A `startsWith("/salon")` test would lift the button across the whole browse list.
    expect(at("/salons")).toBe(LIFT_BASE_PX);
    expect(at("/salons/thimphu")).toBe(LIFT_BASE_PX);
  });

  it("clears the reschedule footer, and only the reschedule route", () => {
    expect(at("/bookings/abc/reschedule")).toBe(LIFT_CTA_PX);
    // The detail page above it pins nothing — its actions are in the page flow.
    expect(at("/bookings/abc")).toBe(LIFT_BASE_PX);
  });

  it("clears a chat composer on either side of the conversation", () => {
    expect(at("/messages/abc")).toBe(LIFT_CTA_PX);
    expect(at("/business/messages/abc")).toBe(LIFT_CTA_PX);
    // The lists have no composer.
    expect(at("/messages")).toBe(LIFT_BASE_PX);
    expect(at("/business/messages")).toBe(LIFT_BASE_PX);
  });

  it("clears the owner's walk-in footer", () => {
    expect(at("/business/walk-in")).toBe(LIFT_CTA_PX);
  });

  it("adds the cart bar's lane on top of whatever the route needs", () => {
    expect(at("/discover", true)).toBe(LIFT_BASE_PX + LIFT_CART_PX);
    expect(at("/salon/abc", true)).toBe(LIFT_CTA_PX + LIFT_CART_PX);
  });

  it("does not add a cart lane on /cart, where the bar hides itself", () => {
    expect(at("/cart", true)).toBe(LIFT_BASE_PX);
  });
});
