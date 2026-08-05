"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { GuestWall } from "@/components/auth/guest-wall";
import { QtyStepper } from "@/components/customer/qty-stepper";
import { Button } from "@/components/ui/button";
import { CoverImage } from "@/components/ui/cover-image";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Icons } from "@/components/ui/icons";
import { fetchBusinessById } from "@/lib/api/discovery";
import { fetchProductsForBusiness } from "@/lib/api/salon";
import { placeOrder } from "@/lib/api/shop";
import { isUnavailable, shopErrorMessage } from "@/lib/api/shop-errors";
import { cartSubtotal, lineTotal, repriceCart, toOrderItems } from "@/lib/cart";
import { createClient } from "@/lib/supabase/client";
import { useCart } from "@/lib/use-cart";
import { formatNu } from "@/lib/utils";

/**
 * The cart — a port of `_CartSheet` in `tho/app/lib/customer/shop/cart_sheet.dart`, as a page.
 *
 * ## It re-prices before it paints, and says what changed
 *
 * The app's cart lives for minutes in memory and only reconciles with the catalogue *after*
 * `place_order` refuses. This one persists in `localStorage`, so it can be days old — and
 * `place_order` computes `total_nu` from `products.price_nu` server-side, so a stale subtotal here
 * would promise a number the order does not charge. So the first thing this does is read the
 * salon's live shelf and run `repriceCart`, then tell the customer what moved: *"Beard Grooming Kit
 * is sold out — removed"*. Silently changing a total would be worse than either.
 *
 * ## The token is the cart's, not the button's
 *
 * `place_order` de-duplicates on `(business, customer, client_token)`. `useCart` keeps one token per
 * cart in `localStorage` and only retires it on `clear()`, so a double-press, a reload mid-request,
 * or a retry after a timeout that actually committed all resolve to **one** order. The app gets this
 * right too and its comment explains why; the difference is that a reload cannot break it here.
 *
 * ## The guest wall is at the button, not the door
 *
 * `place_order` raises `P0010` for an anonymous session. A guest can browse, fill this cart and
 * read the total; the wall comes when they commit, with `?next=/cart` — and because the cart is in
 * `localStorage`, it is still here when they come back. Walling at Add to cart would ask for an
 * account before showing why one is worth having.
 */
