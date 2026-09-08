"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CoverImage } from "@/components/ui/cover-image";
import { Icons, IconSize } from "@/components/ui/icons";
import { RatingPill } from "@/components/ui/rating";
import { Sheet } from "@/components/ui/sheet";
import { QtyStepper } from "@/components/customer/qty-stepper";
import { discountPercent, isDiscounted, type Product } from "@/lib/types/salon";
import { formatNu } from "@/lib/utils";

type SheetProps = {
  qty: number;
  onSetQty: (qty: number) => void;
  /** Adds this many at once — see `useOrderCart`, which is why it is not add-then-set. */
  onAdd: (qty: number) => void;
  onClose: () => void;
};

/**
 * A product's detail and quantity — the sheet form of
 * `tho/app/lib/customer/shop/product_detail_screen.dart`.
 *
 * **Deliberately cart-free**, exactly as the Dart is: it reports a quantity through
 * `onSetQty` and lets the host — which owns the cart — decide what that means, *including
 * refusing the add because the order belongs to another salon*. A sheet that wrote to the
 * cart itself could not offer that choice, and the one-salon rule is where the interesting
 * case lives.
 *
 * ## The buy bar, which is the behaviour fix rather than a repaint
 *
 * The stepper used to **replace** the Add button once the product was in the order. So the
 * customer chose the amount in one state and acted in another, the total was stated nowhere,
 * and from the second state the sheet offered no way forward at all — only Close. It is now
 * `[how many][what that costs]`, side by side and both present at once, which is upstream's
 * shape: **"Add to order · Nu 1,200"** becoming **"View order · Nu 1,200"**.
 *
 * Three details there are each load-bearing:
 *
 * - **The total goes *in* the button.** The last thing read before committing should be what
 *   it costs, not a number two taps away.
 * - **It is this product's line, not the order subtotal.** The cart bar elsewhere speaks for
 *   the order; this button is about the thing being decided on.
 * - **Out of stock keeps the bar and disables it.** Removing it moved the content up under
 *   the customer's finger and left no visible reason why the thing could not be bought.
 *
 * ## Reading order
 *
 * What is it → can I trust it → what does it cost: name (the sheet's own title), brand, then
 * the rating, then the price at its own rank. The rating was a footnote under the price and
 * the price wore the title's exact style, so neither led. The name is the sheet's chrome
 * rather than repeated in the body — upstream's own note about the detail screen is that the
 * same string 40 points from itself is the same string twice.
 *
 * The photo is the reason this exists rather than a bigger card: a card carries a name and a
 * price, and a customer deciding between two shampoos wants the description and a look at
 * the bottle.
 *
 * **Still a sheet, not a route.** The full `/product/[id]` page — the gallery with its
 * counter, verified-purchase reviews, "customers also bought", and `record_product_view` —
 * needs `product_photos`, `product_reviews` and `product_copurchases`, which land with the
 * rest of the shop rework. `ProductDetailBody` below is exported so that page can render the
 * identical content block rather than a second interpretation of it.
 */
export function ProductSheet({ product, ...rest }: SheetProps & { product: Product | null }) {
  if (!product) return null;
  /*
    **Keyed on the product**, which is how the pre-add quantity below resets when the sheet
    opens on something else — without it, the three a customer chose for a shampoo would
    greet the next thing they tapped.

    A `useEffect` that called `setPending(1)` would do the same job and is what the obvious
    version does; `react-hooks/set-state-in-effect` refuses it, correctly, because it
    cascades a render for a value that was knowable without one. Remounting is React's own
    answer to "reset state when a prop changes", and `use-cart.ts` records the same lesson.
  */
  return <OpenProductSheet key={product.id} product={product} {...rest} />;
}

function OpenProductSheet({
  product,
  qty,
  onSetQty,
  onAdd,
  onClose,
}: SheetProps & { product: Product }) {
  const router = useRouter();
  /*
    The pre-add choice. **Dialling it writes nothing to the cart**, so a customer who decides
    on three does not send three separate adds — and, more to the point, does not commit to
    the first one just by touching the control.
  */
  const [pending, setPending] = useState(1);

  const inOrder = qty > 0;
  // What the selector shows: the cart's own count once this is in the order, the pre-add
  // choice before that.
  const shownQty = inOrder ? qty : pending;
  const lineTotal = product.priceNu * shownQty;

  function changeQty(next: number) {
    if (inOrder) {
      onSetQty(next);
      return;
    }
    // Clamped, and **zero resets the offer to one rather than to nothing**: there is no line
    // to remove yet, so a stepper that could reach zero would leave the button offering to
    // add nothing at all.
    setPending(Math.min(99, Math.max(1, next)));
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={product.name}
      footer={
        !product.inStock ? (
          <Button fullWidth disabled>
            Out of stock
          </Button>
        ) : (
          <div className="gap-md flex items-center">
            <span className="gap-xs flex shrink-0 items-center">
              <QtyStepper qty={shownQty} label={product.name} onChange={changeQty} />
              {product.volume ? (
                /*
                  The unit rides inside the selector: "2" means nothing on its own, and
                  "2 × 200 ml" is the sentence the customer is agreeing to. It must not live
                  in the product's name, where changing the quantity would make the name a lie.
                */
                <span className="text-caption-sm text-muted whitespace-nowrap">
                  × {product.volume}
                </span>
              ) : null}
            </span>
            <Button
              fullWidth
              onClick={() => {
                if (inOrder) {
                  onClose();
                  router.push("/cart");
                  return;
                }
                // One call carrying the chosen count. `onAdd` is the host's, and it is
                // what raises the one-salon question when the order belongs elsewhere.
                onAdd(pending);
              }}
            >
              {inOrder ? "View order" : "Add to order"} · {formatNu(lineTotal)}
            </Button>
          </div>
        )
      }
    >
      <ProductDetailBody product={product} />
    </Sheet>
  );
}

