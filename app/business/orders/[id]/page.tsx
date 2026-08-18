import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NoSalonYet } from "@/components/owner/no-salon-yet";
import { OrderActions } from "@/components/owner/order-actions";
import { Icons, IconSize } from "@/components/ui/icons";
import { OrderDeliveryBlock, OrderLines } from "@/components/ui/order-lines";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusPill } from "@/components/ui/status-pill";
import { fetchOrderById } from "@/lib/api/owner-back-office";
import { orderCode, orderFulfilment, orderPlacedLabel, orderStatusLabel } from "@/lib/analytics";
import { getOwnerContext } from "@/lib/owner/context";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Order" };

/**
 * One order — a port of `tho/app/lib/business/shop/order_detail_screen.dart`.
 *
 * **The salon check is explicit, not left to RLS.** `orders_select_customer` also admits the
 * *buyer*, so an owner who has bought from another salon could otherwise open that order inside
 * their own console and be offered actions the RPC would refuse. So the row's `business_id` has
 * to match the active salon or this 404s — the same correction `fetchBusinessBookingById` needed
 * in 3a.
 *
 * Prices are the **snapshots** taken when the order was placed, never today's `products.price_nu`.
 * That is what `name_snapshot` and `price_nu_snapshot` are for: a receipt that changes when the
 * owner edits a price is not a receipt.
 */
export default async function OwnerOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { active } = await getOwnerContext();
  if (!active) return <NoSalonYet />;

  const { id } = await params;
  const supabase = await createClient();
  const order = await fetchOrderById(supabase, id);
  if (!order || order.businessId !== active.id) notFound();

  /*
    Resolved once and passed down, rather than each consumer reading the column for itself: the
    actions, the delivery block and the totals must all agree about which lifecycle this order is
    on, and `orderFulfilment` is the one place that decides.
  */
  const fulfilment = orderFulfilment(order);

  return (
    <div className="px-base py-lg mx-auto w-full max-w-[720px] tablet:px-lg">
      <Link
        href="/business/orders"
        className="text-caption text-muted hover:text-ink gap-xs mb-md inline-flex items-center"
      >
        <Icons.back style={{ width: IconSize.xxs, height: IconSize.xxs }} aria-hidden />
        Orders
      </Link>

      <div className="gap-sm mb-xs flex items-center">
        <h1 className="text-display-lg text-ink flex-1 font-medium">{orderCode(order.id)}</h1>
        {/*
          The value decides the colour, `orderStatusLabel` decides the words. Passing the label
          as `status` — which is what this did — title-cased the wire value, so the two delivery
          statuses read "Out_for_delivery" and "Delivered" while `cancelled` lost its muted tone
          the moment anybody "fixed" the words. The table behind it is
          `Record<OrderStatus, string>`, so the next enum value is a type error there rather than
          a blank pill; the audience argument is what keeps the customer's "Placed" out of the
          salon's console without a second conditional written here.
        */}
        <StatusPill status={order.status} label={orderStatusLabel(order.status, "owner")} />
      </div>
      <p className="text-body-sm text-muted mb-lg">{orderPlacedLabel(order.placedAt)}</p>

      {order.note ? (
        <>
          <SectionHeader title="Customer note" />
          <p className="bg-surface-soft p-base text-body-md text-ink mb-lg rounded-md">
            {order.note}
          </p>
        </>
      ) : null}

      {order.declineReason ? (
        <>
          <SectionHeader title="Decline reason" />
          <p className="text-body-md text-error-text mb-lg">{order.declineReason}</p>
        </>
      ) : null}

      {/*
        Delivery, before the items — an owner reading this page while the driver waits needs the
        address above the prices, not under them. Heading included, and the whole thing renders
        nothing on a pickup order or on a delivery order with no address recorded.
      */}
      <OrderDeliveryBlock order={order} title="Deliver to" />

      <SectionHeader title="Items" />
      <OrderLines order={order} totalLabel="Total" />

      <OrderActions orderId={order.id} status={order.status} fulfilment={fulfilment} />
    </div>
  );
}

