import type { Metadata } from "next";
import Link from "next/link";
import { LockedTeaser } from "@/components/owner/insight-card";
import { NoSalonYet } from "@/components/owner/no-salon-yet";
import { PaywallButton } from "@/components/owner/paywall-button";
import { EmptyState } from "@/components/ui/empty-state";
import { Icons, IconSize } from "@/components/ui/icons";
import { StatusPill } from "@/components/ui/status-pill";
import { fetchOwnerOrders } from "@/lib/api/owner-back-office";
import { ORDER_SEGMENTS, orderCode, orderItemCount, orderSegmentFor } from "@/lib/analytics";
import { hasFeature } from "@/lib/entitlements";
import { getOwnerContext } from "@/lib/owner/context";
import { createClient } from "@/lib/supabase/server";
import { formatNu } from "@/lib/utils";

export const metadata: Metadata = { title: "Orders" };

/**
 * The product-order inbox — a port of `tho/app/lib/business/shop/orders_screen.dart`.
 *
 * Three segments over one query, each fetching **only** the statuses it covers, so the New tab
 * is a small read even for a salon with a year of history behind it. The segment lives in
 * `?status=`, like every other filter in this console.
 *
 * `Done` deliberately gathers three different endings — collected, cancelled by the customer,
 * declined by the salon. They are not the same event, and the rows say which; what they have in
 * common is that there is nothing left to do, which is the only thing a segment needs to mean.
 */
export default async function OwnerOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { active } = await getOwnerContext();
  if (!active) return <NoSalonYet />;

  if (!hasFeature(active.plan, "productStore")) {
    return (
      <div className="px-base py-lg mx-auto w-full max-w-[860px] tablet:px-lg">
        <h1 className="text-display-lg text-ink mb-lg font-medium">Orders</h1>
        <LockedTeaser
          title="Take product orders"
          message="Customers order from your salon page and collect in person. On Growth and Pro."
          action={<PaywallButton feature="productStore" label="See plans" />}
        />
      </div>
    );
  }

  const { status } = await searchParams;
  const segment = orderSegmentFor(status);
  const supabase = await createClient();
  const orders = await fetchOwnerOrders(supabase, active.id, segment.statuses);
  const now = new Date();

  return (
    <div className="px-base py-lg mx-auto w-full max-w-[860px] tablet:px-lg">
      <h1 className="text-display-lg text-ink mb-base font-medium">Orders</h1>

      <nav aria-label="Order status" className="mb-lg">
        <ul className="bg-surface-soft p-xxs flex rounded-full">
          {ORDER_SEGMENTS.map((s) => {
            const on = s.value === segment.value;
            return (
              <li key={s.value} className="flex-1">
                <Link
                  href={`/business/orders?status=${s.value}`}
                  aria-current={on ? "true" : undefined}
                  className={`text-title flex min-h-9 items-center justify-center rounded-full font-medium ${
                    on ? "bg-canvas text-ink shadow-sm" : "text-muted"
                  }`}
                >
                  {s.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {orders.length === 0 ? (
        <EmptyState
          icon={Icons.shopBag}
          title={`No ${segment.label.toLowerCase()} orders`}
          message={segment.value === "new" ? "New product orders show up here." : undefined}
        />
      ) : (
        <ul className="gap-md flex flex-col">
          {orders.map((o) => {
            const count = orderItemCount(o.items);
            return (
              <li key={o.id}>
                <Link
                  href={`/business/orders/${o.id}`}
                  className="border-hairline-soft p-base gap-sm hover:bg-surface-soft flex items-center rounded-md border"
                >
                  <span className="min-w-0 flex-1">
                    <span className="gap-sm flex items-center">
                      <span className="text-title text-ink truncate font-medium">
                        {orderCode(o.id)}
                      </span>
                      <StatusPill status={o.status === "new" ? "New" : o.status} />
                    </span>
                    <span className="text-body-sm text-muted block">
                      {count} {count === 1 ? "item" : "items"} · {formatNu(o.totalNu)}
                    </span>
                  </span>
                  <span className="text-caption-sm text-muted-soft shrink-0">
                    {relativeAge(o.placedAt, now)}
                  </span>
                  <Icons.chevronRight
                    className="text-muted-soft shrink-0"
                    style={{ width: IconSize.xxs, height: IconSize.xxs }}
                    aria-hidden
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** `now` · `5m` · `3h` · `2d` · `4w` — the same compact scale the notifications list uses. */
function relativeAge(then: Date, now: Date): string {
  const minutes = Math.floor((now.getTime() - then.getTime()) / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}
