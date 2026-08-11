"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CoverImage } from "@/components/ui/cover-image";
import { Icons, IconSize } from "@/components/ui/icons";
import { QtyStepper } from "@/components/customer/qty-stepper";
import type { Product } from "@/lib/types/salon";
import { formatNu } from "@/lib/utils";

/**
 * One product, in the cross-salon browse or a salon's Shop tab.
 *
 * **The inline Add is the whole point of the card.** THO-38 in the app was reported as *"product
 * listing is broken of the customer pov and i cant add it to order"* — the browse had exactly one
 * gesture, a hand-off to the salon page, so a customer who found something here had no way to buy it.
 * At a quantity of zero the row offers Add; from one it offers a stepper, so the count is changed in
 * place rather than by reopening a sheet.
 *
 * **Two targets, both explicit.** Tapping the card opens the detail sheet (`onOpen`); the salon's
 * name is a separate link to the salon. Nesting an `<a>` inside a button-like card is invalid HTML
 * and, worse, ambiguous to a keyboard — so the card body is a `<button>` and the salon link sits
 * outside it, which is also what makes each one announce its own destination.
 *
 * `salonName` is present only on the cross-salon browse: the Shop tab already knows whose shelf it
 * is, and repeating the name on every row there would be noise.
 */
export function ProductCard({
  product,
  qty,
  onAdd,
  onSetQty,
  onOpen,
  showSalon,
}: {
  product: Product;
  qty: number;
  onAdd: () => void;
  onSetQty: (qty: number) => void;
  onOpen: () => void;
  showSalon: boolean;
}) {
  return (
    <div className="border-hairline-soft bg-canvas p-sm gap-md flex items-center rounded-md border">
      <button
        type="button"
        onClick={onOpen}
        className="gap-md -m-xs p-xs hover:bg-surface-soft flex min-w-0 flex-1 items-center rounded-sm text-left"
      >
        <span className="size-13 shrink-0 overflow-hidden rounded-sm">
          <CoverImage label={product.name} imageUrl={product.photoUrl} sizes="52px" className="size-full" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="text-title text-ink block truncate font-medium">{product.name}</span>
          <span className="text-body-sm text-muted block">{formatNu(product.priceNu)}</span>
          {product.description ? (
            <span className="text-caption-sm text-muted-soft block truncate">
              {product.description}
            </span>
          ) : null}
        </span>
      </button>

      <div className="gap-xs flex shrink-0 flex-col items-end">
        {qty === 0 ? (
          <Button variant="outlined" onClick={onAdd} className="min-h-10 px-3">
            <Icons.add style={{ width: IconSize.xxs, height: IconSize.xxs }} aria-hidden />
            Add
          </Button>
        ) : (
          <QtyStepper qty={qty} label={product.name} onChange={onSetQty} />
        )}
        {showSalon && product.businessName ? (
          /*
            `#shop`, not the salon root. This linked to the top of the page, which on a salon
            with a cover, an offers section and five services meant the customer arrived
            nowhere near the shelf they had just been looking at and had to hunt for it. The
            app pushes the detail screen with its Shop tab already selected
            (`customer_home.dart:573`); the fragment is this layout's equivalent, and the
            section id it targets is set on `/salon/[id]`.
          */
          <Link
            href={`/salon/${product.businessId}#shop`}
            className="text-caption-sm text-muted hover:text-ink max-w-[10rem] truncate underline"
          >
            {product.businessName}
          </Link>
        ) : null}
      </div>
    </div>
  );
}
