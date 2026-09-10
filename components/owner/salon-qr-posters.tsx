"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Icons, IconSize } from "@/components/ui/icons";
import { saveQrImage } from "@/lib/api/qr-storage";
import { qrPngBlob } from "@/lib/qr-image";
import { createClient } from "@/lib/supabase/client";
import { type PosterData, SalonPoster } from "./salon-poster";

/**
 * One salon's printable poster, as the page hands it over.
 *
 * `poster` is built on the server (`lib/qr.ts`, `lib/poster.ts`) — the encoder is not worth
 * shipping to a browser, and a server-rendered path prints as vectors at any paper size.
 */
export type SalonPosterItem = {
  id: string;
  name: string;
  /** The `https://…/q/<id>` the code encodes. Shown so it can be copied. */
  link: string;
  /** Null when the salon cannot take walk-ins — the card shows the reason instead. */
  poster: PosterData | null;
  blockedReason: string | null;
  fix: { href: string; label: string } | null;
  /**
   * The permanent public URL of this salon's saved PNG, or null if it has not been saved.
   *
   * Derived from the path rather than stored anywhere — see `lib/api/qr-storage.ts` for why
   * there is no column and why that turns out to be the better shape.
   */
  savedUrl: string | null;
};

/**
 * How wide the on-screen preview is, in the 1240px design's own units.
 *
 * 470 rather than a round number because it is what makes two cards sit side by side in the
 * page's 880px column with the grid's gap between them. The poster is scaled as a whole, so
 * this is the only number that decides preview size — see `salon-poster.tsx`.
 */
const PREVIEW_WIDTH = 470;
const PREVIEW_SCALE = PREVIEW_WIDTH / 1240;

/**
 * The owner's QR posters — the design, once per salon, ready for the counter.
 *
 * ## Why this page is cross-salon when the rest of the console is not
 *
 * Every other owner route is scoped to the active salon through the `tho_active_business`
 * cookie. This one deliberately is not, and the reason is the job rather than the data: the
 * seeded owner runs **ten** salons, and printing their posters through the switcher means ten
 * cookie flips and ten page loads to do one afternoon's task. Getting posters onto counters
 * is something you do for the estate at once, not for whichever shop the console happens to
 * be pointed at.
 *
 * Nothing is relaxed to allow it. `getOwnerContext()` already returns every salon the caller
 * owns — matched on `owner_id`, with RLS refusing the rest — so this reads no more than the
 * switcher does.
 *
 * ## Printing one poster out of ten
 *
 * The print flow does not go through React state, deliberately. Marking the target in state
 * means rendering, *then* printing from an effect, then clearing the mark in a second
 * setState — the `react-hooks/set-state-in-effect` pattern this repo has been bitten by
 * twice. `window.print()` is an imperative browser API, so it is driven imperatively: the
 * card and `document.body` are marked directly, and `afterprint` clears them.
 *
 * **Fonts are awaited before the dialog opens.** The poster is set in Archivo Black and
 * Manrope, loaded with `display: "swap"`; printing before the swap lands would set a 126px
 * headline in the fallback, which on this design is the most visible element on the sheet.
 * `document.fonts.ready` is the one thing between the press and the dialog.
 */
export function SalonQrPosters({
  posters,
  userId,
}: {
  posters: SalonPosterItem[];
  /** The owner's uid — the first path segment every upload must carry. */
  userId: string;
}) {
  if (posters.length === 0) {
    return (
      <EmptyState
        icon={Icons.qr}
        title="No salons yet"
        message="Add a salon and its poster will appear here, ready to print for the counter."
        action={
          <Link href="/business/new">
            <Button>Add a salon</Button>
          </Link>
        }
      />
    );
  }

  return (
    /*
      `items-start` so a locked card keeps its own height. Grid rows stretch their items by
      default, which made a one-line "needs a Growth plan" card as tall as a full poster
      preview beside it — and on this estate that is the common case, since one salon of ten
      runs a queue. A column of half-empty boxes reads as content that failed to load.
    */
    <div className="gap-base grid grid-cols-1 items-start desktop:grid-cols-2">
      {posters.map((p) => (
        <PosterCard key={p.id} item={p} userId={userId} />
      ))}
    </div>
  );
}

