import { describe, expect, it } from "vitest";
import {
  addToCart,
  cartItemCount,
  cartSubtotal,
  EMPTY_CART,
  isCartEmpty,
  lineTotal,
  parseCart,
  removeLine,
  repriceCart,
  setQty,
  toOrderItems,
  type Cart,
} from "./cart";
import type { Product } from "./types/salon";

/**
 * The three cases of `../tho/app/test/cart_test.dart`, plus the ones persistence adds — repricing,
 * dropping a sold-out line, and surviving a round trip through `localStorage`. The app's cart is
 * in-memory and never needed those.
 */

function product(id: string, priceNu: number, businessId = "b1"): Product {
  return {
    id,
    businessId,
    name: id,
    priceNu,
    description: null,
    photoUrl: null,
    inStock: true,
    isArchived: false,
    sortOrder: 0,
    businessName: null,
  };
}

/** `addToCart` returns a result; every test here but the mismatch one expects success. */
function add(cart: Cart, p: Product): Cart {
  const result = addToCart(cart, p);
  if (!result.ok) throw new Error(`unexpected refusal: ${result.reason}`);
  return result.cart;
}

// ============================================ the Dart's three cases ==========

it("adds, increments and totals", () => {
  let cart = add(EMPTY_CART, product("a", 450));
  cart = add(cart, product("a", 450)); // increments rather than duplicating
  cart = add(cart, product("b", 320));
  expect(cartItemCount(cart)).toBe(3);
  expect(cartSubtotal(cart)).toBe(450 * 2 + 320);
  expect(cart.lines).toHaveLength(2);
  expect(cart.businessId).toBe("b1");
});

it("setQty 0 removes a line, and clearing empties the cart", () => {
  let cart = add(EMPTY_CART, product("a", 450));
  cart = setQty(cart, "a", 0);
  expect(isCartEmpty(cart)).toBe(true);
  // ...and the salon goes with the last line, so the next add can be from anywhere.
  expect(cart.businessId).toBeNull();

  cart = add(cart, product("b", 320));
  cart = removeLine(cart, "b");
  expect(isCartEmpty(cart)).toBe(true);
  expect(cart.businessId).toBeNull();
});

it("refuses a product from another salon, because place_order takes one business", () => {
  const cart = add(EMPTY_CART, product("a", 450, "b1"));
  const result = addToCart(cart, product("x", 100, "b2"));
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.reason).toBe("salonMismatch");
  expect(result.currentBusinessId).toBe("b1");
  // It carries the cart you would get by starting over, so the caller can offer that in one press
  // instead of making the customer empty the cart by hand.
  expect(result.replacement.businessId).toBe("b2");
  expect(result.replacement.lines).toHaveLength(1);
});

// ============================================== what the guard does not do =====

it("accepts any salon once the cart is empty of lines", () => {
  // The Dart's condition includes `_qty.isNotEmpty`: a `businessId` with no lines left cannot
  // conflict with anything, and this is the state `setQty(…, 0)` produces.
  const emptied = setQty(add(EMPTY_CART, product("a", 450, "b1")), "a", 0);
  expect(addToCart(emptied, product("x", 100, "b2")).ok).toBe(true);
});

it("never mutates the cart it is given", () => {
  const before = add(EMPTY_CART, product("a", 450));
  const snapshot = JSON.stringify(before);
  add(before, product("b", 320));
  setQty(before, "a", 9);
  removeLine(before, "a");
  expect(JSON.stringify(before)).toBe(snapshot);
});

it("sums a line and builds the RPC's payload shape", () => {
  let cart = add(EMPTY_CART, product("a", 450));
  cart = setQty(cart, "a", 3);
  expect(lineTotal(cart.lines[0]!)).toBe(1350);
  cart = add(cart, product("b", 320));
  expect(toOrderItems(cart)).toEqual([
    { product_id: "a", qty: 3 },
    { product_id: "b", qty: 1 },
  ]);
});

// ==================================================== repricing ===============

