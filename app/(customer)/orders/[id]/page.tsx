import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderCancelButton } from "@/components/customer/order-cancel-button";
import { Icons, IconSize } from "@/components/ui/icons";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusPill } from "@/components/ui/status-pill";
import { fetchMyOrderById } from "@/lib/api/shop";
import { canCustomerCancel, orderCode } from "@/lib/analytics";
import { getAccount } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { formatNu } from "@/lib/utils";

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
        <StatusPill status={order.status === "new" ? "Placed" : order.status} />
      </div>
      <p className="text-body-sm text-muted mb-base">{placedLabel(order.placedAt)}</p>

      {/* What happens next, in the order's own words. The status pill names the state; this says
          what the customer should do about it, which is the question they opened the page with. */}
      <p className="bg-surface-soft p-md text-body-md text-body mb-lg rounded-md">
        {nextStep(order.status)}
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
            <span className="text-body-sm text-muted block">Collect and pay here</span>
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

      <SectionHeader title="Items" />
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
        <div className="border-hairline-soft pt-sm gap-sm flex items-baseline border-t">
          <span className="text-title text-ink flex-1 font-medium">
            {order.status === "collected" ? "Paid" : "To pay on collection"}
          </span>
          <span className="text-title text-ink font-medium tabular-nums">
            {formatNu(order.totalNu)}
          </span>
        </div>
      </div>

      {cancellable ? <OrderCancelButton orderId={order.id} code={code} /> : null}
    </div>
  );
}

/** What the customer does next. One sentence per state, and never a bare status word. */
function nextStep(status: string): string {
  switch (status) {
    case "new":
      return "The salon has your order and will confirm it shortly. You'll get a notification when it's ready to collect.";
    case "ready":
      return "Ready to collect. Bring cash for the total below — the salon is holding it for you.";
    case "collected":
      return "Collected and paid. Nothing more to do.";
    case "cancelled":
      return "You cancelled this order. Nothing was charged.";
    case "declined":
      return "The salon couldn't fulfil this one. Nothing was charged.";
    default:
      return "Your order is with the salon.";
  }
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
