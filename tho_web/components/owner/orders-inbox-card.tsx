import Link from "next/link";
import { Icons, IconSize } from "@/components/ui/icons";

/**
 * The Orders quick-link at the top of Insights — a port of
 * `tho/app/lib/business/shop/orders_inbox_card.dart`.
 *
 * **Renders nothing on Basic**, rather than a lock. A Basic salon has no storefront at all —
 * `products_select_public` requires `plan in ('growth','pro')`, so its products are invisible to
 * customers and it can therefore never receive an order — and a locked "Orders" card on a page
 * whose whole job is today's business would be an advert where a fact belongs. The paywall for
 * the storefront lives on `/business/products`, where an owner has gone looking for it.
 *
 * The badge counts `new` orders only. Ready ones are already dealt with as far as the owner's
 * attention goes; the number here is "how many people are waiting for you to act".
 */
export function OrdersInboxCard({ newCount }: { newCount: number }) {
  return (
    <Link
      href="/business/orders"
      className="bg-surface-soft p-base gap-md hover:bg-surface-strong flex items-center rounded-lg"
    >
      <span className="relative shrink-0">
        <span className="bg-canvas text-ink grid size-11 place-items-center rounded-full">
          <Icons.shopBag style={{ width: IconSize.lg, height: IconSize.lg }} aria-hidden />
        </span>
        {newCount > 0 ? (
          <span className="bg-rausch text-on-primary text-badge absolute -top-1 -right-1 grid min-w-4 place-items-center rounded-full px-[5px] py-[1px] font-semibold">
            {newCount > 9 ? "9+" : newCount}
          </span>
        ) : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-title text-ink block font-medium">Orders</span>
        <span className="text-body-sm text-muted block">
          {newCount === 0
            ? "Nothing waiting"
            : `${newCount} new — ${newCount === 1 ? "someone is" : "people are"} waiting`}
        </span>
      </span>
      <Icons.chevronRight
        className="text-muted-soft shrink-0"
        style={{ width: IconSize.sm, height: IconSize.sm }}
        aria-hidden
      />
    </Link>
  );
}
