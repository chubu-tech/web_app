"use client";

/**
 * Which products this browsing session has already counted a view for.
 *
 * `record_product_view` is a plain running counter — it upserts `product_view_daily` on
 * `(product_id, day)` and adds one, with no de-duplication of any kind. So **throttling is the
 * client's job**, and without it a customer comparing two shampoos by flicking between them
 * would invent a trend out of one person's indecision. `trending_views` feeds the storefront,
 * so that is not a cosmetic error: it is one browser deciding what the platform is excited
 * about.
 *
 * ## Why `sessionStorage`, not `localStorage`
 *
 * A view is a fact about *this visit*. `localStorage` would count a customer who comes back
 * next week as having already viewed — suppressing a real, fresh signal forever — while a
 * plain in-memory `Set` would reset on every navigation, and this app's product sheet opens
 * from server-rendered pages that remount. Per-tab, per-visit is exactly what "a session"
 * means here, and `sessionStorage` is that.
 *
 * ## Everything is wrapped, because the accessor itself can throw
 *
 * Not just return empty: in a browser set to block site data, and in some embedded contexts,
 * *touching* `sessionStorage` raises. An analytics counter must never be the reason a product
 * fails to open, so every path returns a sane answer instead. The safe answer to "have I
 * already counted this?" is **yes** when the store cannot be read — an under-count is a quiet
 * loss of signal, an over-count is a lie that compounds on every remount.
 */

/** Namespace, so these are recognisable in a dump of the store and cannot collide. */
const PREFIX = "tho.shop.viewed";

const key = (productId: string) => `${PREFIX}:${productId}`;

/**
 * Claim the one view this session gets for a product.
 *
 * **Marks as it tests**, in one call, and that is the point: a separate "have I seen it" and
 * "mark it seen" invites the gap between them, and React's development double-invoke lands in
 * exactly that gap — two effect runs, both reading `false`, both recording a view.
 *
 * Returns true when the caller should record the view, false when this session already has.
 */
export function claimProductView(productId: string): boolean {
  try {
    if (typeof sessionStorage === "undefined") return false;
    if (sessionStorage.getItem(key(productId)) != null) return false;
    sessionStorage.setItem(key(productId), "1");
    return true;
  } catch {
    // Unreadable or unwritable store. Decline rather than count — see the module note.
    return false;
  }
}
