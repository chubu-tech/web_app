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
 *
 * ## It does not go stale, and that is a property of the route rather than of this card
 *
 * The app's own card re-reads the count on two paths — when the inbox pops, and on the home's
 * pull-to-refresh — because it owns its fetch and nothing else would ever move the number. Here
 * the count is a prop of a **dynamic** server route with no `staleTimes` override, so Next's
 * client router refetches the RSC payload on every arrival: coming back from the inbox re-renders
 * the page, and so does the `router.refresh()` every order write already performs. There is
 * nothing to port, which is worth saying because the obvious reading of the upstream diff is that
 * a `reloadTick` prop is missing here.
 *
 * ## A count that could not be read is not a count of zero
 *
 * `null` renders the card with no badge and no claim. It used to be `.catch(() => 0)` at the call
 * site, which turned a failed read into **"Nothing waiting"** — the card's whole job is to say
 * whether somebody is waiting, so the one number it must never invent is that one. The app keeps
 * its last known count for the same reason; a server render has no last count to keep, so it says
 * nothing instead.
 */
export function OrdersInboxCard({ newCount }: { newCount: number | null }) {
  return (
    <Link
      href="/business/orders"
      className="bg-surface-soft p-base gap-md hover:bg-surface-strong flex items-center rounded-lg"
    >
      <span className="relative shrink-0">
        <span className="bg-canvas text-ink grid size-11 place-items-center rounded-full">
          <Icons.shopBag style={{ width: IconSize.lg, height: IconSize.lg }} aria-hidden />
        </span>
        {newCount != null && newCount > 0 ? (
          <span className="bg-rausch text-on-primary text-badge absolute -top-1 -right-1 grid min-w-4 place-items-center rounded-full px-[5px] py-[1px] font-semibold">
            {newCount > 9 ? "9+" : newCount}
          </span>
        ) : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-title text-ink block font-medium">Orders</span>
        <span className="text-body-sm text-muted block">
          {newCount == null
            ? "Open the inbox"
            : newCount === 0
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
