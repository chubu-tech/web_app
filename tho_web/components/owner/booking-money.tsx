import { AdjustPointsSheet } from "@/components/owner/adjust-points-sheet";
import { Icons, IconSize } from "@/components/ui/icons";
import { SectionHeader } from "@/components/ui/section-header";
import { THIMPHU_TZ } from "@/lib/time";
import type { LoyaltyBalance } from "@/lib/types/back-office";
import { outstandingNu, paymentLine, type Payment } from "@/lib/types/booking";
import { formatNu } from "@/lib/utils";

/**
 * The money on one booking, the salon's side: what has been taken against it, what is still
 * owed, and the customer's points with a way to correct them.
 *
 * Both halves are ports of blocks the app's `business_booking_detail_screen.dart` has and the
 * console did not. The old reason for their absence was honest and has expired in one place:
 *
 * - **The ledger is a reader, and always was going to be.** `record_payment` is Pro-gated and
 *   the writer is deliberately out of scope — an owner records cash at a till, and there is no
 *   payment rail here to record it through. Showing what *is* on record costs nothing and is
 *   the half that answers "has this been paid".
 * - **Points needed a salon with a programme.** `AdjustPointsSheet` existed but was reachable
 *   only from `/business/clients/[id]`, so an owner looking at the booking in front of them had
 *   to go and find the client. Same sheet, same RPC, second entry point.
 *
 * ## Both blocks are absent rather than empty
 *
 * A "Payments" heading over nothing says the salon takes payments here and forgot to record
 * one. With **zero `payments` rows platform-wide** that would be every booking on the site, so
 * the ledger renders only when there is something in it — and the bill above already states
 * *"Cash at the salon."*, which is the true answer in the meantime.
 *
 * Points are shown only for a salon that actually runs a programme and a customer who has a
 * profile: a walk-in typed in at the counter has no `customer_profile_id`, so there is nobody
 * for `adjust_points` to credit.
 */
export function BookingMoney({
  payments,
  totalPrice,
  loyalty,
}: {
  payments: Payment[];
  /** The booking's own total, which is what "outstanding" is measured against. */
  totalPrice: number;
  /**
   * The customer's points at this salon, or null — no programme, no profile, or the read
   * failed. Null renders nothing rather than a zero balance for a scheme that may not exist.
   */
  loyalty: {
    businessId: string;
    customerProfileId: string;
    clientName: string;
    balance: LoyaltyBalance;
  } | null;
}) {
  const outstanding = outstandingNu(totalPrice, payments);

  if (payments.length === 0 && loyalty == null) return null;

  return (
    <>
      {payments.length > 0 ? (
        <section>
          <SectionHeader title="Payments" as="h2" />
          <div className="border-hairline p-base mt-sm rounded-md border">
            <dl className="gap-sm flex flex-col">
              {payments.map((p) => (
                <div key={p.id} className="gap-sm flex items-baseline">
                  <dt className="text-body-md text-body min-w-0 flex-1">
                    {paymentLine(p, THIMPHU_TZ)}
                  </dt>
                  <dd
                    className={
                      p.kind === "refund"
                        ? "text-body-md text-error-text font-medium tabular-nums"
                        : "text-body-md text-ink font-medium tabular-nums"
                    }
                  >
                    {/* A refund is signed, because a column of positive numbers that do not
                        add up to the total is worse than no ledger at all. `outstandingNu`
                        already treats it as negative; this makes that visible. */}
                    {p.kind === "refund"
                      ? `−${formatNu(p.amountNu)}`
                      : formatNu(p.amountNu)}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="border-hairline-soft mt-base pt-base flex items-baseline border-t">
              <span className="text-title text-ink flex-1 font-semibold">
                {outstanding > 0 ? "Outstanding" : "Settled"}
              </span>
              <span
                className={
                  outstanding > 0
                    ? "text-title text-error-text font-semibold tabular-nums"
                    : "text-title text-success-text font-semibold tabular-nums"
                }
              >
                {formatNu(Math.max(0, outstanding))}
              </span>
            </div>

            {/* Stated rather than left to be inferred from the numbers: there is no card rail
                in this product, so anything on this ledger was taken by hand at the salon. */}
            <p className="text-caption-sm text-muted mt-sm gap-xs flex items-start">
              <Icons.info
                className="mt-0.5 shrink-0"
                style={{ width: IconSize.xxs, height: IconSize.xxs }}
                aria-hidden
              />
              Recorded by the salon. Tho takes no payments.
            </p>
          </div>
        </section>
      ) : null}

      {loyalty ? (
        <section>
          <SectionHeader title="Loyalty" as="h2" />
          <div className="mt-sm">
            <AdjustPointsSheet
              businessId={loyalty.businessId}
              customerProfileId={loyalty.customerProfileId}
              clientName={loyalty.clientName}
              balance={loyalty.balance}
            />
          </div>
        </section>
      ) : null}
    </>
  );
}

