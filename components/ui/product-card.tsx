"use client";

import { CoverImage } from "@/components/ui/cover-image";
import { Icons, IconSize } from "@/components/ui/icons";
import { discountPercent, isDiscounted, type Product } from "@/lib/types/salon";
import { cn, formatNu } from "@/lib/utils";

/**
 * One product — a port of `tho/app/lib/ui/widgets/product_card.dart`.
 *
 * **This is the only way this app draws a product.** Upstream found five renderings, three
 * of them reachable in a single session, and deleted four. The web had the same defect in
 * miniature: `components/customer/product-card.tsx` drew a 52px thumbnail row whose price
 * was `text-body-sm text-muted` — *disabled grey body text* — under a name in
 * `text-title font-medium`. So the number the customer is deciding on was the quietest
 * thing on the row, and styled as though it could not be interacted with.
 *
 * The rule that replaces it: **the price gets one identity everywhere — `text-title`,
 * semibold, in `ink`, the loudest text on the card.**
 *
 * Three things stop this reading as flat, in order of effect:
 *
 * 1. **The photo is the card.** Square and bled to the edges, so a shelf of products reads
 *    as a shelf of *things* rather than as a form.
 * 2. **Price is the loudest text.**
 * 3. **`shadow-card` and no border**, so cards sit on the canvas instead of dissolving into
 *    it — which matters more here than in the app, because the canvas port moved the ground
 *    to white and `bg-canvas` no longer separates itself from the page by colour at all.
 *
 * ## What was deliberately not ported: `ProductGridMetrics`
 *
 * Upstream measures each grid: it asks the type scale how tall its lines are at the reader's
 * current text scale, adds the photo, and hands the grid a pixel height, because a Flutter
 * grid cell declared by aspect ratio is a fixed box while the text under the photo is not.
 * That class exists to defeat a Flutter constraint, and reimplementing it here would be
 * slower, wronger and unable to see a browser zoom.
 *
 * **Every guarantee it buys is native in CSS**, and each is claimed below:
 *
 * | Upstream's measurement | Here |
 * | --- | --- |
 * | square photo | `aspect-square` |
 * | two-line name slot, so prices share a baseline | `min-h` of two `--text-title` lines |
 * | price at the foot of a card that needed less | `mt-auto` in a flex column |
 * | every cell as tall as the tallest | grid `stretch` + `h-full` |
 * | correct at any text scale | `rem`-derived, so it follows the browser |
 * | `maxCardWidth` 220, no breakpoint table | the caller's `auto-fill` track |
 *
 * The one thing that does not survive is `reserveSalonRow` — upstream reserves the row on
 * *every* card in a grid where *any* card names a salon, so the heights match. Bottom-
 * anchoring the price makes that unnecessary: cards without a salon spend the difference
 * above the price rather than below it, which is what the reservation was arranging anyway.
 *
 * ## Two named forms, and no third
 *
 * `ProductGridCard` carries the salon row; `ProductRailCard` does not — a rail card is
 * ~145px wide and a salon line there costs a third of the text column to something that
 * ellipsises to nothing. Two exported components over one shared implementation, rather
 * than a `variant` prop, for upstream's reason stated structurally: `showSalonRow` is then
 * not a thing a caller can pass at all, which is what stops a third shape appearing. The
 * grid below every rail still names the salon, and so does the detail one tap away.
 */

type CardProps = {
  product: Product;
  /** Opens the product. The whole card is this control — see `after:absolute` below. */
  onOpen: () => void;
  /** How many are already in the caller's order. */
  qty?: number;
  /** Adds one. Omitted renders no Add control at all — the read-only form. */
  onAdd?: () => void;
  /** Raises the count from the pill. Required alongside `onAdd` to be useful. */
  onSetQty?: (qty: number) => void;
  /**
   * A control pinned to the top-right of the photo — `/saved`'s heart.
   *
   * On the plate rather than in the text column for the same reason the discount badge is:
   * a row whose presence changes the card's height was half of what made upstream's cell
   * overflow. `BusinessCard` already puts its favourite heart here.
   */
  photoOverlay?: React.ReactNode;
  /** Widths for the photo. The two forms render at very different sizes. */
  sizes: string;
  className?: string;
};

/** A cell in a product grid. Names the salon, because a cross-salon browse must. */
export function ProductGridCard(props: CardProps) {
  return <Card {...props} showSalonRow />;
}

/** A card in a horizontal shelf. Suppresses the salon row. */
export function ProductRailCard(props: CardProps) {
  return <Card {...props} showSalonRow={false} />;
}

