import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NoSalonYet } from "@/components/owner/no-salon-yet";
import { OrderActions } from "@/components/owner/order-actions";
import { Icons, IconSize } from "@/components/ui/icons";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusPill } from "@/components/ui/status-pill";
import { fetchOrderById } from "@/lib/api/owner-back-office";
import { orderCode } from "@/lib/analytics";
import { getOwnerContext } from "@/lib/owner/context";
import { createClient } from "@/lib/supabase/server";
import { formatNu } from "@/lib/utils";

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
        <StatusPill status={order.status === "new" ? "New" : order.status} />
      </div>
      <p className="text-body-sm text-muted mb-lg">{placedLabel(order.placedAt)}</p>

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

      <SectionHeader title="Items" />
      <div className="border-hairline p-base mb-lg rounded-md border">
        <ul className="gap-sm mb-sm flex flex-col">
          {order.items.map((it) => (
            <li key={it.id} className="gap-sm flex items-baseline">
              <span className="text-body-md text-ink min-w-0 flex-1">
                {it.nameSnapshot} × {it.qty}
              </span>
              <span className="text-body-md text-ink tabular-nums">
                {formatNu(it.lineTotalNu)}
              </span>
            </li>
          ))}
        </ul>
        <div className="border-hairline-soft pt-sm gap-sm flex items-baseline border-t">
          <span className="text-title text-ink flex-1 font-medium">Total</span>
          <span className="text-title text-ink font-medium tabular-nums">
            {formatNu(order.totalNu)}
          </span>
        </div>
      </div>

      <OrderActions orderId={order.id} status={order.status} />
    </div>
  );
}

function placedLabel(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Thimphu",
  }).format(d);
}
