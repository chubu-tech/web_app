"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { OfferFormSheet } from "@/components/owner/offer-form-sheet";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Icons, IconSize } from "@/components/ui/icons";
import { MenuItem, MenuSheet } from "@/components/ui/menu-sheet";
import { SectionHeader } from "@/components/ui/section-header";
import { Sheet } from "@/components/ui/sheet";
import { StatusPill } from "@/components/ui/status-pill";
import { offerStatusLine, offerVisibility } from "@/lib/analytics";
import { deleteOffer, setOfferActive } from "@/lib/api/owner-back-office";
import { ownerErrorMessage } from "@/lib/api/owner-errors";
import { dayLabel } from "@/lib/clock";
import { createClient } from "@/lib/supabase/client";
import type { Offer } from "@/lib/types/salon";
import { cn } from "@/lib/utils";

/**
 * The salon's promotions — a port of `tho/app/lib/business/offers/offers_screen.dart`.
 *
 * **Every offer is here, including the ones customers can't see**, because
 * `offers_member_read` returns them all where `offers_public_read` filters to the live window.
 * An owner opening this page has usually come to find the one that stopped running.
 *
 * So each row states *which* of four states it is in — **Live**, **Paused**, **Ended**,
 * **Scheduled** — three of which look identical on a page that only dims them, and only one of
 * which is something to act on. `offerVisibility` decides; `offerStatusLine` supplies the date
 * for the two states a date explains.
 *
 * ## The row grammar, and the gold that survives it
 *
 * This used to be a two-storey card of its own design: a title, a description, an end-date
 * line, then a footer strip carrying Live/hidden text and **three** always-visible text buttons,
 * one of them Delete. Nothing else in the console looks like that. It is now the same row as
 * `product-list.tsx` and `service-list.tsx` — one bordered card, a leading tile, a title with a
 * `StatusPill`, one subtitle line, a switch and an overflow — so an owner moving between
 * Services, Products and Offers is reading one grammar rather than three.
 *
 * Three of those changes are behavioural, not cosmetic:
 *
 * - **A switch, not a Pause/Resume button.** The button named the *next* action, so the owner
 *   had to read a verb to work out the current state — the one thing every sibling row shows at
 *   a glance.
 * - **Delete moved behind the overflow.** It was the only destructive action in the console
 *   standing permanently open on the face of a row, one mis-tap from the Edit beside it.
 * - **The whole row opens the editor**, which is what makes the Edit button removable. The
 *   title is the control and its hit area is stretched over the card (`after:absolute`, the
 *   same device `product-card.tsx` uses); the switch and the overflow are lifted back out of it
 *   with `relative z-10`.
 *
 * It deliberately does **not** reuse the customer-facing gold `OfferCard` — that card is shared
 * with the home feed and the salon page, so bending it to owner needs would change what
 * customers see. The offer's identity survives in the leading tile alone.
 *
 * **Delete is a real delete, and the confirm says so.** It is the only hard delete in the whole
 * owner console: nothing references an offer — no booking, no order, no history — so there is
 * nothing to orphan and no reason to keep a spent promotion forever. Pausing is the reversible
 * option, and it is now the control the owner's thumb lands on.
 *
 * ## One thing worth knowing about this table
 *
 * `offers_member_write` is `ALL using private.is_business_member` — **not** `is_business_owner`,
 * which every other owner-configured table uses. A stylist with a linked login can create, edit
 * and delete offers, and `offers_public_read` puts them on the salon page and in the customer
 * home feed. Measured, reported upstream, and not worked around here: this console only ever
 * acts as the owner, so nothing below depends on the wider door being open.
 *
 * ## Why there is no optimistic list here
 *
 * Upstream holds the offers in widget state and flips a row on the tap, because a `FutureBuilder`
 * would otherwise blank the whole list into a skeleton on every write. This list is a prop of a
 * server-rendered page: the write awaits, `router.refresh()` re-renders the rows that changed,
 * and nothing on screen is thrown away in between. The busy flag is **per row** — the thing the
 * app's note is really about — so a slow write on one offer leaves every other switch live.
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
  const [menuFor, setMenuFor] = useState<Offer | null>(null);
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
        /* No search and no filter chips, which is upstream's call and holds here: a salon runs a
           handful of promotions at a time, and controls for narrowing a list that short are
           burden with nothing to narrow. */
        <ul className="gap-md flex flex-col">
          {offers.map((o) => {
            const status = offerVisibility(o, now);
            const dim = status.visibility !== "live";
            const line = offerStatusLine(status, dayLabel) ?? o.description;
            return (
              <li
                key={o.id}
                className="border-hairline-soft p-sm gap-md relative flex items-center rounded-md border"
              >
                {/* Dimming covers the tile and the text but **not** the controls: an owner has
                    to be able to read the switch they are reaching for. */}
                <span
                  className={cn(
                    "bg-star/14 grid size-13 shrink-0 place-items-center rounded-sm",
                    dim && "opacity-55",
                  )}
                >
                  {o.discountPct != null ? (
                    /* Ink on the gold plate, where upstream paints the number in `star` on
                       `star` at 14%. That pair measures 1.95:1 — the plate carries the offer's
                       identity and the number has to be legible, so the colour stays on the
                       plate. The percentage is `1..100` by CHECK constraint, so "100%" is the
                       widest it gets; the tile is `size-13`, which Tailwind resolves in `rem`,
                       so the box grows with the reader's type and the number cannot outrun it. */
                    <span className="text-title text-ink font-semibold tabular-nums">
                      {o.discountPct}%
                    </span>
                  ) : (
                    <Icons.offer
                      className="text-ink"
                      style={{ width: IconSize.sm, height: IconSize.sm }}
                      aria-hidden
                    />
                  )}
                </span>

                <span className={cn("min-w-0 flex-1", dim && "opacity-55")}>
                  {/* Wraps rather than squeezing: at 320px the trailing controls leave this
                      column under 100px, and a pill that refuses to shrink beside a title that
                      shrinks to nothing is how the title becomes "2…". The floor on the title
                      is what sends the pill to its own line instead. */}
                  <span className="gap-x-sm gap-y-xxs flex flex-wrap items-center">
                    <button
                      type="button"
                      onClick={() => setEditing(o)}
                      aria-label={`Edit ${o.title}`}
                      className="text-title text-ink min-w-[4rem] flex-1 truncate text-left font-medium after:absolute after:inset-0 after:content-['']"
                    >
                      {o.title}
                    </button>
                    <StatusPill status={status.visibility} />
                  </span>
                  {line ? (
                    <span className="text-body-sm text-muted mt-xxs block truncate">{line}</span>
                  ) : null}
                </span>

                {/* `relative z-10` lifts both controls out of the stretched row control above. */}
                <span className="gap-xxs relative z-10 flex shrink-0 items-center">
                  <label className="grid size-12 cursor-pointer place-items-center">
                    {/* A stable name that states what being on *means*, not one that renames
                        itself into the next action — which is the same argument the switch is
                        replacing a Pause/Resume button for. "Running" rather than "shown to
                        customers" because that is all the switch decides: an offer whose end
                        date has passed is switched on and still not on show. */}
                    <span className="sr-only">“{o.title}” is running</span>
                    <input
                      type="checkbox"
                      checked={o.isActive}
                      disabled={busyId === o.id}
                      onChange={() => void togglePause(o)}
                      className="accent-rausch-cta size-5"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setMenuFor(o)}
                    aria-label={`More actions for ${o.title}`}
                    className="text-muted hover:text-ink hover:bg-surface-soft grid size-12 place-items-center rounded-full transition-colors duration-[var(--duration-fast)]"
                  >
                    <Icons.more
                      style={{ width: IconSize.sm, height: IconSize.sm }}
                      aria-hidden
                    />
                  </button>
                </span>
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

      <MenuSheet
        open={menuFor !== null}
        onClose={() => setMenuFor(null)}
        title={menuFor?.title ?? "Offer"}
      >
        <MenuItem
          icon={Icons.trash}
          tone="danger"
          label="Delete offer"
          hint="It stops showing on your salon page, and this one can't be undone."
          onClick={() => {
            const target = menuFor;
            setMenuFor(null);
            setConfirming(target);
          }}
        />
      </MenuSheet>

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
