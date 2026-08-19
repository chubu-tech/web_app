"use client";

import Image from "next/image";
import { MapPin, Star } from "lucide-react";
import { results as copy } from "@/lib/marketing/content";
import { formatDistance, type Match } from "@/lib/marketing/search";
import { cn } from "@/lib/marketing/utils";
import { salonPath } from "@/lib/slug";
import { MotifDiamond } from "./ui/bhutan";

/**
 * How many reviews the salon has, in words — or nothing at all.
 *
 * The locale is pinned rather than left to the runtime. This renders on the build
 * server and again in the browser, and `toLocaleString()` with no argument reads a
 * different default in each, which is a hydration mismatch that only appears on the
 * machines that have the other locale.
 */
function reviewLine(count: number): string | null {
  if (count === 0) return null;
  return `${count.toLocaleString("en-US")} ${count === 1 ? "review" : "reviews"}`;
}

/**
 * One real salon.
 *
 * Everything shown is read from the database at build time, so nothing here is
 * invented — which also means fields can be blank. A salon with no cover photo gets
 * the woven motif rather than a stock photograph of somebody else's salon, and a
 * salon with no reviews reads "New" rather than a fabricated rating.
 *
 * ## It has no card surface, and that is the point
 *
 * The reference's salon card is **photo-first and surface-less**: a rounded photo
 * plate with the meta stacked on the page canvas beneath it — no border, no fill, no
 * resting shadow. This one used to be a white slab with a 2rem radius and the shadow
 * tier at rest, which meant a grid of twelve salons was twelve boxes competing with
 * twelve photographs, and the photographs lost.
 *
 * Losing the box also fixes a real layout problem: the meta block is no longer pinned
 * to a shared card height, so a salon with two lines of services and one with none no
 * longer stretch each other.
 *
 * ## Three lines of meta, in the reference's order
 *
 * Name + rating · place · category and reviews. Two things moved to get there:
 *
 * - **The review count left the rating.** `★ 5.0 (1,749)` put the loudest number on
 *   the card next to the second loudest; the reference reads `★ 5.0` beside the name
 *   and `Barber · 1,749 reviews` a line below, which is the same information with a
 *   hierarchy. On a rail card ~290px wide, it is also the difference between the name
 *   having room and not.
 * - **The category is stated.** `business_categories` is the only populated taxonomy
 *   in the schema (`services.category` is filled on 3 of 34 rows), so the first
 *   category is the honest answer, and a salon that has none falls back to what it
 *   actually typed into its service list rather than to an invented label.
 *
 * The name wraps to two lines rather than truncating. Salon names here are routinely
 * bilingual — `صالون هاندسم | Handsome barbershop` in the reference, and the live data
 * has Dzongkha equivalents — and truncating one at a card edge loses the half that a
 * given reader can read. Two lines is also what the reference does, ragged card
 * bottoms and all.
 *
 * ## The whole card is the tap target, and it now leads to the salon
 *
 * **This card used to link to `#download`, and that was the single most costly line in
 * the repo for search.** The reasoning was recorded and was sound when written: the store
 * links in `content.ts` are empty strings, so the card handed off to the download band
 * rather than to a dead URL. What it missed is that `/salon/<id>` is not a dead URL — it
 * is a real, live, anonymously-readable, canonicalised route in this same application,
 * and it has been since the merge put the marketing site and the product on one origin.
 *
 * The consequence was structural rather than cosmetic. `/` is the highest-authority page
 * on the domain and it **displays** the marketplace's entire live inventory, read from
 * the database at build time — and it passed none of that authority to any of the pages
 * that inventory is about. `app/sitemap.ts` states the same problem from the other end:
 * *"a salon page is reachable only from Discover, which is a client-filtered list… Nothing
 * links to them from outside."* After this change the homepage is exactly that missing
 * outside link, for every salon at once.
 *
 * `salonPath` mints the slugged, keyword-bearing URL, so the anchor text is the salon's
 * name and the href carries it too.
 *
 * The link is stretched over the card with `after:absolute after:inset-0` instead of being
 * a 13px line of text at the bottom that a thumb has to find. One anchor, one tab stop,
 * whole-card target.
 *
 * Two consequences worth knowing. The `aria-label` names the salon **and** what the link
 * does, because a screen-reader listing of four links reading only a shop name does not
 * say they are openable pages. And a mouse drag across a rail ends in a `click` on
 * whatever card is under the cursor — `useCarousel` swallows exactly one click after a
 * real drag, which is why a stretched link is safe inside a draggable row.
 *
 * The star stays gold. That is one place THO deliberately departs from the reference,
 * which renders ratings in ink — `--color-star` is the product's single rating colour
 * on every surface in the app, and a rating that changes colour between the website
 * and the app is a rating that reads as a different thing.
 */
