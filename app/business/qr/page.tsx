import type { Metadata } from "next";
import Link from "next/link";
import {
  type SalonPosterItem,
  SalonQrPosters,
} from "@/components/owner/salon-qr-posters";
import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/app-links";
import { fetchBusinessHours } from "@/lib/api/discovery";
import { getOwnerContext } from "@/lib/owner/context";
import { fetchSavedQrBusinessIds, qrPublicUrl } from "@/lib/api/qr-storage";
import { posterBlockReason, posterHoursLine, posterTagline } from "@/lib/poster";
import { qrPath, queueScanUrl } from "@/lib/qr";
import { createClient } from "@/lib/supabase/server";


export const metadata: Metadata = { title: "QR posters" };

/**
 * A printable poster for every salon the owner runs — the design
 * (`Tho QR Poster.dc.html`) filled in with each shop's own facts.
 *
 * ## What this adds over the sheet that already existed
 *
 * `components/owner/queue-qr-sheet.tsx` has shown a QR since 3a, reachable in exactly one
 * way: open the queue board **for the active salon**. That is the right place for a code you
 * want to hand to somebody at the counter, and the wrong shape for the job of *equipping
 * shops*, which is done for all of them at once and rarely again. Ten salons meant ten
 * switcher flips, and a Basic salon's board never rendered the sheet at all.
 *
 * Both surfaces encode through `lib/qr.ts`, so the sheet and the poster cannot drift onto
 * different URLs — which, for a code already stuck to a counter, is unrecoverable.
 *
 * ## Every salon gets one now, and that is a change worth understanding
 *
 * The first cut gated the poster on `runsQueue` — `queueEnabled && hasFeature(plan,
 * "walkInQueue")` — because `/q/<id>` was a walk-in join form and nothing else. On the live
 * estate that is **one salon in ten**, so nine shops could not be given a code at all, and
 * the one that could was advertising a single feature on a sheet meant to last for years.
 *
 * `/q/<id>` is a hub now (see `components/customer/scan-actions.tsx`): booking, the shop, the
 * salon's own page, and the walk-in line when there is one. Booking works for every approved
 * salon, so there is nothing left for the queue to gate.
 *
 * What still blocks a poster is only what would make the destination **404 for the person
 * holding the paper** — a salon still in review, or switched off. `posterBlockReason` is the
 * one place that decides, and its note has the detail. That is the honest gate: a missing
 * poster is a task, a poster nobody can open is a laminated dead end.
 *
 * ## Reads
 *
 * One per salon, for opening hours, and nothing else — `getOwnerContext()` is `cache`-wrapped
 * and the shell has already paid for the salon list. The hours read runs alongside the
 * encoding and is skipped for a blocked salon. A failed hours read degrades to a poster with
 * no "Open" column rather than taking the page down: the QR is the payload, the rest is
 * decoration.
 */
export default async function OwnerQrPostersPage() {
  const { businesses, userId } = await getOwnerContext();
  const supabase = await createClient();

  /*
    Which salons already have a saved PNG — **one** listing of the owner's own folder for the
    whole page, rather than an existence check per salon. See `lib/api/qr-storage.ts`.
  */
  const saved = await fetchSavedQrBusinessIds(supabase, userId);

  const posters: SalonPosterItem[] = await Promise.all(
    businesses.map(async (b): Promise<SalonPosterItem> => {
      const blockedReason = posterBlockReason(b);
      const link = await queueScanUrl(b.id);

      if (blockedReason) {
        return {
          id: b.id,
          name: b.name,
          link,
          poster: null,
          blockedReason,
          fix: FIX_IN_REVIEW,
          savedUrl: null,
        };
      }

      const [qr, hours] = await Promise.all([
        /*
          Level Q rather than the encoder's default M. A sheet of paper taped beside a till
          gets scuffed, splashed and half-covered by whatever is put down in front of it, and
          Q tolerates roughly 25% damage against M's 15%. Stated at the call site so the
          queue sheet's own documented choice of M stays its own.
        */
        qrPath(link, { errorCorrectionLevel: "Q" }),
        fetchBusinessHours(supabase, b.id).catch(() => []),
      ]);

      return {
        id: b.id,
        name: b.name,
        link,
        poster: {
          salonName: b.name,
          tagline: posterTagline(b.businessType),
          qr,
          // The design's own script: strip the protocol and any trailing slash, so the card
          // reads `bhutansalons.com/q/…` rather than repeating `https://` at 24px.
          qrLabel: link.replace(/^https?:\/\//, "").replace(/\/$/, ""),
          phone: b.phone,
          hoursLine: posterHoursLine(hours),
          storeLinks: { ios: APP_STORE_URL, android: PLAY_STORE_URL },
        },
        blockedReason: null,
        fix: null,
        savedUrl: saved.has(b.id) ? qrPublicUrl(supabase, userId, b.id) : null,
      };
    }),
  );

  const printable = posters.filter((p) => p.poster != null).length;

  return (
    <div className="px-base py-lg tablet:px-lg gap-lg mx-auto flex w-full max-w-[1128px] flex-col">
      <header className="gap-2 flex flex-col" data-print-hide>
        <h1 className="text-heading font-semibold">QR posters</h1>
        <p className="text-body-md text-muted">
          One poster per salon, for the counter or the window — and{" "}
          <strong className="text-ink font-medium">one link for the life of the salon</strong>.
          A customer scans it and the Tho app opens on your salon if they have it; if they
          don&apos;t, they&apos;re offered the app and can still book, shop or join the line
          from their browser.
        </p>
        <p className="text-caption-sm text-muted">
          {printable === posters.length
            ? `${posters.length} ${posters.length === 1 ? "salon" : "salons"}, all ready to print.`
            : `${printable} of ${posters.length} ready to print — the rest are not approved yet.`}
        </p>
      </header>

      <SalonQrPosters posters={posters} userId={userId} />

      <footer className="border-hairline-soft pt-base border-t" data-print-hide>
        <p className="text-caption-sm text-muted">
          Prints borderless on A4. The code never changes — printing again gives you the same
          one, so a poster already on a wall keeps working whatever you switch on later.{" "}
          <Link href="/business/queue" className="text-rausch-cta font-medium underline">
            Run the line
          </Link>{" "}
          once customers start scanning.
        </p>
      </footer>
    </div>
  );
}

/**
 * Where an owner goes about a salon that is not approved yet.
 *
 * The same destination for both blocked states, because both are the operator's call rather
 * than a setting the owner can flip: `businesses.status` is changed in the admin console, and
 * `is_active` off is a salon that withdrew itself. Salon details is where they can see and
 * change what they own.
 */
const FIX_IN_REVIEW = {
  href: "/business/settings/salon",
  label: "Salon details",
} as const;
