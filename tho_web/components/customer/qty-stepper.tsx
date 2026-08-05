"use client";

import { Icons, IconSize } from "@/components/ui/icons";

/**
 * A compact `−  qty  +` control — a port of `QtyStepper` in
 * `tho/app/lib/customer/shop/salon_shop_tab.dart`.
 *
 * Shared by the shop tiles (where reaching 1 replaces the Add button), the product sheet and the
 * cart's line rows, so a quantity is changed the same way everywhere.
 *
 * **Two real buttons with accessible names**, not a styled div with a tap handler: this is the one
 * control on a product row that changes what a customer is about to pay, so it has to be reachable
 * by keyboard and announced. The app's version is an `IconButton` pair with no label at all, which a
 * screen reader reads as two unnamed buttons either side of a number.
 *
 * Going below 1 removes the line — `setQty(0)` is the delete, matching the owner catalogue's
 * delete-by-zero convention — so the minus button is never disabled at 1. `label` names what is
 * being counted so the announcement is "Remove Argan Hair Oil", not "Decrease".
 */
export function QtyStepper({
  qty,
  label,
  onChange,
  disabled = false,
}: {
  qty: number;
  /** What is being counted, for the buttons' accessible names. */
  label: string;
  onChange: (qty: number) => void;
  disabled?: boolean;
}) {
  return (
    <span className="gap-xs inline-flex shrink-0 items-center">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(qty - 1)}
        aria-label={qty === 1 ? `Remove ${label}` : `One fewer ${label}`}
        className="border-hairline text-ink hover:bg-surface-soft grid size-8 place-items-center rounded-full border disabled:opacity-50"
      >
        <Icons.minus style={{ width: IconSize.xxs, height: IconSize.xxs }} aria-hidden />
      </button>
      <span className="text-title text-ink w-7 text-center font-medium tabular-nums" aria-hidden>
        {qty}
      </span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(qty + 1)}
        aria-label={`One more ${label}`}
        className="border-hairline text-ink hover:bg-surface-soft grid size-8 place-items-center rounded-full border disabled:opacity-50"
      >
        <Icons.add style={{ width: IconSize.xxs, height: IconSize.xxs }} aria-hidden />
      </button>
    </span>
  );
}
