"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StarPicker } from "@/components/ui/rating";
import { Sheet } from "@/components/ui/sheet";
import { shopErrorMessage } from "@/lib/api/shop-errors";
import { submitProductReview } from "@/lib/api/shop";
import { createClient } from "@/lib/supabase/client";
import type { ProductReview } from "@/lib/types/back-office";

/** One thing bought, as much of it as a rating needs. */
export type ReviewableItem = {
  productId: string;
  name: string;
};

/**
 * Rate the things in a collected order.
 *
 * ## Why it lives on the order and nowhere else
 *
 * `submit_product_review` is the **only** door into `product_reviews` — the table has no insert
 * policy at all — and it takes an order id, checks the order is the caller's, checks it reached
 * `collected` or `delivered`, and checks the product was actually in it. So every rating on the
 * storefront is a verified purchase by construction, and there is deliberately no "write a
 * review" button anywhere a customer has not bought the thing. `canReviewOrder` mirrors the
 * status half of that gate, so this section is only rendered where the server would agree.
 *
 * ## The loop this closes
 *
 * `product_cards` already carries `rating_avg` and `rating_count`, and `ProductGridCard` already
 * draws them — so until now every product on the platform showed no rating because **nothing
 * could write one**, not because nobody would. A rating saved here reaches the storefront on the
 * next read, and makes the "Top rated" sort mean something.
 *
 * ## Pressing a star saves
 *
 * There is no Submit, because there is nothing to compose: a rating is one tap and the comment
 * is optional. `submit_product_review` upserts on `(order_id, product_id)`, so pressing a
 * different star is an **edit** rather than a duplicate — which is what lets a rating given in
 * haste be fixed, and why an existing one loads as the starting value rather than as five empty
 * stars over a review that already exists.
 *
 * The note is behind a `Sheet` rather than inline: an order of four products would otherwise be
 * four textareas nobody asked for, and the rating is the part that carries.
 *
 * **Busy state is per product**, keyed by id — the rule the rest of this console follows. One
 * slow save must not strip the stars off every other line while somebody is working down the
 * list.
 */
export function OrderReviewList({
  orderId,
  items,
  existing,
}: {
  orderId: string;
  /** The order's distinct products. An item whose product has since been deleted is dropped. */
  items: ReviewableItem[];
  /** What they have already said, by product id. */
  existing: ProductReview[];
}) {
  const router = useRouter();

  /*
    The server's answers, patched in place as they come back.

    A `router.refresh()` would re-read the page and is what every other write here does — but
    this one writes several times in a row down a list, and a refresh between each would swap
    the rows out from under the next tap. So the saved review is held locally and the refresh
    happens once, after, so the rest of the page (and anything derived from it) still catches up.
  */
  const [saved, setSaved] = useState<Record<string, ProductReview>>(() =>
    Object.fromEntries(existing.map((r) => [r.productId, r])),
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [noteFor, setNoteFor] = useState<ReviewableItem | null>(null);
  const [noteText, setNoteText] = useState("");

  async function save(item: ReviewableItem, rating: number, body: string | null) {
    setBusyId(item.productId);
    try {
      const review = await submitProductReview(createClient(), {
        orderId,
        productId: item.productId,
        rating,
        body,
      });
      setSaved((current) => ({ ...current, [item.productId]: review }));
      router.refresh();
      return true;
    } catch (caught) {
      toast.error(shopErrorMessage("submitReview", caught));
      return false;
    } finally {
      setBusyId(null);
    }
  }

  function openNote(item: ReviewableItem) {
    setNoteText(saved[item.productId]?.body ?? "");
    setNoteFor(item);
  }

  return (
    <>
      <ul className="gap-md mb-lg flex flex-col">
        {items.map((item) => {
          const review = saved[item.productId];
          const busy = busyId === item.productId;
          return (
            <li
              key={item.productId}
              className="border-hairline-soft p-sm gap-xs flex flex-col rounded-md border"
            >
              <span className="text-title text-ink font-medium">{item.name}</span>
              <div className="gap-sm flex flex-wrap items-center">
                <StarPicker
                  // Unique per row: five pickers sharing a name would be one radio group, so
                  // rating the shampoo would un-rate the conditioner.
                  name={`rating-${item.productId}`}
                  label={`Your rating of ${item.name}, out of 5`}
                  value={review?.rating ?? 0}
                  onChange={(rating) => void save(item, rating, review?.body ?? null)}
                  size={22}
                  disabled={busy}
                />
                {review ? (
                  <Button variant="quiet" onClick={() => openNote(item)} disabled={busy}>
                    {review.body ? "Edit note" : "Add a note"}
                  </Button>
                ) : (
                  // Said rather than implied: a row of grey stars does not explain itself, and
                  // "optional" is the thing somebody scanning a four-item order wants to know.
                  <span className="text-caption text-muted">Tap a star to rate</span>
                )}
              </div>
              {review?.body ? (
                <p className="text-body-sm text-muted">{review.body}</p>
              ) : null}
            </li>
          );
        })}
      </ul>

      <Sheet
        open={noteFor != null}
        onClose={() => setNoteFor(null)}
        title={noteFor ? `About ${noteFor.name}` : "Add a note"}
        footer={
          <Button
            fullWidth
            busy={busyId != null}
            onClick={() => {
              const item = noteFor;
              const review = item ? saved[item.productId] : undefined;
              if (!item || !review) return;
              void save(item, review.rating, noteText.trim() || null).then((ok) => {
                if (ok) setNoteFor(null);
              });
            }}
          >
            Save
          </Button>
        }
      >
        <div className="p-base">
          <label className="block">
            <span className="sr-only">Your note</span>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={4}
              placeholder="What was it like? (optional)"
              className="border-hairline text-body-md text-ink placeholder:text-muted-soft p-md focus:border-ink w-full rounded-sm border focus:border-2 focus:outline-none"
            />
          </label>
          {/* An empty note clears the one that was there — the RPC stores a blank body as null
              — so it is worth saying, rather than leaving somebody to guess whether Save on an
              emptied box removes the words or does nothing. */}
          <p className="text-caption-sm text-muted mt-xs">
            Saving an empty note removes it. Your rating stays.
          </p>
        </div>
      </Sheet>
    </>
  );
}