/**
 * Everything about the product that is not the buy bar — shared with the future
 * `/product/[id]` route so the two cannot describe the same product differently.
 */
export function ProductDetailBody({ product }: { product: Product }) {
  const off = discountPercent(product);

  return (
    <div className="gap-base flex flex-col">
      <div className="aspect-[4/3] w-full overflow-hidden rounded-md">
        <CoverImage
          label={product.name}
          imageUrl={product.photoUrl}
          sizes="(min-width: 744px) 560px, 100vw"
        />
      </div>

      <div>
        {product.brandName ? (
          <p className="text-caption text-muted font-medium">{product.brandName}</p>
        ) : null}
        {/* Directly under the title, where it was a footnote below the price. */}
        <div className="mt-xxs">
          <RatingPill rating={product.ratingAvg} count={product.ratingCount} />
        </div>

        {/* The price at its own rank — `display-md`, a step above everything around it. */}
        <p className="gap-xs mt-sm flex flex-wrap items-baseline">
          <span className="text-display-md text-ink font-semibold tabular-nums">
            {formatNu(product.priceNu)}
          </span>
          {product.volume ? (
            <span className="text-body-sm text-muted">/ {product.volume}</span>
          ) : null}
          {isDiscounted(product) ? (
            <>
              <span className="text-body-sm text-muted-soft line-through tabular-nums">
                {formatNu(product.compareAtNu!)}
              </span>
              {/* U+2212, not a hyphen — a quantity going down. */}
              <span className="bg-rausch-cta text-on-primary text-badge px-xxs rounded-sm py-[1px] font-semibold">
                −{off}%
              </span>
            </>
          ) : null}
        </p>
      </div>

      {product.description ? (
        <p className="text-body-md text-body">{product.description}</p>
      ) : (
        <p className="text-body-sm text-muted">No description for this one.</p>
      )}

      <ProductFacts product={product} />

      {product.businessName ? (
        <Link
          href={`/salon/${product.businessId}#shop`}
          className="border-hairline-soft p-md gap-md hover:bg-surface-soft flex items-center rounded-md border"
        >
          <span className="bg-surface-soft text-ink grid size-10 shrink-0 place-items-center rounded-sm">
            <Icons.salon style={{ width: IconSize.xs, height: IconSize.xs }} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="text-title text-ink block truncate font-medium">
              {product.businessName}
            </span>
            <span className="text-body-sm text-muted block">
              Collect and pay here — see the salon
            </span>
          </span>
          <Icons.chevronRight
            className="text-muted-soft shrink-0"
            style={{ width: IconSize.sm, height: IconSize.sm }}
            aria-hidden
          />
        </Link>
      ) : null}

      <p className="text-caption-sm text-muted">
        Nothing is charged online. You pay in cash when you collect.
      </p>
    </div>
  );
}

/**
 * **Five fields that were on the product and reached no screen.**
 *
 * `volume`, `hair_types`, `concerns`, `how_to_use` and `ingredients` have been columns since
 * `20260810000004` and were written by nobody's client and read by nobody's screen. They are
 * the difference between a catalogue entry and something a customer can choose between.
 *
 * One icon weight and one colour across all five rather than a colour each: this block has
 * to inform without becoming the loudest thing on the page — the price is.
 *
 * Renders nothing at all when the product carries none of them, which is every live product
 * today: the owner's product form has name, price, description, photo and stock, so these
 * are app- or admin-written until the owner half of the shop rework lands.
 */
function ProductFacts({ product: p }: { product: Product }) {
  const facts: { icon: (typeof Icons)[keyof typeof Icons]; label: string; value: string }[] = [
    ...(p.volume?.trim() ? [{ icon: Icons.product, label: "Size", value: p.volume.trim() }] : []),
    ...(p.hairTypes.length
      ? [{ icon: Icons.haircut, label: "Suits", value: p.hairTypes.join(" · ") }]
      : []),
    ...(p.concerns.length
      ? [{ icon: Icons.sparkle, label: "Targets", value: p.concerns.join(" · ") }]
      : []),
    ...(p.howToUse?.trim()
      ? [{ icon: Icons.info, label: "How to use", value: p.howToUse.trim() }]
      : []),
    ...(p.ingredients?.trim()
      ? [{ icon: Icons.note, label: "Ingredients", value: p.ingredients.trim() }]
      : []),
  ];

  if (facts.length === 0) return null;

  return (
    <dl className="gap-md flex flex-col">
      {facts.map(({ icon: Glyph, label, value }) => (
        <div key={label} className="gap-sm flex items-start">
          <Glyph
            className="text-muted mt-xxs shrink-0"
            style={{ width: IconSize.sm, height: IconSize.sm }}
            aria-hidden
          />
          <div className="min-w-0">
            <dt className="text-title text-ink font-medium">{label}</dt>
            <dd className="text-body-sm text-muted">{value}</dd>
          </div>
        </div>
      ))}
    </dl>
  );
}
