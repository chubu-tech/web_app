import { AdjustPointsSheet } from "@/components/owner/adjust-points-sheet";
import { RecordPaymentSheet } from "@/components/owner/record-payment-sheet";
import { Icons, IconSize } from "@/components/ui/icons";
import { SectionHeader } from "@/components/ui/section-header";
import { THIMPHU_TZ } from "@/lib/time";
import type { LoyaltyBalance } from "@/lib/types/back-office";
import { depositNu as depositTotal, outstandingNu, paymentLine, type Payment } from "@/lib/types/booking";
import { formatNu } from "@/lib/utils";

/**
 * The money on one booking, the salon's side: what has been taken against it, what is still
 * owed, and the customer's points with a way to correct them.
 *
 * A port of the two blocks the app's `business_booking_detail_screen.dart` has and the console
 * did not — and **the ledger is no longer read-only.**
 *
 * This file used to argue that the writer was permanently out of scope: `record_payment` is
 * Pro-gated, no live salon was on Pro, and `payments` had no rows anywhere, so an editable
 * branch would have been code nothing could reach. Norzin is Pro now. `RecordPaymentSheet`
 * below is the other half, gated on the same `deposits` entitlement the app gates its own
 * button on.
 *
 * Three things it draws, each with its own condition:
 *
 * - **The ledger**, whenever there is something in it *or* the salon can add to it. An empty
 *   ledger with a Record button is the state an owner needs most — the first payment on a
 *   booking cannot be added from a list that is not drawn. See `showPayments`.
 * - **The retained-deposit pill**, on a no-show with a deposit still against it. `depositNu`
 *   counts deposits only, net of refunds: a balance handed over after the cut is not no-show
 *   cover, and naming the total paid would name a number the entitlement has nothing to do
 *   with.
 * - **Points**, only for a salon that runs a programme and a customer with a profile — a
 *   walk-in typed in at the counter has no `customer_profile_id`, so there is nobody for
 *   `adjust_points` to credit. `AdjustPointsSheet` is the same sheet
 *   `/business/clients/[id]` uses; this is its second entry point, because an owner looking at
 *   the booking in front of them should not have to go and find the client.
 *
 * A salon that can do none of it renders nothing at all rather than three empty headings, and
 * the bill above still says *"Cash at the salon."*
 */
export function BookingMoney({
  payments,
  totalPrice,
  loyalty,
  businessId,
  bookingId,
  canRecord,
  isNoShow,
}: {
  payments: Payment[];
  /** The salon, for `record_payment`. Null on a booking with no business embedded. */
  businessId: string | null;
  bookingId: string;
  /**
   * Whether this salon may record a payment — `hasFeature(plan, "deposits")`, the same
   * entitlement the app gates its own button on. Resolved by the page, because only the page
   * knows the plan.
   *
   * It also decides whether the block is drawn on an empty ledger; see `showPayments`.
   */
  canRecord: boolean;
  /** A no-show, for the retained-deposit pill. */
  isNoShow: boolean;
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
  const depositNu = depositTotal(payments);

  /**
   * Whether to draw the Payments block at all.
   *
   * **The rule changed when the writer landed, and the old one was right for a reader.** This
   * block used to render only with rows in it, on the argument that a "Payments" heading over
   * nothing tells every salon on the platform that it forgot to record something — true when
   * there was no way to record one and `payments` was empty platform-wide.
   *
   * With `record_payment` wired, an empty ledger is where the owner needs the action most: the
   * first payment on a booking is exactly the one that cannot be added from a list that is not
   * drawn. So the block appears whenever the salon **can** record one, and states its emptiness
   * in the app's own words rather than implying a gap.
   *
   * A salon that cannot — every non-Pro one, which is sixteen of seventeen — gets the old
   * behaviour untouched: no heading, no empty state, and the bill above still says
   * *"Cash at the salon."*
   */
  const showPayments = payments.length > 0 || canRecord;

  if (!showPayments && loyalty == null) return null;

  return (
    <>
      {showPayments ? (
        <section>
          <SectionHeader title="Payments" as="h2" />
          <div className="border-hairline p-base mt-sm rounded-md border">
            {/*
              The app's line, verbatim (`business_booking_detail_screen.dart:166`). It only
              appears for a salon that can act on it — see `showPayments`.
            */}
            {payments.length === 0 ? (
              <p className="text-body-md text-muted">No payments recorded yet.</p>
            ) : null}

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
                        add up to the total is worse than no ledger at all.

                        `Math.abs` inside: `record_payment` stores a refund NEGATIVE, so the
                        raw value already carries a minus and prefixing another gave
                        "−Nu -150". Only observable once there was a writer to produce the
                        row. */}
                    {p.kind === "refund"
                      ? `−${formatNu(Math.abs(p.amountNu))}`
                      : formatNu(p.amountNu)}
                  </dd>
                </div>
              ))}
            </dl>

            <div
              className={
                payments.length > 0
                  ? "border-hairline-soft mt-base pt-base flex items-baseline border-t"
                  : "mt-base flex items-baseline"
              }
            >
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

            {/*
              **The deposit is cover, and the salon should be told so where the money is.**

              A port of `business_booking_detail_screen.dart:202-220`, and the one part of that
              screen this block did not have. A no-show with a deposit against it is the exact
              case `businesses.late_fee_amount` and the Pro "deposits & no-show cover"
              entitlement exist for — and without the pill, an owner looking at a no-show sees
              a deposit sitting in a ledger with nothing saying it is theirs to keep.

              Depends on the writer to be reachable at all: with `payments` empty
              platform-wide, no live booking could show it before this slice.
            */}
            {isNoShow && depositNu > 0 ? (
              <p className="bg-surface-soft text-caption text-ink mt-base p-sm gap-xs flex items-start rounded-sm">
                <Icons.info
                  className="text-muted mt-0.5 shrink-0"
                  style={{ width: IconSize.xxs, height: IconSize.xxs }}
                  aria-hidden
                />
                {formatNu(depositNu)} deposit retained as no-show cover.
              </p>
            ) : null}

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

            {/*
              The writer, gated on the same `deposits` entitlement the app gates its own button
              on (`business_booking_detail_screen.dart:158`). `record_payment` refuses a
              non-Pro salon in SQL as well, so this is the courtesy layer over a real rule
              rather than the rule itself.
            */}
            {canRecord && businessId ? (
              <div className="mt-base">
                <RecordPaymentSheet
                  businessId={businessId}
                  bookingId={bookingId}
                  outstandingNu={Math.max(0, outstanding)}
                />
              </div>
            ) : null}
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

