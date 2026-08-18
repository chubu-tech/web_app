import type { OrderStatus } from "@/lib/types/back-office";
import type { BookingStatus } from "@/lib/types/booking";
import { cn } from "@/lib/utils";

/**
 * Wire value → tone. Anything unlisted is live, which is the safe default: a state nobody has
 * classified is more likely to still need something doing than to be finished.
 *
 * **The order statuses are new here, and two of them were wrong before.** `collected` fell
 * through to the live tint, so a finished order wore the same colour as one waiting to be
 * packed; `declined` did too. Classifying them by outcome — a handover is a success however it
 * happened, a refusal is over — is the same split the booking statuses already had.
 *
 * **A `Map`, not an object literal, because `status` is caller-supplied text.** This component
 * deliberately accepts a free string (`product-list.tsx` passes "Sold out"), and a plain object
 * answers for every key on `Object.prototype` as well as its own: `TONE["constructor"]` is a
 * *function*, truthy enough to defeat the `??` fallback and then silently dropped by `cn`, so a
 * status with an inherited name would render a pill with no tone at all. A `Map` has no such
 * keys. The closed-union form (`Record<OrderStatus, string>`, the way `ORDER_STATUS_LABEL` is
 * written) is the better tool where the key space *is* closed — here it is not, by design, so
 * the lookup has to be safe rather than the type.
 */
const TONE: ReadonlyMap<string, string> = new Map([
  // Finished well.
  ["completed", "bg-success-soft text-success-text"],
  ["collected", "bg-success-soft text-success-text"],
  ["delivered", "bg-success-soft text-success-text"],
  // Over, one way or another.
  ["cancelled", "bg-surface-strong text-muted"],
  ["no_show", "bg-surface-strong text-muted"],
  ["declined", "bg-surface-strong text-muted"],
  ["inactive", "bg-surface-strong text-muted"],
]);

/**
 * The booking lifecycle pill, ported from `tho/app/lib/ui/widgets/status_pill.dart`.
 *
 * Lived in `components/customer/booking-card.tsx` until 3a, when the owner console needed
 * the same pill and `components/owner/` reaching into `components/customer/` would have
 * been the wrong dependency. It was always a UI-kit widget in the app; it is one here now.
 *
 * **Three tones, not five.** The app gives cancelled and no-show red; here they share the
 * muted tone with everything else that is over, because on an owner's day list the loud
 * colour should belong to the rows that still need something doing. `pending` and
 * `confirmed` are both live and share the rausch tint — the label carries the difference,
 * and it is the label that decides which buttons the owner sees.
 *
 * **`inactive` is not a booking status**, and it is here for the same reason the app passes
 * it to the same widget: a switched-off service and a stood-down stylist need to read as
 * *not currently in play*, which is exactly the muted tone. Without the case it would fall
 * through to the rausch tint and a disabled row would look like the liveliest thing on the
 * page.
 */
/**
 * A wire status as words, when no caller supplied better ones.
 *
 * **Underscores become spaces**, which is the whole of what the `no_show` special case used to
 * do by hand — and it now covers every other underscored value the same way. That matters
 * because this is the fallback a *new* order surface gets by default: `out_for_delivery` used
 * to render as **"Out_for_delivery"** here, and the fix for it was to make four call sites each
 * remember to pass `label`. A fifth caller would have printed it again, with no type error and
 * no failing test. Now the default is merely plainer than `ORDER_STATUS_LABEL`, never wrong.
 *
 * `charAt` rather than `status[0]!`: the prop is deliberately a free string, and an empty one
 * made that assertion throw on `.toUpperCase()`. This component argues at length above for
 * looking values up safely; asserting on the very next line was the same trust it refuses.
 */
function titleCaseStatus(status: string): string {
  const words = status.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function StatusPill({
  status,
  label: given,
}: {
  status: BookingStatus | OrderStatus | string;
  /**
   * The words, when title-casing the wire value is not enough.
   *
   * Added for the order lifecycle. Both order pages used to pass a *label* as `status`
   * (`order.status === "new" ? "Placed" : order.status`), which worked only because every other
   * order status happened to be one lower-case word — so `out_for_delivery` rendered as
   * **"Out_for_delivery"**, and passing `ORDER_STATUS_LABEL[…]` instead would have fixed the words
   * while silently breaking the tone, since "Cancelled" does not equal `cancelled`.
   *
   * Splitting them is what makes both correct at once: tone is decided by the value, words by
   * this. A caller that passes neither still gets the title-cased value.
   */
  label?: string;
}) {
  const tone = TONE.get(status) ?? "bg-rausch/10 text-rausch-cta";
  const label = given ?? titleCaseStatus(status);
  return (
    <span className={cn("text-badge px-sm py-xxs rounded-full font-semibold", tone)}>
      {label}
    </span>
  );
}
