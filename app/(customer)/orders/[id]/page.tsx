import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderCancelButton } from "@/components/customer/order-cancel-button";
import { Icons, IconSize } from "@/components/ui/icons";
import { OrderDeliveryBlock, OrderLines } from "@/components/ui/order-lines";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusPill } from "@/components/ui/status-pill";
import { fetchMyOrderById } from "@/lib/api/shop";
import {
  canCustomerCancel,
  orderCode,
  orderFulfilment,
  orderPlacedLabel,
  orderStatusLabel,
} from "@/lib/analytics";
import { getAccount } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import type { OrderStatus } from "@/lib/types/back-office";

export const metadata: Metadata = {
  title: "Order",
  robots: { index: false, follow: false },
};

/**
 * One order — a port of `CustomerOrderDetailScreen` in
 * `tho/app/lib/customer/shop/order_detail_screen.dart`.
 *
 * **The read is scoped to the caller, so an owner cannot open a customer's order here.**
 * `fetchMyOrderById` filters on `customer_profile_id`; `orders_select_owner` would otherwise admit
 * the salon's owner and this page would render somebody else's purchase under "My orders". The
 * owner's own view of the same row is `/business/orders/[id]`, which makes the mirror-image check.
 *
 * **Line prices are the snapshots taken when the order was placed.** `name_snapshot` and
 * `price_nu_snapshot` exist so a receipt does not change when the salon edits a price, and `total_nu`
 * is what `place_order` computed server-side — never the cart's subtotal.
 *
 * `Cancel` appears only while the order is `new`, which `canCustomerCancel` decides from the same
 * rule `set_order_status` enforces.
 */
export default async function MyOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const account = await getAccount();
  if (account.state !== "registered") notFound();

  const supabase = await createClient();
  const order = await fetchMyOrderById(supabase, account.user.id, id);
  if (!order) notFound();

  const code = orderCode(order.id);
  const cancellable = canCustomerCancel(order.status);
  const delivery = orderFulfilment(order) === "delivery";

  return (
    <div className="px-base py-lg mx-auto w-full max-w-[720px] tablet:px-lg">
      <Link
        href="/orders"
        className="text-caption text-muted hover:text-ink gap-xs mb-md inline-flex items-center"
      >
        <Icons.back style={{ width: IconSize.xxs, height: IconSize.xxs }} aria-hidden />
        My orders
      </Link>

      <div className="gap-sm mb-xs flex items-center">
        <h1 className="text-display-lg text-ink flex-1 font-medium">{code}</h1>
        {/*
          The value picks the tone, `orderStatusLabel` picks the words — and it takes the audience
          because "Placed" rather than "New" is the customer's word for the same row. The
          conditional used to be written out here and on `/orders`, and in its plain form on both
          owner pages. Passing a label at all is what stopped a delivery order rendering as
          "Out_for_delivery".
        */}
        <StatusPill status={order.status} label={orderStatusLabel(order.status, "customer")} />
      </div>
      <p className="text-body-sm text-muted mb-base">{orderPlacedLabel(order.placedAt)}</p>

      {/* What happens next, in the order's own words. The status pill names the state; this says
          what the customer should do about it, which is the question they opened the page with. */}
      <p className="bg-surface-soft p-md text-body-md text-body mb-lg rounded-md">
        {nextStep(order.status, delivery)}
      </p>

      {order.businessName ? (
        <Link
          href={`/salon/${order.businessId}`}
          className="border-hairline-soft p-md gap-md hover:bg-surface-soft mb-lg flex items-center rounded-md border"
        >
          <span className="bg-surface-soft text-ink grid size-10 shrink-0 place-items-center rounded-sm">
            <Icons.salon style={{ width: IconSize.xs, height: IconSize.xs }} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="text-title text-ink block truncate font-medium">
              {order.businessName}
            </span>
            {/* "Collect and pay here" is wrong for a delivery order — nobody is going to the
                shop. Cash still changes hands, so the sentence says where. */}
            <span className="text-body-sm text-muted block">
              {delivery ? "Delivering to you — pay on arrival" : "Collect and pay here"}
            </span>
          </span>
          <Icons.chevronRight
            className="text-muted-soft shrink-0"
            style={{ width: IconSize.sm, height: IconSize.sm }}
            aria-hidden
          />
        </Link>
      ) : null}

      {order.note ? (
        <>
          <SectionHeader title="Your note" />
          <p className="bg-surface-soft p-base text-body-md text-ink mb-lg rounded-md">
            {order.note}
          </p>
        </>
      ) : null}

      {order.declineReason ? (
        <>
          <SectionHeader title="Why it was declined" />
          <p className="text-body-md text-error-text mb-lg">{order.declineReason}</p>
        </>
      ) : null}

      {/* Heading included — it renders nothing at all on a pickup order, or on a delivery order
          with no address on it. See `OrderDeliveryBlock`. */}
      <OrderDeliveryBlock order={order} title="Delivering to" />

      <SectionHeader title="Items" />
      {/*
        The bottom line's name is the whole point of `totalLabel`: money already handed over,
        money still owed, or money that never changed hands. Three answers rather than two,
        because an order the salon refused or the customer called off owes nothing — and which of
        the three it is depends on the lifecycle, not on one status.
      */}
      <OrderLines order={order} totalLabel={totalLabel(order.status, delivery)} />

      {cancellable ? <OrderCancelButton orderId={order.id} code={code} /> : null}
    </div>
  );
}

