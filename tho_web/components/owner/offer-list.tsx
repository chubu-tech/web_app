"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { OfferFormSheet } from "@/components/owner/offer-form-sheet";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Icons, IconSize } from "@/components/ui/icons";
import { SectionHeader } from "@/components/ui/section-header";
import { Sheet } from "@/components/ui/sheet";
import { deleteOffer, setOfferActive } from "@/lib/api/owner-back-office";
import { ownerErrorMessage } from "@/lib/api/owner-errors";
import { offerHiddenReason } from "@/lib/analytics";
import { createClient } from "@/lib/supabase/client";
import type { Offer } from "@/lib/types/salon";

/**
 * The salon's promotions — a port of `tho/app/lib/business/offers/offers_screen.dart`.
 *
 * **Every offer is here, including the ones customers can't see**, because
 * `offers_member_read` returns them all where `offers_public_read` filters to the live window.
 * An owner opening this page has usually come to find the one that stopped running.
 *
 * So each row states *why* it is invisible — **Paused**, **Ended 4 Aug**, **Starts 9 Aug** — or
 * says **Live**. Three very different situations that look identical on a page that only dims
 * them, and only one of which is something to act on.
 *
 * **Delete is a real delete, and the confirm says so.** It is the only hard delete in the whole
 * owner console: nothing references an offer — no booking, no order, no history — so there is
 * nothing to orphan and no reason to keep a spent promotion forever. Pause is the reversible
 * option and sits right beside it.
 *
 * ## One thing worth knowing about this table
 *
 * `offers_member_write` is `ALL using private.is_business_member` — **not** `is_business_owner`,
 * which every other owner-configured table uses. A stylist with a linked login can create, edit
 * and delete offers, and `offers_public_read` puts them on the salon page and in the customer
 * home feed. Measured, reported upstream, and not worked around here: this console only ever
 * acts as the owner, so nothing below depends on the wider door being open.
 */
export function OfferList({
  businessId,
  offers,
  now,
}: {
  businessId: string;
  offers: Offer[];
  now: Date;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Offer | "new" | null>(null);
  const [confirming, setConfirming] = useState<Offer | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function togglePause(offer: Offer) {
    setBusyId(offer.id);
    try {
      await setOfferActive(createClient(), offer.id, !offer.isActive);
      toast.success(offer.isActive ? "Offer paused." : "Offer is live again.");
      router.refresh();
    } catch (caught) {
      toast.error(ownerErrorMessage("toggleOffer", caught));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(offer: Offer) {
    setBusyId(offer.id);
    try {
      await deleteOffer(createClient(), offer.id);
      setConfirming(null);
      toast.success("Offer deleted.");
      router.refresh();
    } catch (caught) {
      toast.error(ownerErrorMessage("deleteOffer", caught));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="px-base py-lg mx-auto w-full max-w-[860px] tablet:px-lg">
      <SectionHeader title="Offers" as="h1" />
      <p className="text-body-sm text-muted mb-base">
        A live offer shows on your salon page and in the customer home feed.
      </p>

      <div className="mb-lg">
        <Button onClick={() => setEditing("new")}>
          <Icons.add style={{ width: IconSize.xs, height: IconSize.xs }} aria-hidden />
          New offer
        </Button>
      </div>

      {offers.length === 0 ? (
        <EmptyState
          icon={Icons.offer}
          title="No offers yet"
          message="Run a promotion — 20% off colour, a festival special — and it shows on your salon page and in the customer home feed."
        />
      ) : (
        <ul className="gap-md flex flex-col">
          {offers.map((o) => {
            const hidden = offerHiddenReason(o, now, dayLabel);
            return (
              <li key={o.id} className="border-hairline-soft bg-canvas rounded-md border">
                <div className={`p-base ${hidden ? "opacity-55" : ""}`}>
                  <div className="gap-sm flex items-baseline">
                    <h2 className="text-title text-ink min-w-0 flex-1 font-medium">{o.title}</h2>
                    {o.discountPct != null ? (
                      <span className="bg-rausch/10 text-rausch-cta text-caption shrink-0 rounded-full px-2 py-0.5 font-semibold tabular-nums">
                        {o.discountPct}% off
                      </span>
                    ) : null}
                  </div>
                  {o.description ? (
                    <p className="text-body-sm text-muted mt-xxs">{o.description}</p>
                  ) : null}
                  {o.endsOn ? (
                    <p className="text-caption-sm text-muted mt-xxs">
                      Ends {dayLabel(o.endsOn)}
                    </p>
                  ) : (
                    <p className="text-caption-sm text-muted mt-xxs">
                      No end date — runs until you pause it
                    </p>
                  )}
                </div>

                <div className="border-hairline-soft px-base py-sm gap-sm flex items-center border-t">
                  {hidden ? (
                    <span className="text-caption-sm text-muted gap-xs flex flex-1 items-center">
                      <Icons.hidden
                        style={{ width: IconSize.xxs, height: IconSize.xxs }}
                        aria-hidden
                      />
                      {hidden}
                    </span>
                  ) : (
                    <span className="text-caption-sm text-success-text flex-1 font-semibold">
                      Live
                    </span>
                  )}
                  <Button variant="quiet" onClick={() => setEditing(o)} className="px-sm">
                    Edit
                  </Button>
                  <Button
                    variant="quiet"
                    disabled={busyId === o.id}
                    onClick={() => void togglePause(o)}
                    className="px-sm"
                  >
                    {o.isActive ? "Pause" : "Resume"}
                  </Button>
                  <Button
                    variant="quiet"
                    onClick={() => setConfirming(o)}
                    className="text-error-text px-sm"
                  >
                    Delete
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {editing !== null ? (
        <OfferFormSheet
          key={editing === "new" ? "new" : editing.id}
          businessId={businessId}
          offer={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}

      <Sheet
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        title="Delete this offer?"
        footer={
          <div className="gap-sm flex flex-col">
            <Button
              fullWidth
              busy={busyId === confirming?.id}
              onClick={() => confirming && void remove(confirming)}
            >
              Delete for good
            </Button>
            <Button variant="quiet" fullWidth onClick={() => setConfirming(null)}>
              Keep it
            </Button>
          </div>
        }
      >
        <p className="text-body-md text-body">
          &ldquo;{confirming?.title}&rdquo; will be gone for good — this one can&apos;t be
          undone. If you only want it off your salon page for now, <strong>pause</strong> it
          instead.
        </p>
      </Sheet>
    </div>
  );
}

function dayLabel(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Thimphu",
  }).format(d);
}
