import { SectionHeader } from "@/components/ui/section-header";
import type { Order } from "@/lib/types/back-office";
import { orderFulfilment } from "@/lib/analytics";
import { formatNu } from "@/lib/utils";

/**
 * An order's lines and what they add up to — shared by the customer's receipt
 * (`/orders/[id]`) and the owner's copy of the same order (`/business/orders/[id]`).
 *
 * It lives in `components/ui/` for the reason `StatusPill` does: both roles need it, and
 * `components/owner/` reaching into `components/customer/` (or the reverse) would be the wrong
 * dependency. Both pages had their own copy of the items block before this, which is how they
 * came to disagree about the total.
 *
 * ## The total is not the sum of the lines, and printing it as if it were was a lie
 *
 * `20260814000005_place_order_checkout.sql` made `place_order` compute
 * `subtotal − discount + delivery fee` server-side, where `discount` is a promo code, points
 * spent at checkout, or both. Both pages summed nothing — they printed `total_nu` under the
 * lines — so on a discounted order the lines and the total simply did not reconcile, with
 * nothing on the page to explain the difference. A receipt that cannot be checked by adding it
 * up is not a receipt.
 *
 * So the breakdown is shown **only when it says something**: an order with no discount and no
 * delivery fee has `subtotal === total`, and a Subtotal row repeating the Total row directly
 * above it is noise. Rows appear when they carry information — which is also why an order placed
 * before that migration renders exactly as it always did, not because its columns are missing
 * (they are `not null`, and `subtotal_nu` was backfilled) but because on such an order there is
 * genuinely nothing to break down.
 *
 * ## `discount_nu` is a positive magnitude
 *
 * The SQL is `total = subtotal - discount + fee`, so the column holds the amount taken off, not
 * a negative adjustment. The minus sign is supplied here, by the display — the same rule
 * `paymentLine` follows for a refund, and the same trap: re-signing a value that is already
 * signed is how the payments ledger once made a refund increase what somebody had paid.
 */
export function OrderLines({
  order,
  /** What the bottom line is called. The two roles ask different questions of the same number. */
  totalLabel,
}: {
  order: Order;
  totalLabel: string;
}) {
  const discount = order.discountNu;
  const fee = order.deliveryFeeNu;
  const delivery = orderFulfilment(order) === "delivery";

  /*
    A subtotal earns its row when something moves it, and nothing else decides. There was a
    `subtotalNu != null` conjunct here — the "pre-checkout" guard — plus a `!` on the row below
    to get past the null it had just ruled out. Both were serving a state the database does not
    have: the column is `not null` and was backfilled from `total_nu`. See `Order`.
  */
  const showBreakdown = discount > 0 || fee > 0 || delivery;

  return (
    <div className="border-hairline p-base mb-lg rounded-md border">
      <ul className="gap-sm mb-sm flex flex-col">
        {order.items.map((item) => (
          <li key={item.id} className="gap-sm flex items-baseline">
            <span className="text-body-md text-ink min-w-0 flex-1">
              {item.nameSnapshot} × {item.qty}
            </span>
            <span className="text-body-md text-ink tabular-nums">
              {formatNu(item.lineTotalNu)}
            </span>
          </li>
        ))}
      </ul>

      {showBreakdown ? (
        <ul className="border-hairline-soft pt-sm gap-xs mb-sm flex flex-col border-t">
          <Row label="Subtotal" value={formatNu(order.subtotalNu)} />
          {discount > 0 ? (
            <Row label="Discount" value={`−${formatNu(discount)}`} tone="success" />
          ) : null}
          {delivery ? (
            /* Free delivery is a real state, not a missing fee: `place_order` waives the charge
               once the discounted subtotal clears `free_delivery_over_nu`. Printing "Nu 0" would
               read like a broken figure where "Free" reads like the salon's offer. */
            <Row label="Delivery" value={fee > 0 ? formatNu(fee) : "Free"} />
          ) : null}
        </ul>
      ) : null}

      <div className="border-hairline-soft pt-sm gap-sm flex items-baseline border-t">
        <span className="text-title text-ink flex-1 font-medium">{totalLabel}</span>
        <span className="text-title text-ink font-medium tabular-nums">
          {formatNu(order.totalNu)}
        </span>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success";
}) {
  return (
    <li className="gap-sm flex items-baseline">
      <span className="text-body-sm text-muted min-w-0 flex-1">{label}</span>
      {/*
        A template literal rather than `cn`, deliberately: this carries a size class and a
        colour class, and `twMerge` files both under *colour* and silently drops one — the trap
        `lib/utils.ts` documents and the one that turned the guide's hotspot label into an
        unreadable black box. Nothing here needs merging, so nothing merges it.
      */}
      <span
        className={`text-body-sm tabular-nums ${tone === "success" ? "text-success-text" : "text-body"}`}
      >
        {value}
      </span>
    </li>
  );
}

/**
 * Where a delivery order is going.
 *
 * Rendered for both roles, and it is the owner who needs it most: without it the console shows a
 * "Send out for delivery" button and no address to send it to. The customer's copy is the receipt
 * for what they typed — and the reason the privacy policy now says a delivery address is stored
 * and shared with the salon.
 *
 * Returns null for a pickup order and for a delivery order with no address, rather than an empty
 * box: `delivery_address` is nullable — measured, and the only one of the delivery columns that
 * is — and an "Address" heading over nothing is worse than silence.
 *
 * **The heading is rendered here, which is why it takes a `title`.** Both callers used to draw
 * their own `SectionHeader` and gate it on fulfilment alone, so the address check inside this
 * component could still leave *"Delivering to"* sitting directly on top of the Items block. A
 * guard that decides whether something is worth showing has to own the label for it; splitting
 * the two across a component boundary is how the second condition got lost. The words stay with
 * the caller because the two roles genuinely say different ones — "Delivering to" to the person
 * receiving it, "Deliver to" to the person sending it.
 */
export function OrderDeliveryBlock({ order, title }: { order: Order; title: string }) {
  if (orderFulfilment(order) !== "delivery") return null;
  if (!order.deliveryAddress) return null;

  return (
    <>
      <SectionHeader title={title} />
      <div className="border-hairline p-base mb-lg gap-xs flex flex-col rounded-md border">
        <p className="text-body-md text-ink whitespace-pre-line">{order.deliveryAddress}</p>
        {order.deliveryPhone ? (
          <p className="text-body-sm text-muted">{order.deliveryPhone}</p>
        ) : null}
        {order.deliveryNote ? (
          <p className="text-body-sm text-body">{order.deliveryNote}</p>
        ) : null}
      </div>
    </>
  );
}
