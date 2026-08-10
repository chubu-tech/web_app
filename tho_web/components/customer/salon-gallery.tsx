"use client";

import Image from "next/image";
import { useState } from "react";
import { CoverImage } from "@/components/ui/cover-image";
import { Icons, IconSize } from "@/components/ui/icons";
import { ReportButton } from "@/components/ui/report-button";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/**
 * The salon's photographs, as a mosaic above the fold — Fresha's arrangement, and a
 * replacement for the full-bleed cover banner this page opened with.
 *
 * ## Why the banner had to go
 *
 * It was a 360px-tall edge-to-edge photograph with the back button, share and save
 * floating on top of it, and the gallery — when a salon had one — was a three-tile
 * collage **most of the way down the page**, under Offers. So the one salon in thirteen
 * with more than one photograph showed its best one as chrome and hid the rest below the
 * fold. The mosaic puts every photograph in the same place, at the top, and gives the
 * page a title block above it rather than text over an image.
 *
 * ## The shape adapts to how many photographs there are
 *
 * - **One** (the usual case — 12 of 13 live salons have no gallery at all, so the cover
 *   is the whole set) spans the full width. A two-thirds hero beside an empty column
 *   would read as a loading state.
 * - **Two** splits the row.
 * - **Three or more** is the reference layout: a hero across two columns and two stacked
 *   beside it, with the rest behind *See all photos*.
 *
 * **Below 744 only the hero shows.** Three photographs at phone width are three 90px
 * tiles, which is a thumbnail strip rather than a gallery — and the count on the button
 * still says how many there are.
 *
 * The first tile is `priority`: it is the largest contentful paint on this route, and it
 * is the one image on the page worth preloading.
 *
 * `CoverImage` handles the no-photograph case, so the mosaic never renders an empty
 * frame — it renders the seeded monogram gradient, the same one the browse card shows
 * for that salon, which is what makes an unphotographed salon still look deliberate.
 *
 * ## Reporting is in the viewer, and only for photographs that have an id
 *
 * A salon's gallery is customer-visible content the owner uploaded, so it is one of
 * `report_content`'s five targets — by `business_photos.id`. The **cover is usually not one
 * of those rows**: it is `businesses.cover_url`, a column, so there is no id to report and
 * `reportId` is null for it. A control that could only ever raise `P0002` is worse than no
 * control, so that photograph simply has none. (When the owner has uploaded the same
 * picture through both forms — which nothing upstream stops — the caller pairs the deduped
 * url back to its gallery row and it *is* reportable. See the salon page.)
 *
 * The control lives in the full-screen viewer rather than on the mosaic tiles, because a
 * tile *is* a button that opens the viewer and a second button inside it would be two
 * targets in one 380px hit area.
 */
