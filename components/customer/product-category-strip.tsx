"use client";

import { categoryGlyph, IconSize } from "@/components/ui/icons";
import type { ProductCategory } from "@/lib/types/salon";
import { cn } from "@/lib/utils";

/**
 * The browsable category axis above the product grid — a port of
 * `tho/app/lib/customer/shop/product_category_strip.dart`.
 *
 * **`product_categories` was read by nothing on this platform.** The table shipped in
 * August, seeded and platform-owned, and neither `lib/` nor `components/` ever selected
 * from it — which is why `20260902000002`'s icon repoint (scissors and a settings cog off
 * three shelves) was invisible here. The catalogue was a flat grid with no axis to narrow
 * on, and this is what fixes that.
 *
 * Order is the platform's `sort`, never alphabetical and never derived from whichever
 * products happen to have loaded: the taxonomy decides how it reads.
 *
 * **An empty or failed taxonomy renders nothing at all.** The strip is an entry point, not a
 * gate — the grid beneath holds the whole catalogue and must stay usable when the taxonomy
 * is unreachable. The page's reader already `.catch(() => [])`s it for exactly this.
 *
 * ## What the web does differently, and why
 *
 * Upstream measures the strip's height — plate + gap + two rendered label lines at the
 * current text scale — because it hardcoded 96 once and "Tools & appliances" was clipped
 * mid-word while a band of dead white opened above the first rail. Here the row is in
 * normal flow and sizes to its content, so the measurement has nothing to do; the two things
 * the arithmetic was protecting are claimed directly instead: `w-21` fits the longest *word*
 * in the taxonomy so two-word names wrap between words, and `py-sm` keeps the raised
 * shadow's upper blur out of the scroll container's clip.
 *
 * Selection rides the **URL** rather than component state, which is the web's own
 * requirement and not a port: `?cat=hair-care` alongside `?tab=products&sort=&min=&max=`
 * makes a narrowed shelf shareable and steppable with the back button, the same call
 * `lib/product-filter.ts` already made for the price facet. The slug travels rather than the
 * id because a link with `hair-care` in it says what it is.
 */
export function ProductCategoryStrip({
  categories,
  selectedSlug,
  onSelect,
}: {
  categories: ProductCategory[];
  /** From `?cat=`. Null on the unnarrowed browse. */
  selectedSlug: string | null;
  /** Null clears the axis — what tapping the selected tile again does. */
  onSelect: (slug: string | null) => void;
}) {
  if (categories.length === 0) return null;

  return (
    /*
      The strip owns its own overflow, never the body — `AGENTS.md`'s rule, and the reason
      every nav list and filter row here scrolls itself. `scrollbar-none` is the shared
      utility; the tiles' own half-visible trailing edge is the affordance that says the row
      continues, which is what makes hiding the bar legitimate here.
    */
    <div className="scrollbar-none -mx-base px-base tablet:-mx-lg tablet:px-lg py-sm overflow-x-auto">
      <ul className="gap-md flex w-max">
        {categories.map((c) => {
          const selected = c.slug === selectedSlug;
          // Decoration. A glyph name this build has never heard of still gets a tile —
          // dropping a whole branch of the taxonomy because a name drifted would be far
          // the worse failure, and it is what lets a data migration ship on its own.
          const Glyph = categoryGlyph(c.icon);
          return (
            <li key={c.id}>
              <button
                type="button"
                // Pressing the selected tile clears the axis. Without it the only way back
                // to everything is the browser's back button or hunting for a Clear control
                // that belongs to a different facet's sheet.
                onClick={() => onSelect(selected ? null : c.slug)}
                aria-pressed={selected}
                className="gap-xs flex w-21 flex-col items-center"
              >
                <span
                  className={cn(
                    "grid size-14 place-items-center rounded-full",
                    "transition-colors duration-[var(--duration-fast)]",
                    /*
                      A brand tint, not a grey outline puck. Eight identical `surface-soft`
                      circles behind a hairline read as *disabled* controls — the taxonomy
                      looked like something you could not tap. `rausch-soft` is reserved in
                      the tokens for exactly this: the palest brand tint carrying rausch's
                      own label on top of it.

                      `shadow-raised` and **no border**: it has no spread layer, so it would
                      compose with one, but a tinted plate needs no hairline to separate it
                      from white — which matters more since the canvas port, where a grey
                      plate would be the only thing distinguishing the row from the page.
                    */
                    selected
                      ? "bg-rausch-cta text-on-primary"
                      : "bg-rausch-soft text-rausch shadow-raised",
                  )}
                >
                  <Glyph style={{ width: IconSize.md, height: IconSize.md }} aria-hidden />
                </span>
                {/*
                  Two lines, centred. One line was the wrong fix upstream: "Tools &
                  appliances" overruns an 84px tile at `caption`, and ellipsis truncates
                  wherever it runs out rather than at a word boundary — "Tools & appli…".
                  Two lines wrap between the words and show the whole name.
                */}
                <span
                  className={cn(
                    "text-caption line-clamp-2 text-center",
                    selected ? "text-ink font-semibold" : "text-body",
                  )}
                >
                  {c.name}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
