import type { Product } from "./types/salon";

/**
 * The shopping cart — a port of `CartController` in
 * `tho/app/lib/customer/shop/cart.dart`.
 *
 * **Pure functions over an immutable value, not a class with listeners.** The Dart is a
 * `ChangeNotifier` that mutates two maps in place and calls `notifyListeners()`; React state wants
 * a value it can compare, and `useSyncExternalStore`-style observables buy nothing here because
 * exactly one hook reads this. Every function below returns a new `Cart` and never touches its
 * argument, which is also what makes `localStorage` round-tripping trivial.
 *
 * ## One salon per cart, and why it cannot be relaxed
 *
 * `place_order(p_business, p_items, …)` takes **one** business id and validates every product
 * against it. So a cart spanning two salons could not be placed at all, and the guard is the
 * schema's, not a product decision. `addToCart` reports the clash rather than throwing —
 * `CartSalonMismatch` is an exception in Dart, but the caller here has something useful to offer
 * ("start a new cart with this instead") and a thrown error is a poor way to carry a choice.
 *
 * ## Lines carry a price, and it is a snapshot
 *
 * A line stores `priceNu` so the cart can show a subtotal without re-reading the catalogue. That
 * snapshot is **advisory only**: `place_order` computes `total_nu` server-side from
 * `products.price_nu`, so the order charges what the database says, not what the cart said. The
 * app's cart lives for minutes and gets away with it; a `localStorage` cart can be days old, which
 * is what `repriceCart` exists for.
 */

export type CartLine = {
  productId: string;
  name: string;
  priceNu: number;
  qty: number;
  photoUrl: string | null;
};

export type Cart = {
  /** Null exactly when the cart is empty — the two are kept in step by every function here. */
  businessId: string | null;
  lines: CartLine[];
};

export const EMPTY_CART: Cart = { businessId: null, lines: [] };

/** A fresh cart holding one of `product`. */
function cartOf(product: Product): Cart {
  return {
    businessId: product.businessId,
    lines: [
      {
        productId: product.id,
        name: product.name,
        priceNu: product.priceNu,
        qty: 1,
        photoUrl: product.photoUrl,
      },
    ],
  };
}

/* -------------------------------------------------------------------------- */

export type AddResult =
  | { ok: true; cart: Cart }
  /**
   * The product belongs to a different salon from the one already in the cart. Carries what would
   * be needed to start over, so the caller can offer that in one press.
   */
  | { ok: false; reason: "salonMismatch"; currentBusinessId: string; replacement: Cart };

/**
 * Add one of `product`, or increment it if it is already in the cart.
 *
 * The mismatch check matches the Dart's condition exactly, including the `_qty.isNotEmpty` part: a
 * cart whose `businessId` is set but whose lines are all gone accepts anything, because there is
 * nothing to conflict with.
 */
export function addToCart(cart: Cart, product: Product): AddResult {
  if (
    cart.businessId != null &&
    cart.businessId !== product.businessId &&
    cart.lines.length > 0
  ) {
    return {
      ok: false,
      reason: "salonMismatch",
      currentBusinessId: cart.businessId,
      replacement: cartOf(product),
    };
  }

  const existing = cart.lines.find((l) => l.productId === product.id);
  const lines = existing
    ? cart.lines.map((l) => (l.productId === product.id ? { ...l, qty: l.qty + 1 } : l))
    : [
        ...cart.lines,
        {
          productId: product.id,
          name: product.name,
          priceNu: product.priceNu,
          qty: 1,
          photoUrl: product.photoUrl,
        },
      ];
  return { ok: true, cart: { businessId: product.businessId, lines } };
}

/**
 * Set a line's quantity. **Zero or less removes the line**, matching the Dart and the owner
 * catalogue's delete-by-zero convention — and when the last line goes, `businessId` goes with it,
 * so the next add can be from any salon.
 */
export function setQty(cart: Cart, productId: string, qty: number): Cart {
  const lines =
    qty <= 0
      ? cart.lines.filter((l) => l.productId !== productId)
      : cart.lines.map((l) => (l.productId === productId ? { ...l, qty } : l));
  return { businessId: lines.length === 0 ? null : cart.businessId, lines };
}

