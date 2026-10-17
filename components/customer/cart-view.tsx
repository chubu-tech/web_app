"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { GuestWall } from "@/components/auth/guest-wall";
import { QtyStepper } from "@/components/customer/qty-stepper";
import { BhutanPhoneField } from "@/components/ui/bhutan-phone-field";
import { Button } from "@/components/ui/button";
import { CoverImage } from "@/components/ui/cover-image";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { Icons } from "@/components/ui/icons";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { fetchBusinessById } from "@/lib/api/discovery";
import { fetchProductsForBusiness } from "@/lib/api/salon";
import { placeOrder, previewPromo } from "@/lib/api/shop";
import { isUnavailable, shopErrorMessage } from "@/lib/api/shop-errors";
import { bhutanPhoneError, toE164 } from "@/lib/bhutan-phone";
import { cartSubtotal, lineTotal, repriceCart, toOrderItems } from "@/lib/cart";
import {
  orderTotals,
  promoRefusalMessage,
  redemptionDiscountNu,
} from "@/lib/order-totals";
import { createClient } from "@/lib/supabase/client";
import type { LoyaltyRedemption, OrderFulfilment } from "@/lib/types/back-office";
import type { Business } from "@/lib/types/salon";
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
 * ## The total is stated before the button, and the arithmetic is a copy
 *
 * `place_order` computes `subtotal − discount + delivery fee` server-side and its answer is the
 * one that counts. `lib/order-totals.ts` mirrors it line for line so this page can show the sum
 * *before* committing to it — the same reason upstream moved the total into the product page's
 * button: **the last thing read before committing should be what it costs.** Where the two
 * disagree the mirror is wrong; the order's own `totalNu` is what the receipt shows.
 *
 * ## Three things the checkout only offers when they exist
 *
 * Each is drawn from a fact rather than from a plan, because every one of them has a server
 * refusal behind it and an offer that gets refused is worse than no offer:
 *
 * - **Delivery**, only when `business.deliveryEnabled`. No live salon has it on, so today this is
 *   invisible — and it turns itself on the day one does.
 * - **A promo code**, always offerable because the customer may have one from anywhere, but
 *   checked with `previewPromo` before the press. `promo_codes` is unreadable by a customer by
 *   design, so the code in their hand is the only way to find out.
 * - **A reward**, only the pending redemptions at *this* salon that `place_order` can actually
 *   price. That filter is load-bearing rather than defensive: the only pending redemption on the
 *   platform today is a `free_service`, which `place_order` refuses with `P0004`, so an unfiltered
 *   picker would offer the one reward a customer has and then decline it.
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
  redemptions,
}: {
  signedIn: boolean;
  /** A guest has a session but not a real account — `private.is_real_user()` refuses them. */
  isGuest: boolean;
  /** Every pending redemption of theirs, across all salons. Narrowed to this cart's below. */
  redemptions: LoyaltyRedemption[];
}) {
  const router = useRouter();
  const { cart, hydrated, clientToken, setQty, replace, clear } = useCart();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [wall, setWall] = useState(false);
  const [repriced, setRepriced] = useState(false);
  /** The whole row, not just the name: delivery is three fields on it. */
  const [salon, setSalon] = useState<Business | null>(null);

  const [fulfilment, setFulfilment] = useState<OrderFulfilment>("pickup");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [showFieldErrors, setShowFieldErrors] = useState(false);

  const [codeInput, setCodeInput] = useState("");
  /** The code the server has agreed to, and what it said it was worth against `subtotal`. */
  const [promo, setPromo] = useState<{ code: string; discountNu: number } | null>(null);
  const [promoNote, setPromoNote] = useState<string | null>(null);
  const [checkingCode, setCheckingCode] = useState(false);

  const [rewardId, setRewardId] = useState<string | null>(null);

  const businessId = cart.businessId;
  const subtotal = cartSubtotal(cart);

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
        setSalon(salon);
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

  /*
    The rewards this cart could actually spend.

    Two filters, and the second is the one that matters: the salon (a reward is earned at one
    shop and `place_order` refuses a redemption from another with `P0004`), and whether
    `redemptionDiscountNu` can price it at all. A `free_service` is a haircut, not money off
    shampoo, and the server says so — so it never reaches the picker.
  */
  const spendable = useMemo(
    () =>
      redemptions
        .filter((r) => r.businessId === businessId)
        .map((r) => ({
          redemption: r,
          discountNu: redemptionDiscountNu(r.typeSnapshot, r.valueSnapshot, subtotal),
        }))
        .filter((r): r is { redemption: LoyaltyRedemption; discountNu: number } =>
          r.discountNu != null,
        ),
    [redemptions, businessId, subtotal],
  );

  /*
    The selected reward, **derived rather than stored** — the same rule `checked` above follows
    and for the same reason. A reward can leave `spendable` while it is selected: the cart is
    emptied of that salon's last line, or the redemption is confirmed at the counter in another
    tab. Reconciling that in an effect would cascade a render for something already knowable, so
    a `rewardId` pointing at nothing simply selects nothing, and the radios read this rather than
    the raw id so "Save it for next time" is what shows.
  */
  const reward = spendable.find((r) => r.redemption.id === rewardId) ?? null;
  const delivering = fulfilment === "delivery";

  const totals = orderTotals({
    subtotalNu: subtotal,
    promoDiscountNu: promo?.discountNu ?? 0,
    rewardDiscountNu: reward?.discountNu ?? 0,
    fulfilment,
    deliveryFeeNu: salon?.deliveryFeeNu ?? 0,
    freeDeliveryOverNu: salon?.freeDeliveryOverNu ?? null,
  });

  /*
    A code is quoted **against a subtotal**, so changing the cart invalidates the quote.

    Re-asking rather than clearing, because the common change is a quantity nudge and making
    somebody retype their code for it would be its own small insult. If the re-ask now refuses
    — a minimum the smaller cart no longer meets — the code comes off and says why, which is the
    honest outcome and the one `place_order` would have produced at the press.
  */
  useEffect(() => {
    const code = promo?.code;
    if (!code || !businessId) return;
    let live = true;
    void (async () => {
      try {
        const out = await previewPromo(createClient(), { businessId, code, subtotalNu: subtotal });
        if (!live) return;
        if (out.valid) {
          setPromo({ code, discountNu: out.discountNu });
          setPromoNote(null);
        } else {
          setPromo(null);
          setPromoNote(promoRefusalMessage(out.reason));
        }
      } catch {
        // Leave the quote alone. `place_order` re-checks the code anyway, so a failed re-ask
        // costs an accurate preview rather than a wrong order.
      }
    })();
    return () => {
      live = false;
    };
    // Keyed on the subtotal, not on `promo` — the setState inside would otherwise loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal, businessId]);

  async function applyCode() {
    const code = codeInput.trim();
    if (!code || !businessId) return;
    setCheckingCode(true);
    setPromoNote(null);
    try {
      const out = await previewPromo(createClient(), { businessId, code, subtotalNu: subtotal });
      if (out.valid) {
        setPromo({ code, discountNu: out.discountNu });
        setCodeInput("");
        setPromoNote(null);
      } else {
        setPromo(null);
        setPromoNote(promoRefusalMessage(out.reason));
      }
    } catch {
      setPromoNote("Couldn't check that code just now. Try again in a moment.");
    } finally {
      setCheckingCode(false);
    }
  }

  async function place() {
    if (!businessId || cart.lines.length === 0) return;
    if (!signedIn || isGuest) {
      setWall(true);
      return;
    }
    /*
      The server refuses a delivery with either field missing (`P0001`), and it is one message
      for both. Catching it here means the customer is told *which* field, beside the field, and
      before the press — rather than reading "a delivery address and phone are required" under a
      form that has one of them.
    */
    if (delivering && (address.trim() === "" || bhutanPhoneError(phone, { required: true }))) {
      setShowFieldErrors(true);
      return;
    }
    setBusy(true);
    try {
      const order = await placeOrder(createClient(), {
        businessId,
        items: toOrderItems(cart),
        note: note.trim() || null,
        clientToken,
        fulfilment,
        promoCode: promo?.code ?? null,
        loyaltyRedemptionId: reward?.redemption.id ?? null,
        // Stored E.164, shown local — the repo's rule for every phone field.
        deliveryAddress: delivering ? address.trim() : null,
        deliveryPhone: delivering ? toE164(phone) : null,
        deliveryNote: null,
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
      {salon && businessId ? (
        <p className="text-body-sm text-muted mb-base">
          {delivering ? "Delivered by" : "Collecting from"}{" "}
          <Link href={`/salon/${businessId}`} className="text-rausch-cta font-medium underline">
            {salon.name}
          </Link>
          {/* The payment sentence follows the fulfilment, because "when you pick it up" is
              simply untrue of a delivery and it is the line that sets the expectation. */}
          {delivering
            ? ". You pay in cash when it arrives — nothing is charged here."
            : ". You pay in cash when you pick it up — nothing is charged here."}
        </p>
      ) : null}

      <ul className="gap-md mb-lg flex flex-col">
        {cart.lines.map((line) => (
          <li
            key={line.productId}
            className="border-hairline-soft p-sm gap-md flex items-center rounded-md border"
          >
            <span className="size-13 shrink-0 overflow-hidden rounded-sm">
              <CoverImage label={line.name} imageUrl={line.photoUrl} sizes="52px" className="size-full" />
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

      {/*
        Only drawn when the salon actually delivers. `place_order` refuses a delivery at a salon
        with the switch off, so a toggle here would be an option the server declines — and no
        live salon has it on today, which makes this the whole difference between a working
        checkout and a broken one.
      */}
      {salon?.deliveryEnabled ? (
        <div className="mb-lg">
          <SegmentedControl
            label="How would you like your order?"
            labels={["Collect", "Delivery"]}
            index={delivering ? 1 : 0}
            onChange={(i) => setFulfilment(i === 1 ? "delivery" : "pickup")}
          />
          {delivering ? (
            <div className="gap-base mt-base flex flex-col">
              <Field
                label="Delivery address"
                value={address}
                onChange={setAddress}
                placeholder="e.g. Building 4, Norzin Lam, Thimphu"
                error={
                  showFieldErrors && address.trim() === ""
                    ? "Where should they bring it?"
                    : undefined
                }
              />
              {/* Required here, where every other phone field in the app is optional: a rider
                  who cannot call has no way to find a door. */}
              <BhutanPhoneField
                label="Phone for the rider"
                value={phone}
                onChange={setPhone}
                required
                showError={showFieldErrors}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {/*
        A code, if they have one.

        Offered to everyone rather than to salons known to run promotions, because `promo_codes`
        is unreadable by a customer by design — an enumerable code list is a discount to whoever
        scrapes it — so there is no way to know from here whether this salon has any. The code in
        their hand is the only evidence, and `previewPromo` is what tests it.
      */}
      <div className="mb-lg">
        {promo ? (
          <div className="border-hairline-soft p-sm gap-sm flex items-center rounded-md border">
            <Icons.offer className="text-rausch-cta size-5 shrink-0" aria-hidden />
            <span className="text-body-sm text-ink min-w-0 flex-1">
              <span className="font-medium">{promo.code.toUpperCase()}</span> applied —{" "}
              {formatNu(promo.discountNu)} off
            </span>
            <Button
              variant="quiet"
              onClick={() => {
                setPromo(null);
                setPromoNote(null);
              }}
            >
              Remove
            </Button>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void applyCode();
            }}
            className="gap-sm flex items-end"
          >
            <div className="flex-1">
              <Field
                label="Promo code (optional)"
                value={codeInput}
                onChange={setCodeInput}
                placeholder="e.g. NEWYEAR"
                error={promoNote ?? undefined}
              />
            </div>
            <Button
              type="submit"
              variant="outlined"
              busy={checkingCode}
              disabled={codeInput.trim() === ""}
            >
              Apply
            </Button>
          </form>
        )}
      </div>

      {/*
        Rewards, and only the ones this order can actually spend — see `spendable`. A radio group
        rather than a list of buttons because using a reward and not using one are two answers to
        one question, and "None" has to be reachable after a mis-tap.
      */}
      {spendable.length > 0 ? (
        <fieldset className="mb-lg">
          <legend className="text-title text-ink mb-sm font-medium">Spend a reward</legend>
          <div className="gap-xs flex flex-col">
            {spendable.map(({ redemption, discountNu }) => (
              <label
                key={redemption.id}
                className="gap-md py-sm flex cursor-pointer items-center"
              >
                <input
                  type="radio"
                  name="cart-reward"
                  checked={reward?.redemption.id === redemption.id}
                  onChange={() => setRewardId(redemption.id)}
                  className="accent-rausch-cta size-4"
                />
                <span className="text-body-md text-ink min-w-0 flex-1">
                  {redemption.nameSnapshot}
                  <span className="text-muted"> — {formatNu(discountNu)} off</span>
                </span>
              </label>
            ))}
            <label className="gap-md py-sm flex cursor-pointer items-center">
              <input
                type="radio"
                name="cart-reward"
                checked={reward == null}
                onChange={() => setRewardId(null)}
                className="accent-rausch-cta size-4"
              />
              <span className="text-body-md text-ink">Save it for next time</span>
            </label>
          </div>
        </fieldset>
      ) : null}

      {/*
        The breakdown, and the reason it is a breakdown rather than one number: since the
        checkout columns landed, `total_nu` is not the sum of the lines, and a page showing only
        the line sum as "Total" is showing a price nobody pays. Each row appears only when it is
        non-zero — a pickup order with no code still reads as one clean figure.

        `orderTotals` is a mirror of `place_order`'s arithmetic; the order's own total is what
        the receipt will say. They agree, and the tests are what keep them agreeing.
      */}
      <dl className="border-hairline-soft pt-base gap-xs mb-lg flex flex-col border-t">
        <Row label="Subtotal" value={formatNu(totals.subtotalNu)} />
        {totals.discountNu > 0 ? (
          <Row label="Discount" value={`− ${formatNu(totals.discountNu)}`} tone="discount" />
        ) : null}
        {delivering ? (
          <Row
            label="Delivery"
            value={totals.deliveryFeeNu === 0 ? "Free" : formatNu(totals.deliveryFeeNu)}
          />
        ) : null}
        <div className="border-hairline-soft pt-sm gap-sm mt-xs flex items-baseline border-t">
          <dt className="text-title text-ink flex-1 font-medium">Total</dt>
          <dd className="text-display-sm text-ink font-semibold tabular-nums">
            {formatNu(totals.totalNu)}
          </dd>
        </div>
      </dl>

      <div className="mb-lg">
        <Field
          label={delivering ? "Note for the salon (optional)" : "Pickup note (optional)"}
          value={note}
          onChange={setNote}
          placeholder={delivering ? "e.g. gate is round the back" : "e.g. call when ready"}
        />
      </div>

      <Button fullWidth busy={busy} disabled={!checked} onClick={() => void place()}>
        {/* The total in the button, which is upstream's rule for the product page and the same
            rule here: the last thing read before committing should be what it costs. */}
        Place order · {formatNu(totals.totalNu)}
      </Button>
      <p className="text-caption-sm text-muted mt-sm text-center">
        {delivering
          ? "The salon confirms and sends it out. Nothing is charged online."
          : "The salon confirms and tells you when it\u2019s ready. Nothing is charged online."}
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

/** One line of the checkout breakdown. A `dl`, because each row is a label and its value. */
function Row({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "discount";
}) {
  return (
    <div className="gap-sm flex items-baseline">
      <dt className="text-body-sm text-muted flex-1">{label}</dt>
      <dd
        className={
          tone === "discount"
            ? "text-body-sm text-success-text tabular-nums"
            : "text-body-sm text-ink tabular-nums"
        }
      >
        {value}
      </dd>
    </div>
  );
}
