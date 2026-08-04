import type { BookingStatus } from "@/lib/types/booking";
import { cn } from "@/lib/utils";

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
 */
export function StatusPill({ status }: { status: BookingStatus | string }) {
  const tone =
    status === "completed"
      ? "bg-success-soft text-success-text"
      : status === "cancelled" || status === "no_show"
        ? "bg-surface-strong text-muted"
        : "bg-rausch/10 text-rausch-cta";
  const label = status === "no_show" ? "No show" : status[0]!.toUpperCase() + status.slice(1);
  return (
    <span className={cn("text-badge px-sm py-xxs rounded-full font-semibold", tone)}>
      {label}
    </span>
  );
}
