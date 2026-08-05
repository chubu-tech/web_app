import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Icons, IconSize } from "@/components/ui/icons";
import { StatusPill } from "@/components/ui/status-pill";
import { fetchMyOrders } from "@/lib/api/shop";
import { orderCode, orderItemCount } from "@/lib/analytics";
import { relativeAge } from "@/lib/chat-logic";
import { getAccount } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { formatNu } from "@/lib/utils";

export const metadata: Metadata = {
  title: "My orders",
  robots: { index: false, follow: false },
};

/**
 * The customer's own product orders — a port of `MyOrdersScreen` in
 * `tho/app/lib/customer/shop/my_orders_screen.dart`.
 *
 * **One flat list, no segments**, matching the app and for its stated reason: a customer's own order
 * history is small where the owner's inbox needed New / Ready / Done. The two live orders on this
 * account are one `new` and one `ready`, which is the whole spread.
 *
 * **Registered only.** `place_order` requires `private.is_real_user()`, so a guest cannot hold an
 * order and has nothing to list — the same wall `/messages` draws, and for the same reason.
 *
 * `fetchMyOrders` filters on `customer_profile_id` rather than leaning on RLS. That matters here more
 * than anywhere else in 2f: `orders_select_owner` also admits a salon's owner, so without the filter
 * this page would show an owner their salon's orders as if they had placed them — which is exactly
 * what `Api.myOrders()` does today.
 */
export default async function MyOrdersPage() {
  const account = await getAccount();

  if (account.state !== "registered") {
    return (
      <Shell>
        <EmptyState
          icon={Icons.shopBag}
          title="Orders need an account"
          message="A salon needs to know who to hand an order to, so ordering is one of the few things a visitor can't do."
          action={
            <Link href={`/sign-${account.state === "guest" ? "up" : "in"}?next=/orders`}>
              <Button>{account.state === "guest" ? "Create an account" : "Sign in"}</Button>
            </Link>
          }
        />
      </Shell>
    );
  }

  const supabase = await createClient();
  const orders = await fetchMyOrders(supabase, account.user.id).catch(() => []);

  if (orders.length === 0) {
    return (
      <Shell>
        <EmptyState
          icon={Icons.shopBag}
          title="No orders yet"
          message="Products you order from a salon's shop show up here, with what to pay on collection."
          action={
            <Link href="/?tab=products">
              <Button variant="outlined">Browse products</Button>
            </Link>
          }
        />
      </Shell>
    );
  }

  // Resolved once on the server so every relative age on the page agrees — the rule 2d set for the
  // inbox and the conversation list.
  const now = new Date();

  return (
    <Shell>
      <ul className="gap-md flex flex-col">
        {orders.map((order) => {
          const count = orderItemCount(order.items);
          return (
            <li key={order.id}>
              <Link
                href={`/orders/${order.id}`}
                className="border-hairline-soft p-base gap-sm hover:bg-surface-soft flex items-start rounded-md border"
              >
                <span className="min-w-0 flex-1">
                  <span className="gap-sm flex items-center">
                    <span className="text-title text-ink truncate font-medium">
                      {orderCode(order.id)}
                    </span>
                    <StatusPill status={order.status === "new" ? "Placed" : order.status} />
                  </span>
                  {order.businessName ? (
                    <span className="text-body-sm text-muted block truncate">
                      {order.businessName}
                    </span>
                  ) : null}
                  <span className="text-body-sm text-muted block">
                    {count} {count === 1 ? "item" : "items"} · {formatNu(order.totalNu)}
                  </span>
                </span>
                <span className="text-caption-sm text-muted-soft shrink-0">
                  {relativeAge(order.placedAt, now)}
                </span>
                <Icons.chevronRight
                  className="text-muted-soft mt-xxs shrink-0"
                  style={{ width: IconSize.xxs, height: IconSize.xxs }}
                  aria-hidden
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-base py-lg mx-auto w-full max-w-[720px] tablet:px-lg">
      <h1 className="text-display-lg text-ink mb-lg font-medium">My orders</h1>
      {children}
    </div>
  );
}