export function SalonGallery({
  name,
  photos,
}: {
  name: string;
  /**
   * Cover first, then the gallery. Already de-duplicated by the caller.
   *
   * `reportId` is the `business_photos` row id, or null when this photograph is not one —
   * see above.
   */
  photos: { url: string; reportId: string | null }[];
}) {
  const [openAt, setOpenAt] = useState<number | null>(null);
  const urls = photos.map((p) => p.url);

  // No photographs at all: the monogram, at the hero's height. Not a button — there is
  // nothing to open, and a control that opens an empty sheet is worse than no control.
  if (urls.length === 0) {
    return (
      <CoverImage
        label={name}
        imageUrl={null}
        priority
        className="h-[220px] w-full rounded-md tablet:h-[380px] desktop:h-[440px]"
      />
    );
  }

  const hero = urls[0]!;
  const side = urls.slice(1, 3);

  return (
    <>
      <div
        className={cn(
          "gap-sm relative grid h-[220px] grid-cols-1 tablet:h-[380px] desktop:h-[440px]",
          // The hero keeps the whole row until there is something to put beside it.
          side.length > 0 ? "tablet:grid-cols-3 tablet:grid-rows-2" : null,
        )}
      >
        <Tile
          url={hero}
          alt={`${name}, photo 1 of ${urls.length}`}
          onOpen={() => setOpenAt(0)}
          priority
          sizes="(min-width: 744px) 66vw, 100vw"
          className={side.length > 0 ? "tablet:col-span-2 tablet:row-span-2" : undefined}
        />

        {/* Hidden below 744 — see the note above. `hidden tablet:block` rather than not
            rendering, so the markup is the same at every width and there is no layout
            shift when a resize crosses the breakpoint. */}
        {side.map((url, i) => (
          <Tile
            key={url + i}
            url={url}
            alt={`${name}, photo ${i + 2} of ${urls.length}`}
            onOpen={() => setOpenAt(i + 1)}
            sizes="33vw"
            className={cn(
              "hidden tablet:block",
              // Two side photographs fill the column; one stretches down it, rather than
              // sitting half-height above a gap.
              side.length === 1 ? "tablet:row-span-2" : null,
            )}
          />
        ))}

        {/*
          Always offered when there is more than one photograph, including at phone
          width where the side tiles are hidden — that is precisely where it is the only
          way to the rest. Fresha's is bottom-right over the last tile; this one sits on
          the mosaic's corner so it lands in the same place whichever shape is rendered.
        */}
        {urls.length > 1 ? (
          <button
            type="button"
            onClick={() => setOpenAt(0)}
            className="bg-canvas text-ink text-caption shadow-card right-base bottom-base px-md py-sm hover:bg-surface-soft absolute rounded-full font-medium"
          >
            See all {urls.length} photos
          </button>
        ) : null}
      </div>

      {/* The same viewer `PhotoCollage` opens, and the same shared `Sheet` — so Escape,
          the focus trap and focus restoration come from one implementation rather than
          from a second, almost-alike modal. */}
      <Sheet
        open={openAt != null}
        onClose={() => setOpenAt(null)}
        title={`${name} — photos`}
        fullBleed
      >
        <ul className="gap-base p-base grid grid-cols-1 tablet:grid-cols-2">
          {photos.map((photo, i) => (
            <li
              key={photo.url + i}
              className="bg-surface-strong relative aspect-[3/2] overflow-hidden rounded-md"
            >
              <Shot
                url={photo.url}
                alt=""
                sizes="(min-width: 744px) 45vw, 90vw"
                priority={i === openAt}
              />
              {photo.reportId ? (
                <div className="top-sm right-sm absolute">
                  <ReportButton
                    target="business_photo"
                    targetId={photo.reportId}
                    label="this photo"
                    variant="overlay"
                  />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  );
}

function Tile({
  url,
  alt,
  onOpen,
  sizes,
  priority = false,
  className,
}: {
  url: string;
  alt: string;
  onOpen: () => void;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "bg-surface-strong group relative block overflow-hidden rounded-md",
        className,
      )}
    >
      <Shot url={url} alt={alt} sizes={sizes} priority={priority} />
      {/* The whole tile darkens slightly on hover rather than the image zooming: three
          tiles zooming at different scales inside one mosaic reads as jitter. */}
      <span
        aria-hidden
        className="absolute inset-0 bg-black/0 transition-colors duration-[var(--duration-base)] group-hover:bg-black/10"
      />
    </button>
  );
}

/** One photograph, falling back to a glyph rather than a broken-image icon. */
function Shot({
  url,
  alt,
  sizes,
  priority = false,
}: {
  url: string;
  alt: string;
  sizes: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span className="bg-surface-strong flex h-full w-full items-center justify-center">
        <Icons.imageMissing
          className="text-muted-soft"
          style={{ width: IconSize.sm, height: IconSize.sm }}
          aria-hidden
        />
      </span>
    );
  }
  return (
    <Image
      src={url}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      className="object-cover"
      onError={() => setFailed(true)}
    />
  );
}
