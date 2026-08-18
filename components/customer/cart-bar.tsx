"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icons, IconSize } from "@/components/ui/icons";
import { cartItemCount, cartSubtotal, isCartEmpty, type Cart } from "@/lib/cart";
import { useCart } from "@/lib/use-cart";
import { formatNu } from "@/lib/utils";

/**
 * Whether the bar is on screen — the three conditions, in one place.
 *
 * `GuideLauncher` has to lift clear of this bar, so it needs the same answer the bar gives
 * itself. It used to re-derive the rule and got two of the three: it missed `/cart`, and so
 * lifted the button 64px above a bar that is deliberately not rendered there. A predicate the
 * bar itself uses cannot drift from the bar.
 */
export function cartBarVisible({
  cart,
  hydrated,
  pathname,
}: {
  cart: Cart;
  hydrated: boolean;
  pathname: string;
}): boolean {
  return hydrated && !isCartEmpty(cart) && pathname !== "/cart";
}

/** `cartBarVisible` for a client component that has no cart of its own. */
export function useCartBarVisible(): boolean {
  const { cart, hydrated } = useCart();
  const pathname = usePathname();
  return cartBarVisible({ cart, hydrated, pathname });
}

/**
 * The pinned cart summary — a port of `ShopCartBar` in
 * `tho/app/lib/customer/shop/salon_shop_tab.dart`.
 *
 * In the app this is the salon screen's `bottomNavigationBar`, rendered by the *parent* so it stays
 * fixed while the product tiles scroll under it. Same here, and for the same reason — except this one
 * is a `Link`, not a tap handler, because `/cart` is a real page.
 *
 * **It renders nothing when the cart is empty, and nothing on `/cart` itself.** An empty bar is
 * chrome that says nothing, and a "View cart" bar on the cart is a link to where you already are. The
 * app can only manage the first of those, since it has no notion of a current route.
 *
 * **It sits on the bottom edge.** It used to offset by the fixed tab bar's `62px` plus the safe-area
 * inset, so it floated above it. With the bar gone there is nothing underneath, so the only term
 * left is the inset itself — which still matters, or the bar lands on an iOS home indicator.
 */
export function CartBar() {
  const { cart, hydrated } = useCart();
  const pathname = usePathname();

  // See `useCart` on hydration: the first client render must match the server's, which has no
  // `localStorage` and so no cart.
  if (!cartBarVisible({ cart, hydrated, pathname })) return null;

  const count = cartItemCount(cart);

  return (
    <div
      className={
        "px-base fixed inset-x-0 z-20 mx-auto max-w-[720px] " +
        "bottom-[calc(env(safe-area-inset-bottom)+8px)] tablet:bottom-base"
      }
    >
      <Link
        href="/cart"
        className="bg-ink text-on-primary px-base py-md gap-sm flex items-center rounded-md shadow-lg"
      >
        <Icons.cart
          className="shrink-0"
          style={{ width: IconSize.sm, height: IconSize.sm }}
          aria-hidden
        />
        <span className="text-body-md min-w-0 flex-1 truncate font-bold tabular-nums">
          {count} {count === 1 ? "item" : "items"} · {formatNu(cartSubtotal(cart))}
        </span>
        <span className="text-body-md gap-xs flex shrink-0 items-center">
          View cart
          <Icons.forward style={{ width: IconSize.xxs, height: IconSize.xxs }} aria-hidden />
        </span>
      </Link>
    </div>
  );
}