export function removeLine(cart: Cart, productId: string): Cart {
  return setQty(cart, productId, 0);
}

export function cartItemCount(cart: Cart): number {
  return cart.lines.reduce((sum, l) => sum + l.qty, 0);
}

/** Advisory — see the module note. The order's total comes from the server. */
export function cartSubtotal(cart: Cart): number {
  return cart.lines.reduce((sum, l) => sum + l.priceNu * l.qty, 0);
}

export function lineTotal(line: CartLine): number {
  return line.priceNu * line.qty;
}

export function isCartEmpty(cart: Cart): boolean {
  return cart.lines.length === 0;
}

/* -------------------------------------------------------------------------- */

export type RepriceResult = {
  cart: Cart;
  /** Names of lines dropped because the product is gone or sold out — for the copy. */
  dropped: string[];
  /** Lines whose price moved, as `{ name, from, to }` — also for the copy. */
  repriced: { name: string; from: number; to: number }[];
};

/**
 * Reconcile a stored cart against a fresh read of the salon's in-stock products.
 *
 * **This is what makes persisting the cart honest.** A `localStorage` cart can outlive a price
 * change or a sell-out by days, and `place_order` would then either refuse it (`P0002`) or charge a
 * total the customer never saw. So `/cart` calls this before painting and says what changed.
 *
 * `available` should be the result of a `products` read that already filters `in_stock` and
 * `is_archived` — i.e. exactly what a customer is allowed to buy. Anything not in it is dropped,
 * which covers sold out, archived, deleted, and (because the read is scoped) belonging to another
 * salon.
 */
export function repriceCart(cart: Cart, available: Product[]): RepriceResult {
  const byId = new Map(available.map((p) => [p.id, p]));
  const dropped: string[] = [];
  const repriced: RepriceResult["repriced"] = [];
  const lines: CartLine[] = [];

  for (const line of cart.lines) {
    const product = byId.get(line.productId);
    if (!product) {
      dropped.push(line.name);
      continue;
    }
    if (product.priceNu !== line.priceNu) {
      repriced.push({ name: product.name, from: line.priceNu, to: product.priceNu });
    }
    // The name and photo are refreshed too: the owner may have renamed or re-shot the product, and
    // a cart is a worse place than most to show a stale label.
    lines.push({
      productId: line.productId,
      name: product.name,
      priceNu: product.priceNu,
      qty: line.qty,
      photoUrl: product.photoUrl,
    });
  }

  return {
    cart: { businessId: lines.length === 0 ? null : cart.businessId, lines },
    dropped,
    repriced,
  };
}

/** The `p_items` payload `place_order` expects. */
export function toOrderItems(cart: Cart): { product_id: string; qty: number }[] {
  return cart.lines.map((l) => ({ product_id: l.productId, qty: l.qty }));
}

/* -------------------------------------------------------------------------- */

/**
 * Parse a cart out of `localStorage`.
 *
 * Anything unrecognised becomes an empty cart rather than throwing: this reads data the *previous*
 * version of the app wrote, and a shape change must not leave a customer unable to load a page.
 * The shape is validated line by line, because a half-valid cart is worse than none.
 */
export function parseCart(raw: string | null): Cart {
  if (!raw) return EMPTY_CART;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) return EMPTY_CART;
    const { businessId, lines } = parsed as { businessId?: unknown; lines?: unknown };
    if (!Array.isArray(lines)) return EMPTY_CART;
    const clean: CartLine[] = [];
    for (const line of lines) {
      if (typeof line !== "object" || line === null) continue;
      const l = line as Record<string, unknown>;
      if (typeof l.productId !== "string" || typeof l.name !== "string") continue;
      const priceNu = Number(l.priceNu);
      const qty = Number(l.qty);
      if (!Number.isFinite(priceNu) || !Number.isFinite(qty) || qty <= 0) continue;
      clean.push({
        productId: l.productId,
        name: l.name,
        priceNu,
        qty: Math.floor(qty),
        photoUrl: typeof l.photoUrl === "string" ? l.photoUrl : null,
      });
    }
    if (clean.length === 0) return EMPTY_CART;
    return {
      businessId: typeof businessId === "string" ? businessId : null,
      lines: clean,
    };
  } catch {
    return EMPTY_CART;
  }
}
