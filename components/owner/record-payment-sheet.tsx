"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Field } from "@/components/ui/field";
import { recordPayment } from "@/lib/api/booking";
import { ownerErrorMessage } from "@/lib/api/owner-errors";
import { Sheet } from "@/components/ui/sheet";
import { createClient } from "@/lib/supabase/client";
import {
  PAYMENT_KIND_LABELS,
  PAYMENT_METHOD_CHOICES,
  PAYMENT_METHOD_LABELS,
  type PaymentKind,
  type PaymentMethod,
} from "@/lib/types/booking";
import { formatNu } from "@/lib/utils";

/**
 * Record what the salon has actually been paid — a port of
 * `tho/app/lib/business/payments/record_payment_sheet.dart`.
 *
 * **This was the last owner write in the app with no web equivalent**, skipped through three
 * slices because `record_payment` refuses any salon that is not `pro` and no live salon was.
 * Norzin is now, so the editable branch has exactly one real example and the other sixteen
 * salons keep the refusal path honest.
 *
 * ## It records money; it does not take any
 *
 * There is no payment rail anywhere in this product — cash on collection is the whole model
 * for the shop, and an appointment is settled at the counter. So this is a **ledger entry
 * about something that already happened in the room**, which is why the copy says "record"
 * throughout and why the sheet does not ask for a card. The reader beside it already says
 * *"Recorded by the salon. Tho takes no payments."*
 *
 * ## A refund is entered as a positive number
 *
 * The table stores one signed `amount_nu`, and `recordPayment` negates it when the kind is
 * `refund`. Asking an owner to type a minus sign to give money back is a trap: the sign would
 * be forgotten, the write would succeed, and the customer's outstanding balance would go *up*.
 * So the sheet collects a magnitude and the kind carries the direction — which is also why the
 * confirm button restates what is about to happen in words.
 *
 * ## Chips, not dropdowns
 *
 * The Dart uses two `DropdownButtonFormField`s. Four options each, on a surface an owner uses
 * at a till with one hand: two rows of chips is one tap where a dropdown is three, and both
 * sets are short enough to read at a glance. Same `Chip` the rest of the console uses, so the
 * selected state is announced through `aria-pressed` rather than only coloured.
 */

/** The order the app lists them in — deposit first, because it is the one taken up front. */
const KINDS: PaymentKind[] = ["deposit", "balance", "full", "refund"];

export function RecordPaymentSheet({
  businessId,
  bookingId,
  outstandingNu,
}: {
  businessId: string;
  bookingId: string;
  /**
   * What is still owed, used only to prefill the amount.
   *
   * A convenience, not a constraint: the RPC allows any non-zero amount and a salon may well
   * take a part payment or a deposit larger than the balance. Prefilled because the common
   * case at a counter is "they paid the rest".
   */
  outstandingNu: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [kind, setKind] = useState<PaymentKind>("deposit");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = Number.parseInt(amount.trim(), 10);
  // Non-zero and positive: the direction is the kind's to say, never the number's.
  const valid = Number.isFinite(parsed) && parsed > 0;

  function start() {
    setAmount(outstandingNu > 0 ? String(outstandingNu) : "");
    setKind(outstandingNu > 0 ? "balance" : "deposit");
    setMethod("cash");
    setNote("");
    setError(null);
    setOpen(true);
  }

  async function submit() {
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      await recordPayment(createClient(), {
        businessId,
        bookingId,
        amountNu: parsed,
        kind,
        method,
        note,
      });
      setOpen(false);
      // The ledger, the outstanding figure and the no-show chip are all server-rendered from
      // this booking, so one refresh moves all three.
      router.refresh();
    } catch (caught) {
      setError(ownerErrorMessage("recordPayment", caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="outlined" onClick={start}>
        Record a payment
      </Button>

      <Sheet
        /* A fresh mount per opening, so an abandoned entry is not still sitting there next
           time. Same reason the review sheet and the walk-in form take a key. */
        key={open ? "open" : "closed"}
        open={open}
        onClose={() => setOpen(false)}
        title="Record a payment"
        footer={
          <Button fullWidth busy={busy} disabled={!valid} onClick={() => void submit()}>
            {valid
              ? kind === "refund"
                ? `Record a ${formatNu(parsed)} refund`
                : `Record ${formatNu(parsed)} ${PAYMENT_METHOD_LABELS[method]}`
              : "Record payment"}
          </Button>
        }
      >
        <div className="gap-base flex flex-col">
          <Field
            label="Amount (Nu)"
            value={amount}
            onChange={setAmount}
            type="number"
            inputMode="numeric"
            placeholder={outstandingNu > 0 ? String(outstandingNu) : "500"}
          />

          <fieldset>
            <legend className="text-caption text-muted mb-xs font-medium">What it was</legend>
            <div className="gap-sm flex flex-wrap">
              {KINDS.map((option) => (
                <Chip
                  key={option}
                  label={PAYMENT_KIND_LABELS[option]}
                  selected={kind === option}
                  onClick={() => setKind(option)}
                />
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-caption text-muted mb-xs font-medium">How it was paid</legend>
            <div className="gap-sm flex flex-wrap">
              {/* `PAYMENT_METHOD_CHOICES`, not the prose labels capitalised — that produced a
                  chip reading "MBoB". See the note on the constant. */}
              {PAYMENT_METHOD_CHOICES.map(({ value, label }) => (
                <Chip
                  key={value}
                  label={label}
                  selected={method === value}
                  onClick={() => setMethod(value)}
                />
              ))}
            </div>
          </fieldset>

          <Field
            label="Note (optional)"
            value={note}
            onChange={setNote}
            placeholder="Paid at the counter"
          />

          {/* Stated because entering a refund as a negative number is the mistake this shape
              exists to prevent, and an owner who has met a minus-sign field elsewhere will
              reach for one here. */}
          {kind === "refund" ? (
            <p className="text-caption-sm text-muted">
              Enter the amount you gave back as a positive number — choosing Refund is what makes
              it come off the total.
            </p>
          ) : null}

          <p className="text-caption-sm text-muted">
            This is a record of money already taken at the salon. Tho does not process payments.
          </p>

          {error ? <p className="text-body-sm text-error-text">{error}</p> : null}
        </div>
      </Sheet>
    </>
  );
}
