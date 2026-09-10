import Link from "next/link";
import { Icons, IconSize } from "@/components/ui/icons";

/**
 * Everything a printed code can lead to, on the one page it leads to.
 *
 * ## Why this exists
 *
 * `/q/<businessId>` used to be a walk-in join form and nothing else, which made the printed
 * poster a **queue** poster: only a salon on Growth+ with the queue switched on could have
 * one, which on the live estate is one salon in ten. Nine shops could not be given a code at
 * all, and the one that could was advertising a single feature.
 *
 * A code stuck to a counter is permanent — that is the whole premise of the thing — so it
 * cannot mean "join the line" for as long as the paper lasts and then need reprinting when
 * the salon starts selling shampoo. It has to mean *"this is us"*. So the destination now
 * carries every way in that the salon actually offers, and the poster is available to all
 * ten.
 *
 * ## The order is the intent, not the feature list
 *
 * Booking is first, because it is the thing a customer standing in front of a poster most
 * often wants and the only one every salon has. The walk-in line is **not** in this list: it
 * is rendered above as the page's primary content when the salon runs one, since somebody who
 * scanned a code in the shop is already there.
 *
 * A row appears only when it leads somewhere real — the shop row is gated on the salon
 * actually having products, exactly as the salon page's own Shop tab is (`products.length >
 * 0`), rather than on the plan allowing them. A plan that permits an empty shelf is not a
 * shop.
 */
export function ScanActions({
  businessId,
  salonName,
  hasShop,
  /** Whether the walk-in form is already on the page above this. */
  queueShownAbove,
}: {
  businessId: string;
  salonName: string;
  hasShop: boolean;
  queueShownAbove: boolean;
}) {
  const rows = [
    {
      href: `/salon/${businessId}/book`,
      icon: Icons.booking,
      label: "Book an appointment",
      blurb: "Pick a time, a service and a stylist",
    },
    ...(hasShop
      ? [
          {
            href: `/salon/${businessId}#shop`,
            icon: Icons.shopBag,
            label: "Browse the shop",
            blurb: "Products to collect at the salon",
          },
        ]
      : []),
    {
      href: `/salon/${businessId}`,
      icon: Icons.salon,
      label: `About ${salonName}`,
      blurb: "Services, prices, photos and reviews",
    },
  ];

  return (
    <section className={queueShownAbove ? "mt-lg" : undefined}>
      <h2 className="text-title text-muted mb-base font-medium">
        {queueShownAbove ? "Or come back another time" : "Ways to visit"}
      </h2>

      <div className="gap-2 flex flex-col">
        {rows.map((row) => (
          <Link
            key={row.href}
            href={row.href}
            className="border-hairline-soft bg-canvas p-base gap-base hover:bg-surface-soft flex items-center rounded-md border transition-colors"
          >
            <row.icon
              style={{ width: IconSize.md, height: IconSize.md }}
              className="text-rausch-cta shrink-0"
              aria-hidden
            />
            <span className="min-w-0 flex-1">
              <span className="text-title block font-medium">{row.label}</span>
              <span className="text-body-sm text-muted block">{row.blurb}</span>
            </span>
            <Icons.chevronRight
              style={{ width: IconSize.sm, height: IconSize.sm }}
              className="text-muted shrink-0"
              aria-hidden
            />
          </Link>
        ))}
      </div>
    </section>
  );
}
