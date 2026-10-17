import type { OrderFulfilment } from "./types/back-office";

/**
 * What a product order comes to — a mirror of the arithmetic inside `place_order`.
 *
 * ## The SQL is normative, and this file is the copy
 *
 * `place_order` computes the total from `products.price_nu` server-side and returns it; the
 * number this file produces never reaches the database. So **if the two disagree, this one is
 * wrong**, and the fix belongs here rather than in a migration. Every function below is a
 * line-for-line port of a specific piece of the deployed function, named in its own comment,
 * and the tests are written against the SQL's behaviour rather than against this code.
 *
 * It exists because a checkout that cannot state a total until after the order is placed is not
 * a checkout. The customer has to see the promo come off, the delivery fee go on, and what they
 * will actually hand over at the counter, **before** the button. That is the same reason the
 * app's product detail page moved the total into the button: *the last thing read before
 * committing should be what it costs.*
 *
 * ## Everything is whole Nu, and the rounding is the server's
 *
 * `price_nu`, `value`, `delivery_fee_nu` and `free_delivery_over_nu` are all `integer`, and the
 * one division — a percentage — is `floor`ed in SQL. A client that rounded instead would be a
 * Nu out on roughly half of all percentage promos, which is exactly the size of error nobody
 * reports and everybody notices.
 */

/** `promo_codes.kind`. `amount` is a flat number of Nu; anything unrecognised behaves as `amount`. */
export type PromoKind = "percent" | "amount";

/**
 * Why a code was refused, as `preview_promo` and `place_order` both name it.
 *
 * The tokens are the server's; the sentences are `promoRefusalMessage`'s. Two reasons for the
 * split: `preview_promo` returns the token in JSON and composes no sentence at all, and
 * `place_order`'s own sentences are written for an app that shows raw error text. A page can say
 * it better, and must not say it differently.
 */
export type PromoRefusal =
  | "not_found"
  | "inactive"
  | "not_started"
  | "expired"
  | "limit_reached"
  | "below_minimum";

/**
 * What a promo or a discount reward takes off a subtotal — `private.promo_discount_nu`.
 *
 * ```sql
 * select greatest(
 *   case when p_kind = 'percent'
 *        then floor(greatest(p_subtotal, 0) * least(greatest(p_value, 0), 100) / 100.0)::int
 *        else greatest(coalesce(p_value, 0), 0)
 *   end, 0);
 * ```
 *
 * Three details that are easy to drop and each change a number somebody pays:
 *
 * - **The percentage is clamped to 100, the amount is not clamped at all.** A flat Nu 500 off a
 *   Nu 300 order returns 500 from here. That is not a bug and must not be "fixed" locally — the
 *   cap is applied once, later, against the *combined* discount in `orderTotals`, because a
 *   promo and a reward can stack and only their sum is meaningfully capped.
 * - **`floor`, not round.** 15% of Nu 1,290 is 193.5, and the customer is charged the discount
 *   of 193 rather than 194.
 * - A negative value or a negative subtotal contributes nothing rather than adding.
 */
export function promoDiscountNu(
  kind: string | null | undefined,
  value: number | null | undefined,
  subtotalNu: number,
): number {
  if (kind === "percent") {
    const pct = Math.min(Math.max(value ?? 0, 0), 100);
    return Math.floor((Math.max(subtotalNu, 0) * pct) / 100);
  }
  return Math.max(value ?? 0, 0);
}

/**
 * A refused code, in words the page can show.
 *
 * `below_minimum` deliberately does not name the minimum: `preview_promo` returns the reason and
 * nothing else, so the figure is not in hand, and inventing "spend Nu 200 more" from a number
 * this side does not have is how a checkout comes to state a threshold the server disagrees
 * with. It says what to do instead.
 */
export function promoRefusalMessage(reason: PromoRefusal | string): string {
  switch (reason) {
    case "inactive":
      return "That code is no longer active.";
    case "not_started":
      return "That code isn't active yet.";
    case "expired":
      return "That code has expired.";
    case "limit_reached":
      return "That code has been fully used up.";
    case "below_minimum":
      return "That code needs a larger order. Add a little more and try again.";
    // `not_found`, and anything a later migration adds. A code somebody mistyped and a code
    // this salon never had are the same event to the person typing it.
    default:
      return "That code isn't valid at this salon.";
  }
}