/**
 * What to call the total.
 *
 * Three answers, and the third one is the whole reason this is a function. `Paid` is a collected
 * or delivered order; everything still moving is owed, and `delivery` decides where it will be
 * handed over.
 *
 * **`cancelled` and `declined` are neither**, and falling through to the owed branch put
 * *"To pay on collection · Nu 450"* directly beneath `nextStep`'s *"Nothing was charged."* — the
 * receipt asking for money on an order that was called off, on two statuses that are live in the
 * data. The total is still shown, because what the order *would* have cost belongs on a receipt;
 * only the claim on the customer's wallet is withdrawn.
 */
function totalLabel(status: OrderStatus, delivery: boolean): string {
  if (status === "collected" || status === "delivered") return "Paid";
  if (status === "cancelled" || status === "declined") return "Not charged";
  return delivery ? "To pay on delivery" : "To pay on collection";
}

/**
 * What the customer does next. One sentence per state, and never a bare status word.
 *
 * **`delivery` changes the answer for two of the seven states**, which is why it is an argument
 * rather than a detail shown elsewhere: "ready to collect" is actively misleading on an order
 * somebody is about to drive to your house, and `out_for_delivery` had no sentence at all — it
 * fell to the default, *"Your order is with the salon"*, at the exact moment it had left.
 */
function nextStep(status: OrderStatus, delivery: boolean): string {
  switch (status) {
    case "new":
      return delivery
        ? "The salon has your order and will confirm it shortly. You'll hear from us when it's on the way."
        : "The salon has your order and will confirm it shortly. You'll get a notification when it's ready to collect.";
    case "ready":
      return delivery
        ? "Packed and waiting to go out. Have cash ready for the total below when it arrives."
        : "Ready to collect. Bring cash for the total below — the salon is holding it for you.";
    case "out_for_delivery":
      return "On its way to you now. Have cash ready for the total below.";
    case "collected":
      return "Collected and paid. Nothing more to do.";
    case "delivered":
      return "Delivered and paid. Nothing more to do.";
    case "cancelled":
      return "You cancelled this order. Nothing was charged.";
    case "declined":
      return "The salon couldn't fulfil this one. Nothing was charged.";
    default: {
      /*
        Not dead code, and that is the point of it. `toOrder` casts `orders.status` to
        `OrderStatus` without validating it (`lib/api/mappers.ts`), so a value added to the
        database enum arrives here before this union hears about it — which is exactly what
        `20260814000001` did on 2026-08-14. With no branch to land on, this function returned
        `undefined` and the receipt painted an empty grey box where its one instruction goes.

        The `never` assignment is what keeps the exhaustiveness the switch is for: `status` is
        `never` here, so adding a value to `OrderStatus` and forgetting a case is a type error on
        that line rather than a blank box in somebody's browser. Compile-time cover and a runtime
        sentence are not alternatives — the boundary that produces this value is a cast, so only
        one of the two is load-bearing when it actually happens.
      */
      const unrecognised: never = status;
      void unrecognised;
      return "Your order is with the salon.";
    }
  }
}