describe("repriceCart", () => {
  it("leaves an unchanged cart alone and reports nothing", () => {
    const cart = add(add(EMPTY_CART, product("a", 450)), product("b", 320));
    const out = repriceCart(cart, [product("a", 450), product("b", 320)]);
    expect(out.dropped).toEqual([]);
    expect(out.repriced).toEqual([]);
    expect(cartSubtotal(out.cart)).toBe(770);
  });

  it("refreshes a price that moved, and names it", () => {
    const cart = add(EMPTY_CART, product("a", 450));
    const dearer = { ...product("a", 500), name: "Argan Hair Oil" };
    const out = repriceCart(cart, [dearer]);
    expect(out.cart.lines[0]!.priceNu).toBe(500);
    expect(cartSubtotal(out.cart)).toBe(500);
    expect(out.repriced).toEqual([{ name: "Argan Hair Oil", from: 450, to: 500 }]);
    expect(out.dropped).toEqual([]);
  });

  it("drops a line that is no longer buyable, and names it", () => {
    // `available` is a read that already filters `in_stock` and `is_archived`, so absence covers
    // sold out, archived, deleted and belonging to another salon.
    let cart = add(EMPTY_CART, product("a", 450));
    cart = add(cart, { ...product("b", 890), name: "Beard Grooming Kit" });
    const out = repriceCart(cart, [product("a", 450)]);
    expect(out.dropped).toEqual(["Beard Grooming Kit"]);
    expect(out.cart.lines.map((l) => l.productId)).toEqual(["a"]);
    expect(cartSubtotal(out.cart)).toBe(450);
  });

  it("clears the salon when repricing empties the cart", () => {
    const cart = add(EMPTY_CART, product("a", 450));
    const out = repriceCart(cart, []);
    expect(isCartEmpty(out.cart)).toBe(true);
    expect(out.cart.businessId).toBeNull();
  });

  it("refreshes the name too, so a renamed product is not shown by its old label", () => {
    const cart = add(EMPTY_CART, product("a", 450));
    const renamed = { ...product("a", 450), name: "Argan Oil (250ml)" };
    const out = repriceCart(cart, [renamed]);
    expect(out.cart.lines[0]!.name).toBe("Argan Oil (250ml)");
    // A rename alone is not a reprice, so there is nothing to tell the customer.
    expect(out.repriced).toEqual([]);
  });

  it("keeps quantities across a reprice", () => {
    const cart = setQty(add(EMPTY_CART, product("a", 450)), "a", 4);
    const out = repriceCart(cart, [product("a", 500)]);
    expect(out.cart.lines[0]!.qty).toBe(4);
    expect(cartSubtotal(out.cart)).toBe(2000);
  });
});

// ============================================ localStorage round trip =========

describe("parseCart", () => {
  it("round-trips a real cart", () => {
    const cart = add(add(EMPTY_CART, product("a", 450)), product("b", 320));
    expect(parseCart(JSON.stringify(cart))).toEqual(cart);
  });

  it("treats anything unrecognisable as an empty cart rather than throwing", () => {
    // This reads what a PREVIOUS version of the app wrote. A shape change must not leave a
    // customer unable to load the page.
    for (const raw of [
      null,
      "",
      "not json",
      "[]",
      "null",
      "42",
      '{"lines":"nope"}',
      '{"businessId":"b1"}',
    ]) {
      expect(parseCart(raw)).toEqual(EMPTY_CART);
    }
  });

  it("drops individual malformed lines rather than the whole cart", () => {
    const raw = JSON.stringify({
      businessId: "b1",
      lines: [
        { productId: "a", name: "Good", priceNu: 450, qty: 2, photoUrl: null },
        { productId: "b", name: "No price", qty: 1 },
        { productId: "c", name: "Zero qty", priceNu: 100, qty: 0 },
        { name: "No id", priceNu: 100, qty: 1 },
      ],
    });
    const cart = parseCart(raw);
    expect(cart.lines.map((l) => l.productId)).toEqual(["a"]);
    expect(cart.businessId).toBe("b1");
  });

  it("floors a fractional quantity, because qty is an integer column", () => {
    const raw = JSON.stringify({
      businessId: "b1",
      lines: [{ productId: "a", name: "A", priceNu: 100, qty: 2.7 }],
    });
    expect(parseCart(raw).lines[0]!.qty).toBe(2);
  });

  it("returns an empty cart when every line was malformed", () => {
    const raw = JSON.stringify({ businessId: "b1", lines: [{ nope: true }] });
    expect(parseCart(raw)).toEqual(EMPTY_CART);
  });
});