function PosterCard({ item, userId }: { item: SalonPosterItem; userId: string }) {
  const card = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedUrl, setSavedUrl] = useState(item.savedUrl);

  /**
   * Rasterise the code and put it in the `media` bucket, under a path that never changes.
   *
   * Idempotent all the way down — a second press re-uploads to the same path, the server
   * answers 409, and `saveQrImage` reads that as success. So there is no need to disable
   * the control once saved, and no state to get out of step with the bucket.
   */
  async function save() {
    if (!item.poster?.qr) return;
    setSaving(true);
    try {
      const png = await qrPngBlob(item.poster.qr);
      const url = await saveQrImage(createClient(), userId, item.id, png);
      setSavedUrl(url);
      toast.success("QR image saved.");
    } catch {
      // The poster still prints, which is the part that matters — so this is a toast
      // rather than an error state that replaces the card.
      toast.error("Couldn't save the image. The poster still prints.");
    } finally {
      setSaving(false);
    }
  }

  async function print() {
    const el = card.current;
    if (!el) return;

    setBusy(true);
    try {
      // See the note above: a 126px Archivo Black headline printed in a swap fallback is
      // the difference between the design and something that merely resembles it.
      await document.fonts?.ready;
    } catch {
      // A browser without the Font Loading API still prints; it just risks the fallback.
    }
    setBusy(false);

    el.setAttribute("data-printing", "");
    document.body.setAttribute("data-print-mode", "");

    // `afterprint` rather than a line after `print()`: the call blocks in Chrome and Safari
    // but **not** in Firefox, which returns immediately and would strip the marks before the
    // dialog had rendered. `{ once: true }` stops repeat presses stacking listeners.
    window.addEventListener(
      "afterprint",
      () => {
        el.removeAttribute("data-printing");
        document.body.removeAttribute("data-print-mode");
      },
      { once: true },
    );

    window.print();
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(item.link);
      setCopied(true);
      toast.success("Queue link copied.");
    } catch {
      // Refused outright on an insecure origin or by permissions policy. The link is on
      // screen and selectable, so say that rather than failing silently.
      toast.error("Couldn't copy — select the link and copy it by hand.");
    }
  }

  return (
    <div
      ref={card}
      className="qr-poster border-hairline-soft bg-canvas p-base gap-base flex flex-col rounded-lg border"
    >
      <h2 className="text-title font-semibold" data-print-hide>
        {item.name}
      </h2>

      {item.poster == null ? (
        /*
          Locked rather than printable — the same discipline the settings hub follows: state
          the reason and the way out, and do not draw a control that cannot work.
        */
        <div className="gap-2 py-base flex flex-col items-center text-center" data-print-hide>
          <Icons.locked
            style={{ width: IconSize.md, height: IconSize.md }}
            className="text-muted"
            aria-hidden
          />
          <p className="text-body-sm text-muted">{item.blockedReason}</p>
          {item.fix ? (
            <Link
              href={item.fix.href}
              className="text-rausch-cta text-body-sm font-medium underline"
            >
              {item.fix.label}
            </Link>
          ) : null}
        </div>
      ) : (
        <>
          <div className="flex justify-center">
            <SalonPoster data={item.poster} scale={PREVIEW_SCALE} />
          </div>

          <div className="gap-2 mt-auto flex flex-col" data-print-hide>
            <Button fullWidth onClick={() => void print()} busy={busy}>
              <Icons.qr
                style={{ width: IconSize.xs, height: IconSize.xs }}
                aria-hidden
              />
              Print this poster
            </Button>
            <Button variant="outlined" fullWidth onClick={() => void copy()}>
              <Icons.copy
                style={{ width: IconSize.xs, height: IconSize.xs }}
                aria-hidden
              />
              {copied ? "Link copied" : "Copy link"}
            </Button>
            <Button
              variant="outlined"
              fullWidth
              busy={saving}
              onClick={() => void save()}
            >
              <Icons.download
                style={{ width: IconSize.xs, height: IconSize.xs }}
                aria-hidden
              />
              {savedUrl ? "Saved — save again" : "Save QR image"}
            </Button>
            {savedUrl ? (
              /* The permanent address of the file, so it can be dropped into a document or
                 forwarded without going through this page again. */
              <a
                href={savedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-caption-sm text-rausch-cta text-center underline"
              >
                Open the saved image
              </a>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
