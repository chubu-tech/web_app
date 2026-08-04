"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { createOffer, updateOffer } from "@/lib/api/owner-back-office";
import { ownerErrorMessage } from "@/lib/api/owner-errors";
import { createClient } from "@/lib/supabase/client";
import type { Offer } from "@/lib/types/salon";

/**
 * Create or edit a promotion — a port of `_OfferSheet` in
 * `tho/app/lib/business/offers/offers_screen.dart`.
 *
 * **Validation mirrors all three CHECK constraints**, so a bad value is a sentence rather than a
 * `23514`:
 *
 * - `offers_title_len` — 1 to 120 characters, trimmed.
 * - `offers_discount_range` — null, or 1 to 100. A discount of 0 is not "no discount", it is an
 *   offer of nothing, and the constraint says so; leaving the field blank is how you mean it.
 * - `offers_date_order` — `ends_on >= starts_on`. Only `ends_on` is editable here (see below),
 *   and the min on the input is today, so this one is unreachable through the form.
 *
 * **No `starts_on` field**, matching the app. The column and its CHECK exist and
 * `offers_public_read` honours them, so a future-dated offer *works* and the list says "Starts 9
 * Aug" if something else writes one — but there is no owner-facing case for scheduling a
 * promotion that has to be published anyway, and the pause switch already covers "not yet".
 *
 * `ends_on` is a `date`, not a timestamp: no time, no timezone, and `offers_public_read` compares
 * it against `(now() at time zone 'Asia/Thimphu')::date`. So it is sent as `YYYY-MM-DD` exactly
 * as the input yields it — building a `Date` first would risk shifting the day.
 */
export function OfferFormSheet({
  businessId,
  offer,
  onClose,
}: {
  businessId: string;
  offer: Offer | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(offer?.title ?? "");
  const [description, setDescription] = useState(offer?.description ?? "");
  const [discount, setDiscount] = useState(
    offer?.discountPct == null ? "" : String(offer.discountPct),
  );
  const [endsOn, setEndsOn] = useState(offer?.endsOn ? isoDay(offer.endsOn) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const trimmed = title.trim();
    if (trimmed.length < 1 || trimmed.length > 120) {
      setError("Give the offer a title, up to 120 characters.");
      return;
    }
    let pct: number | null = null;
    if (discount.trim()) {
      pct = Number.parseInt(discount.trim(), 10);
      if (!Number.isFinite(pct) || pct < 1 || pct > 100) {
        setError("Enter a discount between 1 and 100, or leave it blank.");
        return;
      }
    }

    setSaving(true);
    setError(null);
    const fields = {
      title: trimmed,
      description: description.trim() || null,
      discountPct: pct,
      endsOn: endsOn || null,
    };
    try {
      const supabase = createClient();
      if (offer) {
        await updateOffer(supabase, offer.id, fields);
      } else {
        await createOffer(supabase, businessId, fields);
      }
      toast.success(offer ? "Offer saved." : "Offer is live.");
      onClose();
      router.refresh();
    } catch (caught) {
      setError(ownerErrorMessage("saveOffer", caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={offer ? "Edit offer" : "New offer"}
      footer={
        <Button fullWidth busy={saving} onClick={() => void save()}>
          {offer ? "Save changes" : "Create offer"}
        </Button>
      }
    >
      <div className="gap-base flex flex-col">
        <Field
          label="Title"
          value={title}
          onChange={setTitle}
          placeholder="e.g. 20% off colour"
        />
        <Field
          label="Details (optional)"
          value={description}
          onChange={setDescription}
          placeholder="Weekdays only, with Tashi"
        />
        <Field
          label="Discount % (optional)"
          value={discount}
          onChange={setDiscount}
          type="number"
          inputMode="numeric"
          min={1}
          max={100}
          placeholder="20"
        />

        <div className="gap-xs flex flex-col">
          <label className="text-caption text-muted font-medium" htmlFor="offer-ends">
            Ends on
          </label>
          <input
            id="offer-ends"
            type="date"
            value={endsOn}
            min={isoDay(new Date())}
            onChange={(e) => setEndsOn(e.target.value)}
            className="border-hairline text-body-md text-ink focus:border-ink px-base min-h-12 rounded-sm border outline-none"
          />
          <p className="text-caption-sm text-muted">
            {endsOn
              ? "It stops showing to customers the day after this."
              : "Leave empty and it runs until you pause it."}
          </p>
        </div>

        <p className="text-caption-sm text-muted">
          A live offer shows on your salon page and in the customer home feed.
        </p>

        {error ? <p className="text-body-sm text-error-text">{error}</p> : null}
      </div>
    </Sheet>
  );
}

/** `YYYY-MM-DD` in the salon's own calendar, which is what a `date` column means here. */
function isoDay(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Thimphu" }).format(d);
}
