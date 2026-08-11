"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import {
  EMPTY_PRODUCT_FILTER,
  PRODUCT_SORTS,
  type ProductFilter,
  type ProductSort,
} from "@/lib/product-filter";
import { formatNu } from "@/lib/utils";

/**
 * Sort and price range for the products browse — a port of `_ProductFilterSheet` in
 * `tho/app/lib/customer/shop/product_filter.dart`.
 *
 * **Two number inputs, not a two-thumb range slider.** The Dart uses a `RangeSlider`, which has no
 * native web equivalent: `<input type="range">` carries one thumb, and a two-thumb control means
 * hand-rolling pointer capture and then re-inventing keyboard support for both ends. Two labelled
 * number fields are reachable, announced, and let someone type "300" instead of hunting for it —
 * which on a catalogue with a Nu 280–450 spread is the difference between a control and a toy.
 *
 * **A bound is only kept when it narrows the loaded list.** `productFilterFromParams` enforces that
 * on the way back in, and the same rule is applied here on Apply so the badge never claims a filter
 * that matches everything. When every product costs the same there is no range to offer, and the
 * sheet says so rather than showing two fields that cannot do anything.
 */
export function ProductFilterSheet({
  open,
  onClose,
  filter,
  bounds,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  filter: ProductFilter;
  bounds: { lowest: number; highest: number };
  onApply: (filter: ProductFilter) => void;
}) {
  const hasRange = bounds.highest > bounds.lowest;
  const [sort, setSort] = useState<ProductSort>(filter.sort);
  const [min, setMin] = useState(filter.minNu == null ? "" : String(filter.minNu));
  const [max, setMax] = useState(filter.maxNu == null ? "" : String(filter.maxNu));

  function apply() {
    const lower = parse(min);
    const upper = parse(max);
    // Same rule as `productFilterFromParams`: a range spanning the whole loaded list is not a
    // filter, so it is stored as cleared rather than as two bounds that match everything.
    const narrows =
      hasRange &&
      ((lower != null && lower > bounds.lowest) || (upper != null && upper < bounds.highest));
    onApply({
      sort,
      minNu: narrows ? lower : null,
      maxNu: narrows ? upper : null,
    });
    onClose();
  }

  return (
    <Sheet
      key={open ? "open" : "closed"}
      open={open}
      onClose={onClose}
      title="Filter products"
      footer={
        <div className="gap-sm flex flex-col">
          <Button fullWidth onClick={apply}>
            Apply
          </Button>
          <Button
            variant="quiet"
            fullWidth
            onClick={() => {
              onApply(EMPTY_PRODUCT_FILTER);
              onClose();
            }}
          >
            Clear
          </Button>
        </div>
      }
    >
      <div className="gap-lg flex flex-col">
        <fieldset>
          <legend className="text-title text-ink mb-sm font-medium">Sort by</legend>
          <div className="gap-xs flex flex-col">
            {PRODUCT_SORTS.map((option) => (
              <label
                key={option.value}
                className="gap-md py-sm flex cursor-pointer items-center"
              >
                <input
                  type="radio"
                  name="product-sort"
                  value={option.value}
                  checked={sort === option.value}
                  onChange={() => setSort(option.value)}
                  className="accent-rausch-cta size-4"
                />
                <span className="text-body-md text-ink">{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-title text-ink mb-sm font-medium">Price</legend>
          {hasRange ? (
            <>
              <div className="gap-base grid grid-cols-2">
                <label className="gap-xs flex flex-col">
                  <span className="text-caption text-muted font-medium">From (Nu)</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={bounds.lowest}
                    max={bounds.highest}
                    value={min}
                    onChange={(e) => setMin(e.target.value)}
                    placeholder={String(bounds.lowest)}
                    className="border-hairline text-body-md text-ink focus:border-ink px-base min-h-12 rounded-sm border outline-none"
                  />
                </label>
                <label className="gap-xs flex flex-col">
                  <span className="text-caption text-muted font-medium">To (Nu)</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={bounds.lowest}
                    max={bounds.highest}
                    value={max}
                    onChange={(e) => setMax(e.target.value)}
                    placeholder={String(bounds.highest)}
                    className="border-hairline text-body-md text-ink focus:border-ink px-base min-h-12 rounded-sm border outline-none"
                  />
                </label>
              </div>
              <p className="text-caption-sm text-muted mt-sm">
                These products run {formatNu(bounds.lowest)} to {formatNu(bounds.highest)}. Leave a
                field empty for no limit.
              </p>
            </>
          ) : (
            <p className="text-body-sm text-muted">
              {bounds.highest === 0
                ? "No products to filter yet."
                : `Everything here is ${formatNu(bounds.lowest)}, so there is no range to narrow.`}
            </p>
          )}
        </fieldset>
      </div>
    </Sheet>
  );
}

function parse(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number.parseInt(trimmed, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