export function CartView({
  signedIn,
  isGuest,
}: {
  signedIn: boolean;
  /** A guest has a session but not a real account — `private.is_real_user()` refuses them. */
  isGuest: boolean;
}) {
  const router = useRouter();
  const { cart, hydrated, clientToken, setQty, replace, clear } = useCart();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [wall, setWall] = useState(false);
  const [repriced, setRepriced] = useState(false);
  const [salonName, setSalonName] = useState<string | null>(null);

  const businessId = cart.businessId;

  /**
   * Whether the CTA may fire: either the re-price has finished, or there was nothing to re-price.
   *
   * **Derived, not stored.** The first version kept a `checked` flag and set it synchronously in the
   * effect body for the empty-cart case, which `react-hooks/set-state-in-effect` correctly refuses —
   * it cascades a render for a value that was already knowable. `setRepriced` is only ever called
   * from inside the async callback, which is exactly what that rule permits.
   */
  const checked = hydrated && (cart.lines.length === 0 || repriced);

  // Re-price once the stored cart is in hand, so nobody can order against prices that have not been
  // confirmed against the shelf.
  useEffect(() => {
    if (!hydrated || !businessId || cart.lines.length === 0) return;
    let live = true;
    void (async () => {
      try {
        const supabase = createClient();
        // Two reads because the name lives on `businesses` and `fetchProductsForBusiness` does not
        // join it. Both are small, both are RLS-scoped, and neither is worth a bespoke query.
        const [available, salon] = await Promise.all([
          fetchProductsForBusiness(supabase, businessId),
          fetchBusinessById(supabase, businessId).catch(() => null),
        ]);
        if (!live) return;
        setSalonName(salon?.name ?? null);
        const { cart: next, dropped, repriced: changed } = repriceCart(cart, available);
        if (dropped.length > 0 || changed.length > 0) {
          replace(next);
          for (const name of dropped) toast.error(`${name} is sold out — removed from your cart.`);
          for (const c of changed) {
            toast.info(`${c.name} is now ${formatNu(c.to)}, was ${formatNu(c.from)}.`);
          }
        }
      } catch {
        // A failed re-price leaves the cart alone. The order may still refuse with P0002, which is
        // handled below — better than blocking checkout on a read that might just be offline.
      } finally {
        if (live) setRepriced(true);
      }
    })();
    return () => {
      live = false;
    };
    // Deliberately keyed on the salon and the hydration flag only: re-running on every `cart`
    // change would re-read the catalogue on each `+` press, and `replace` inside would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, businessId]);

  async function place() {
    if (!businessId || cart.lines.length === 0) return;
    if (!signedIn || isGuest) {
      setWall(true);
      return;
    }
    setBusy(true);
    try {
      const order = await placeOrder(createClient(), {
        businessId,
        items: toOrderItems(cart),
        note: note.trim() || null,
        clientToken,
      });
      // Only now is the token retired, which is what makes the next order a new order.
      clear();
      router.replace(`/orders/${order.id}`);
    } catch (caught) {
      if (isUnavailable(caught)) {
        // Not a message but a re-read: drop what has gone and let them look at what is left.
        try {
          const available = await fetchProductsForBusiness(createClient(), businessId);
          const { cart: next, dropped } = repriceCart(cart, available);
          replace(next);
          toast.error(
            dropped.length > 0
              ? `${dropped.join(" and ")} just sold out — removed. Check the rest and try again.`
              : "Something in your cart just sold out — please review it.",
          );
        } catch {
          toast.error(shopErrorMessage("placeOrder", caught));
        }
      } else {
        toast.error(shopErrorMessage("placeOrder", caught));
      }
      setBusy(false);
    }
  }

  if (!hydrated) {
    // Matches the server's render exactly. See `useCart`'s note on hydration.
    return <div className="py-xxl" aria-busy="true" />;
  }

  if (cart.lines.length === 0) {
    return (
      <EmptyState
        icon={Icons.cart}
        title="Your cart is empty"
        message="Add something from a salon's shop and it will wait for you here — even if you close this tab."
        action={
          <Link href="/?tab=products">
            <Button variant="outlined">Browse products</Button>
          </Link>
        }
      />
    );
  }

  return (
    <>
      {salonName && businessId ? (
        <p className="text-body-sm text-muted mb-base">
          Collecting from{" "}
          <Link href={`/salon/${businessId}`} className="text-rausch-cta font-medium underline">
            {salonName}
          </Link>
          . You pay in cash when you pick it up — nothing is charged here.
        </p>
      ) : null}

      <ul className="gap-md mb-lg flex flex-col">
        {cart.lines.map((line) => (
          <li
            key={line.productId}
            className="border-hairline-soft p-sm gap-md flex items-center rounded-md border"
          >
            <span className="size-13 shrink-0 overflow-hidden rounded-sm">
              <CoverImage label={line.name} imageUrl={line.photoUrl} sizes="52px" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="text-title text-ink block truncate font-medium">{line.name}</span>
              <span className="text-body-sm text-muted block">
                {formatNu(line.priceNu)} each · {formatNu(lineTotal(line))}
              </span>
            </span>
            <QtyStepper
              qty={line.qty}
              label={line.name}
              disabled={busy}
              onChange={(qty) => setQty(line.productId, qty)}
            />
          </li>
        ))}
      </ul>

      <div className="border-hairline-soft pt-base gap-sm mb-lg flex items-baseline border-t">
        <span className="text-title text-ink flex-1 font-medium">Subtotal</span>
        <span className="text-display-sm text-ink font-semibold tabular-nums">
          {formatNu(cartSubtotal(cart))}
        </span>
      </div>

      <div className="mb-lg">
        <Field
          label="Pickup note (optional)"
          value={note}
          onChange={setNote}
          placeholder="e.g. call when ready"
        />
      </div>

      <Button fullWidth busy={busy} disabled={!checked} onClick={() => void place()}>
        Place order
      </Button>
      <p className="text-caption-sm text-muted mt-sm text-center">
        The salon confirms and tells you when it&apos;s ready. Nothing is charged online.
      </p>

      {/*
        `GUEST_ACTIONS` already carries `order` — declared in 2d for exactly this moment, like
        `/orders` in `destinations.ts`. `onUpgraded` retries the press, and the cart is still in
        `localStorage`, so nothing has to be carried through the round trip by hand.
      */}
      <GuestWall
        open={wall}
        onClose={() => setWall(false)}
        action="order"
        next="/cart"
        onUpgraded={() => {
          setWall(false);
          void place();
        }}
      />
    </>
  );
}