/**
 * What a pending loyalty redemption is worth against a product order — the `type_snapshot` arm
 * of `place_order`.
 *
 * ```sql
 * if v_red.type_snapshot = 'percent_discount' then promo_discount_nu('percent', percent_off, …)
 * elsif v_red.type_snapshot = 'fixed_discount' then promo_discount_nu('amount',  amount_nu,  …)
 * else raise 'that reward cannot be applied to a product order' using errcode = 'P0004';
 * ```
 *
 * **Null means the reward cannot be spent here at all**, and that is the load-bearing case
 * rather than an edge: the only pending redemption on this platform today is a `free_service`,
 * which is a haircut and not a discount on shampoo. A checkout that offered it would be offering
 * the customer's one reward and then meeting them with `P0004`. So the picker filters on this
 * returning a number, and a reward that cannot be applied is never shown as though it could be.
 */
export function redemptionDiscountNu(
  typeSnapshot: string | null | undefined,
  valueSnapshot: Record<string, unknown> | null | undefined,
  subtotalNu: number,
): number | null {
  const int = (key: string) => {
    const raw = valueSnapshot?.[key];
    const n = typeof raw === "string" ? Number(raw) : raw;
    return typeof n === "number" && Number.isFinite(n) ? Math.trunc(n) : 0;
  };
  if (typeSnapshot === "percent_discount") {
    return promoDiscountNu("percent", int("percent_off"), subtotalNu);
  }
  if (typeSnapshot === "fixed_discount") {
    return promoDiscountNu("amount", int("amount_nu"), subtotalNu);
  }
  return null;
}

export type OrderTotals = {
  subtotalNu: number;
  /** Promo and reward combined, capped at the subtotal. A positive magnitude. */
  discountNu: number;
  /** Zero on pickup, and zero on a delivery the salon is giving away. */
  deliveryFeeNu: number;
  totalNu: number;
};

/**
 * The whole sum, as `place_order` performs it:
 *
 * ```sql
 * v_discount := greatest(least(v_promo_off + v_loyal_off, v_subtotal), 0);
 * if delivery then
 *   v_fee := greatest(coalesce(delivery_fee_nu, 0), 0);
 *   if free_delivery_over_nu is not null and (v_subtotal - v_discount) >= free_delivery_over_nu
 *     then v_fee := 0;
 * v_total := v_subtotal - v_discount + v_fee;
 * ```
 *
 * ## The two orderings that decide the answer
 *
 * **The discount is capped once, on the sum.** A Nu 400 promo and a Nu 300 reward against a
 * Nu 500 order take off 500, not 700, and the total before delivery is zero rather than
 * negative. Capping each separately would take off 500 too here but not in general, and would
 * diverge from the server the moment either was uncapped.
 *
 * **Free delivery is judged on what is left after the discount, not on the subtotal.** So a
 * discount can *lose* a customer their free delivery: Nu 1,000 of shampoo at a salon that
 * delivers free over Nu 1,000 arrives free, and the same order with a Nu 100 code off is
 * Nu 900 and pays the fee. That reads as unfair and is exactly what the SQL does, so it is what
 * this does — a checkout whose total disagrees with the order is worse than one whose rule is
 * surprising, and the customer sees both lines before they commit.
 *
 * Delivery is charged strictly on the chosen fulfilment. Whether the salon *offers* it at all is
 * `Business.deliveryEnabled`, checked before the toggle is drawn and again by the server.
 */
export function orderTotals({
  subtotalNu,
  promoDiscountNu: promoOff = 0,
  rewardDiscountNu: rewardOff = 0,
  fulfilment,
  deliveryFeeNu = 0,
  freeDeliveryOverNu = null,
}: {
  subtotalNu: number;
  promoDiscountNu?: number;
  rewardDiscountNu?: number;
  fulfilment: OrderFulfilment;
  deliveryFeeNu?: number | null;
  freeDeliveryOverNu?: number | null;
}): OrderTotals {
  const subtotal = Math.max(subtotalNu, 0);
  const discount = Math.max(Math.min(promoOff + rewardOff, subtotal), 0);

  let fee = 0;
  if (fulfilment === "delivery") {
    fee = Math.max(deliveryFeeNu ?? 0, 0);
    if (freeDeliveryOverNu != null && subtotal - discount >= freeDeliveryOverNu) fee = 0;
  }

  return {
    subtotalNu: subtotal,
    discountNu: discount,
    deliveryFeeNu: fee,
    totalNu: subtotal - discount + fee,
  };
}