export function SalonCard({
  match,
  sizes,
}: {
  match: Match;
  /**
   * What the browser should assume this card's cover measures. A rail card's width is
   * a *percentage of the row*, not of the viewport, so only the caller knows the
   * answer — and passing it keeps the widths and the `sizes` that describe them in
   * one file, where a change to either is visibly a change to both. See
   * `find-salon.tsx`.
   */
  sizes: string;
}) {
  const { salon, distanceKm } = match;
  const featured = salon.plan === "growth" || salon.plan === "pro";

  const place = [
    salon.city ?? "Bhutan",
    distanceKm != null ? formatDistance(distanceKm) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  // The reference's third line: what kind of salon this is, and how many people said
  // so. Either half can be missing — 8 of the live salons have no category row — and
  // the line is absent rather than half-empty when both are.
  const kind = salon.categories[0] ?? salon.services[0] ?? null;
  const detail = [kind, reviewLine(salon.reviewCount)]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="group relative flex flex-col">
      <div className="bg-surface-soft relative aspect-[4/3] w-full overflow-hidden rounded-md">
        {salon.coverUrl ? (
          <Image
            src={salon.coverUrl}
            /*
              Describes the salon, not the photograph's contents.

              This was `"<name> interior"`, which asserts something the code cannot know:
              the cover is owner-uploaded and is as often a storefront, a price list or a
              stylist at work. Naming the business and its kind is true whatever the shot
              shows, and it is what a reader of the alt actually wants — which salon this
              is — rather than a guess at the framing.
            */
            alt={
              salon.categories[0]
                ? `${salon.name} — ${salon.categories[0].toLowerCase()} salon in ${salon.city ?? "Bhutan"}`
                : `${salon.name} in ${salon.city ?? "Bhutan"}`
            }
            fill
            sizes={sizes}
            className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]"
          />
        ) : (
          <div
            className="from-surface-soft to-surface-strong grid h-full w-full place-items-center bg-gradient-to-br"
            aria-hidden
          >
            <MotifDiamond className="text-muted-soft/50 size-9" />
          </div>
        )}

        {featured && (
          /* The reference's favourite badge: a white pill at 11px/600 wearing the one
             shadow tier, floated top-left over the photo. Deliberately the *only*
             thing over the image — the reference's heart belongs to a signed-in
             account, and this site has no session to save one against. */
          <span className="bg-paper text-ink shadow-card absolute top-3 left-3 rounded-full px-2.5 py-1 text-badge font-semibold">
            {copy.featured}
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-col gap-1">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-ink text-subheading min-w-0 font-semibold">
            <a
              href={salonPath(salon)}
              aria-label={`${salon.name} — see services, prices and book`}
              className={cn(
                "line-clamp-2 after:absolute after:inset-0 after:content-['']",
                "decoration-hairline decoration-2 underline-offset-4",
                "group-hover:underline group-hover:decoration-ink",
              )}
            >
              {salon.name}
            </a>
          </h3>
          {salon.reviewCount > 0 && salon.rating != null ? (
            <span className="text-ink inline-flex shrink-0 items-center gap-1 text-body-sm font-medium tabular-nums">
              <Star className="text-star size-3.5 fill-current" aria-hidden />
              {salon.rating.toFixed(1)}
            </span>
          ) : (
            <span className="text-muted-soft shrink-0 text-body-sm font-medium">
              {copy.noRating}
            </span>
          )}
        </div>

        <p className="text-muted inline-flex items-center gap-1.5 text-body-sm">
          <MapPin className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">{place}</span>
        </p>

        {detail && (
          <p className="text-muted-soft line-clamp-1 text-body-sm">{detail}</p>
        )}
      </div>
    </article>
  );
}
