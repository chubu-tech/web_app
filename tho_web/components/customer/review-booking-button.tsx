"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TermsGate } from "@/components/ui/terms-gate";
import {
  createReviewWithPhotos,
  uploadReviewPhoto,
} from "@/lib/api/booking";
import { bookingErrorMessage } from "@/lib/api/booking-errors";
import { hasAcceptedTerms } from "@/lib/api/moderation";
import { createClient } from "@/lib/supabase/client";
import type { Booking } from "@/lib/types/booking";
import { ReviewSheet, type ReviewResult } from "./review-sheet";

/**
 * Leave a review — the sheet, the photo uploads, and the terms gate in front of both.
 *
 * **Extracted so the card and the detail page share one implementation.** The card gained the
 * action to match `booking_rich_card.dart:329`; duplicating this particular flow would have been
 * the worst candidate for it, because there are four ordering rules in here and a second copy
 * would drift on all of them:
 *
 * - **The terms gate is checked at the write site**, not at sheet-open. `20260807000012` made
 *   accepted terms a precondition for user-generated content, so without it a customer's first
 *   review fails with a bare `P0004` — a refusal with nothing to press.
 * - **The typed review is held while the gate is up** and posted on agreement, so saying yes
 *   does not cost somebody the words they had already written.
 * - **Photos upload first, then the review and its urls go in one RPC.** An upload failure lands
 *   in the same catch as a failed review, so nothing partial is ever shown as submitted.
 * - **A fresh `key` per opening**, so an abandoned draft is not still sitting there next time.
 */
export function ReviewBookingButton({
  booking,
  fullWidth = false,
  variant = "filled",
}: {
  booking: Pick<Booking, "id" | "businessId" | "staffMemberId">;
  fullWidth?: boolean;
  variant?: "filled" | "quiet";
}) {
  const router = useRouter();
  const [session, setSession] = useState<number | null>(null);
  const [termsOpen, setTermsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  /** The review being written while the gate is open. A ref: nothing renders it. */
  const pending = useRef<ReviewResult | null>(null);

  async function submit(result: ReviewResult) {
    if (!booking.businessId) return;
    setBusy(true);
    const supabase = createClient();
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user && !(await hasAcceptedTerms(supabase, user.id))) {
        pending.current = result;
        setTermsOpen(true);
        setBusy(false);
        return;
      }

      const urls: string[] = [];
      for (let i = 0; i < result.photos.length; i++) {
        urls.push(await uploadReviewPhoto(supabase, booking.id, i, result.photos[i]!.blob));
      }
      await createReviewWithPhotos(supabase, {
        bookingId: booking.id,
        businessId: booking.businessId,
        staffMemberId: booking.staffMemberId,
        rating: result.rating,
        body: result.body,
        photoUrls: urls,
      });
      setSession(null);
      toast.success("Thanks for your review!");
      router.refresh();
    } catch (caught) {
      toast.error(bookingErrorMessage(caught, "Couldn't submit review."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        variant={variant}
        fullWidth={fullWidth}
        disabled={busy}
        onClick={() => setSession((n) => (n ?? 0) + 1)}
        className="relative z-10"
      >
        Leave a review
      </Button>

      <ReviewSheet
        key={session ?? "closed"}
        open={session != null}
        onClose={() => setSession(null)}
        onSubmit={submit}
        busy={busy}
      />

      {/* Asked once, ever. On agreement the held review posts straight away, so the gate costs
          a press rather than the text somebody just wrote. */}
      <TermsGate
        open={termsOpen}
        onClose={() => setTermsOpen(false)}
        action="post this review"
        onAccepted={() => {
          const held = pending.current;
          pending.current = null;
          if (held) void submit(held);
        }}
      />
    </>
  );
}