function Card({
  product: p,
  onOpen,
  qty = 0,
  onAdd,
  onSetQty,
  photoOverlay,
  sizes,
  className,
  showSalonRow,
}: CardProps & { showSalonRow: boolean }) {
  const off = discountPercent(p);

  return (
    <div
      className={cn(
        // `shadow-card` and **no border**: the shadow's first layer is a zero-blur 1px
        // spread standing in for a hairline, so a border over it is the ghost card its own
        // token doc warns about. `h-full` is what makes every card in a grid row match.
        "bg-canvas shadow-card relative flex h-full flex-col overflow-hidden rounded-md",
        className,
      )}
    >
      <div className="relative aspect-square">
        {/* Edge to edge. `CoverImage` already falls back to a tinted monogram, so an
            unphotographed product leaves no hole. */}
        <CoverImage
          label={p.name}
          imageUrl={p.photoUrl}
          sizes={sizes}
          className="size-full rounded-none"
        />

        {off != null ? (
          /*
            The markdown flag rides the photo rather than the text column: it reads from
            further away against a picture than it ever did as a third line of small type,
            and it stops being a row whose presence changes the card's height.

            **A minus sign (U+2212), not a hyphen** — this is a quantity going down.

            `bg-rausch-cta`, where upstream uses `rausch`. White on `#FF385C` is 3.53:1 and
            fails AA; this badge is 11px text, so it needs 4.5:1 and gets 4.89:1. The same
            substitution `Button` makes, for the same reason, and it is the rule that keeps
            being restated because it keeps being worth restating.
          */
          <span className="bg-rausch-cta text-on-primary text-badge px-xxs py-[1px] top-sm left-sm absolute rounded-sm font-semibold">
            −{off}%
          </span>
        ) : null}

        {!p.inStock ? (
          // Worth saying loudly here: without it the customer taps through to a salon page
          // for something they cannot buy.
          <span className="scrim absolute inset-0 grid place-items-center">
            <span className="bg-canvas text-badge text-error-text px-sm py-xxs rounded-full font-semibold">
              Out of stock
            </span>
          </span>
        ) : null}

        {photoOverlay ? (
          /*
            Last, on purpose. The out-of-stock scrim fills the plate, so a heart painted
            before it would be both dimmed and un-tappable — and unsaving a sold-out product
            is exactly when you want to. `z-10` puts it above the stretched card control too.
            The badge is top-LEFT, so the two never collide.
          */
          <span className="top-sm right-sm absolute z-10">{photoOverlay}</span>
        ) : null}
      </div>

      <div className="p-sm flex flex-1 flex-col">
        {/*
          A fixed two-line slot whether or not the name needs both, so the salon row lands
          at the same height on every card in a row. Two `--text-title` lines, derived from
          the tokens rather than hardcoded, so it stays correct if the scale moves and it
          grows under browser zoom.

          The button is the card: `after:absolute after:inset-0` stretches its hit area over
          the whole thing, which is what lets the Add control be a real sibling button rather
          than an interactive element nested inside another one.
        */}
        <h3 className="min-h-[calc(2*var(--text-title--line-height)*var(--text-title))]">
          <button
            type="button"
            onClick={onOpen}
            className="text-title text-ink line-clamp-2 text-left font-medium after:absolute after:inset-0 after:content-['']"
          >
            {p.name}
          </button>
        </h3>

        {showSalonRow && p.businessName ? (
          /*
            Text, not a link. The card is one stretched control now, and a link inside it
            would be an interactive element nested in another — invalid, and ambiguous to a
            keyboard. The old row card could afford `/salon/[id]#shop` because its body was a
            button and the salon sat outside it; here the attribution is deferred one surface
            to the product detail, which names the salon and links to it. That is upstream's
            arrangement too.
          */
          <p className="gap-xs mt-xs text-muted flex items-center">
            <Icons.salon
              style={{ width: IconSize.xs, height: IconSize.xs }}
              className="shrink-0"
              aria-hidden
            />
            <span className="text-caption-sm truncate">{p.businessName}</span>
          </p>
        ) : null}

        {/* `mt-auto` is the whole of upstream's height arithmetic: a card that needs less
            spends the difference here rather than leaving the price floating mid-card. */}
        <div className="gap-xs pt-sm mt-auto flex items-baseline">
          <span
            className={cn(
              "text-title truncate font-semibold",
              // Colour only, so the number stays a price rather than becoming a caption.
              p.inStock ? "text-ink" : "text-muted",
            )}
          >
            {formatNu(p.priceNu)}
          </span>
          {isDiscounted(p) ? (
            <span className="text-caption-sm text-muted-soft truncate line-through">
              {formatNu(p.compareAtNu!)}
            </span>
          ) : null}
          {p.inStock && onAdd ? (
            <AddControl product={p} qty={qty} onAdd={onAdd} onSetQty={onSetQty} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * A compact `+` at zero, a live count once there is one — **deliberately small, so the price
 * stays the loudest thing on the card.**
 *
 * `relative` lifts it out of the stretched card control above it, which is what makes the
 * two targets separable by pointer and by keyboard.
 *
 * The 32px disc is under the 48px target floor the rest of the kit holds to, and that is
 * upstream's size rather than an oversight — but it is padded here to a 48px hit area with
 * a negative margin, so the control *reads* at 32 and *presses* at 48. A grid of these on a
 * phone is the densest tap target field in the product, and it is where the floor earns its
 * keep most.
 */
function AddControl({
  product,
  qty,
  onAdd,
  onSetQty,
}: {
  product: Product;
  qty: number;
  onAdd: () => void;
  onSetQty?: (qty: number) => void;
}) {
  const shared =
    "relative z-10 ml-auto -m-2 grid size-12 shrink-0 place-items-center rounded-full";

  if (qty === 0) {
    return (
      <button
        type="button"
        onClick={onAdd}
        aria-label={`Add ${product.name} to your order`}
        className={shared}
      >
        <span className="bg-ink text-on-primary grid size-8 place-items-center rounded-full">
          <Icons.add style={{ width: IconSize.xs, height: IconSize.xs }} aria-hidden />
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSetQty?.(qty + 1)}
      aria-label={`${qty} ${product.name} in your order. Add another.`}
      className={shared}
    >
      {/* `rausch-cta`, not `rausch` — 11px white text needs 4.5:1. See the badge above. */}
      <span className="bg-rausch-cta text-on-primary text-badge px-sm py-xxs min-w-8 rounded-full text-center font-semibold">
        {qty}
      </span>
    </button>
  );
}
