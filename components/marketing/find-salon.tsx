"use client";

import { useMemo, useState } from "react";
import { LocateFixed } from "lucide-react";
import { results as copy, search as searchCopy } from "@/lib/marketing/content";
import type { SalonIndex } from "@/lib/marketing/salons";
import {
  EMPTY_QUERY,
  isQueryEmpty,
  nearby,
  recommended,
  runQuery,
  type Coords,
  type Match,
  type Query,
} from "@/lib/marketing/search";
import { Container, Eyebrow, Section, SectionHeading } from "./ui/section";
import { Rail } from "./ui/rail";
import { Reveal, RevealGroup } from "./ui/reveal";
import { SalonCard } from "./salon-card";
import { SearchBar } from "./search-bar";

/** Cap on the partial-match band, so one blank field can't flood the page. */
const PAGE = 8;

/**
 * Find a salon — the search bar, then the salon bands it narrows.
 *
 * With no query this shows two curated things, deliberately not a directory:
 *
 *   Recommended  a real shortlist — reviewed, well rated, capped (see
 *                `recommended()`); absent entirely if nothing qualifies
 *   Near you     only when a visitor shares their location, and only salons
 *                that have a map pin
 *
 * There is no "every salon" band: this is a marketing page, not a listing.
 * A visitor who wants the full set searches, and the app is the real directory.
 *
 * With a query, the bands collapse into one results list, because then the
 * visitor has told us what they want and a curated shortlist is no longer the
 * answer.
 *
 * The salons were prerendered at build time, so all of this is local.
 */
export function FindSalon({ index }: { index: SalonIndex }) {
  const [query, setQuery] = useState<Query>(EMPTY_QUERY);
  const [origin, setOrigin] = useState<Coords | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  function locate() {
    if (!navigator.geolocation) {
      setLocationError(searchCopy.place.unsupported);
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setOrigin({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocating(false);
      },
      () => {
        // Refusing to share a location is not an error to shout about — the
        // town list is right there in the Where panel.
        setLocating(false);
        setLocationError(searchCopy.place.denied);
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  }

  const searching = !isQueryEmpty(query);

  const bands = useMemo(() => {
    if (searching) return null;
    return {
      recommended: recommended(index),
      nearby: origin ? nearby(index, origin) : [],
    };
  }, [index, origin, searching]);

  const found = useMemo(
    () => (searching ? runQuery(index, query, origin) : null),
    [index, query, origin, searching],
  );

  if (index.salons.length === 0) {
    // The build could not reach the database. Say so quietly rather than
    // rendering an empty grid that reads as "there are no salons".
    return (
      <Section id="find" aria-labelledby="find-title">
        <Container>
          <SectionHeading
            title={searchCopy.title}
            body={copy.offline}
            titleId="find-title"
          />
        </Container>
      </Section>
    );
  }

  return (
    <Section id="find" aria-labelledby="find-title">
      <Container>
        <SectionHeading
          title={searchCopy.title}
          body={searchCopy.body}
          titleId="find-title"
        />

        {/* `relative z-40` is load-bearing, not decoration.
            Every salon card is wrapped in <Reveal>, which animates opacity and
            y — so each card is its own stacking context with `z-index: auto`.
            Those paint in the same layer as any z-auto ancestor of the panel,
            and the cards come later in the DOM, so without a positive z-index
            here the open dropdown is painted over by the grid below it. */}
        <div className="relative z-40 mt-10">
          <SearchBar
            index={index}
            query={query}
            onQuery={setQuery}
            onLocate={locate}
            origin={origin}
            locating={locating}
            locationError={locationError}
          />
        </div>

        {found ? (
          <>
            <Band
              title={copy.resultsTitle}
              body={`${found.matches.length} ${
                found.matches.length === 1 ? "salon" : "salons"
              } match.`}
              action={
                <button
                  type="button"
                  onClick={() => setQuery(EMPTY_QUERY)}
                  className="text-muted hover:text-ink text-title font-medium underline decoration-current/30 decoration-2 underline-offset-4 transition-colors"
                >
                  {searchCopy.clear}
                </button>
              }
            >
              {found.matches.length === 0 ? (
                <Empty />
              ) : (
                <SalonRail matches={found.matches} label={copy.resultsTitle} />
              )}
            </Band>

            {/* Salons that could not be judged against every choice because a
                field is blank. Shown, not silently dropped — a missing
                opening-hours row is the salon's gap, not a reason to hide them. */}
            {found.unverified.length > 0 && (
              <Band title={copy.partialHeading} body={copy.partialBody}>
                <SalonRail
                  matches={found.unverified.slice(0, PAGE)}
                  label={copy.partialHeading}
                />
              </Band>
            )}
          </>
        ) : (
          bands && (
            <>
              {/* Absent rather than empty when nothing clears the bar — an
                  empty "Recommended" would be worse than no section. */}
              {bands.recommended.length > 0 && (
                <Band title={copy.recommendedTitle} body={copy.recommendedBody}>
                  <SalonRail
                    matches={bands.recommended}
                    label={copy.recommendedTitle}
                  />
                </Band>
              )}

              <Band
                title={copy.nearbyTitle}
                body={origin ? copy.nearbyBody : copy.nearbyPrompt}
                action={
                  origin ? undefined : (
                    // Geometry matched to `Button`'s `ghost` variant — 48px tall,
                    // pill, hairline stroke — so the one control inside a band
                    // header is the same object as every other control on the page.
                    // It stays a bare `<button>` rather than becoming one because it
                    // carries a leading icon, and `Button` wraps its children in a
                    // truncating span.
                    <button
                      type="button"
                      onClick={locate}
                      disabled={locating}
                      className="text-ink ring-border-strong hover:ring-ink hover:bg-surface-soft text-title inline-flex h-12 shrink-0 items-center gap-2 rounded-full px-5 font-medium ring-1 ring-inset transition-colors disabled:opacity-50"
                    >
                      <LocateFixed className="text-rausch size-4" aria-hidden />
                      {locating ? searchCopy.place.locating : copy.nearbyAction}
                    </button>
                  )
                }
              >
                {origin ? (
                  bands.nearby.length > 0 ? (
                    <SalonRail
                      matches={bands.nearby}
                      label={copy.nearbyTitle}
                    />
                  ) : (
                    <Note>{copy.nearbyNone}</Note>
                  )
                ) : locationError ? (
                  <Note>{locationError}</Note>
                ) : null}
              </Band>
            </>
          )
        )}
      </Container>
    </Section>
  );
}

/** One labelled band of salons. */
function Band({
  title,
  body,
  action,
  children,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    /* A hairline opens each band after the first — the reference separates
       long-scrolling editorial sections with a 1px rule rather than with more
       whitespace, which is what keeps a page of card grids reading as one page. */
    <div className="border-hairline-soft mt-12 border-t pt-10 first:mt-10 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <Eyebrow>{title}</Eyebrow>
          <p className="text-body text-body-lg mt-2 max-w-[38rem]">{body}</p>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

/**
 * How wide one card is, as a share of the rail — and therefore how much of the next
 * one shows past it.
 *
 * **Percentages, not `vw`.** A flex item's percentage width resolves against the
 * scroll container's content box, which is the `Container`'s width *after* its
 * gutters. A `vw` figure would have to guess at those gutters, and would guess wrong
 * three times, because they step at 640 and again at 1024. This way the peek is the
 * same fraction of the row at 320px and at 1440px, with nothing to keep in step.
 *
 * The old grid's collapsing rule survives the change intact — the reference's "drop
 * column counts cleanly at each breakpoint; never reflow rows" — because 4 → 3 → 2 → 1
 * is exactly what these four numbers say. What is new is the remainder: every step
 * leaves a tenth of the row over (18% at the phone step, where one card is the whole
 * view and the peek has to be unmistakable), so there is always a slice of the next
 * card showing rather than a clean edge that reads as the end of the band.
 */
const CARD_WIDTHS = "w-[82%] sm:w-[45%] lg:w-[30%] xl:w-[22.5%]";

/**
 * `grow` is what stops the peek becoming a hole.
 *
 * A width that leaves room for the next card also leaves that room when there *is* no
 * next card — and "Recommended" is capped at four, so at 1280 the band always held
 * exactly four cards and always ended 60px short of the right gutter it shares with the
 * search bar and the hairline above it. That reads as a misalignment, not as a peek.
 *
 * With `grow` the row asks for the leftover only when there is leftover: four cards at
 * 1280 stretch to fill the container exactly, and a band with more salons than fit has
 * no free space to distribute, so the widths above stand and the next card shows past
 * the edge. `shrink-0` is the other half — without it the items would compress to fit
 * instead of overflowing, and there would be nothing to swipe.
 */
const CARD_FLEX = "shrink-0 grow snap-start";

/**
 * The same widths, told to the image optimiser.
 *
 * Deliberately in the same file, on the line below: `sizes` is a *description* of the
 * layout, and the two drift the moment they live apart. Each figure is the card width
 * as a share of the viewport rather than of the row — the row is the viewport less the
 * gutters, so at the top end 22.5% of a capped 1280px container is a flat 280px, not a
 * fraction of a 1920px window.
 */
const CARD_SIZES =
  "(min-width: 1280px) 280px, (min-width: 1024px) 29vw, (min-width: 640px) 43vw, 78vw";

/**
 * One band of salons, as a swipeable rail.
 *
 * This was a grid that collapsed to `grid-cols-1` below 640, which is to say four
 * salons stacked vertically — a phone screen and a half of photographs to scroll past
 * before the next section of the page, and no way to tell from the first card that
 * there were three more. The rail puts the whole band in one screen at every width:
 * see `ui/rail.tsx` for the mechanics and for why the arrows stop at 640.
 *
 * **`RevealGroup` rather than a `Reveal` per card**, and that is a correctness fix
 * rather than a tidier way to stagger. `Reveal` animates on `whileInView`, so inside a
 * horizontal scroller every card past the right edge is out of view *at rest* — the
 * grid's per-card observers would have left the second, third and fourth salons at
 * `opacity: 0` until each was swiped into view, which on a rail whose whole job is to
 * suggest there is more looks exactly like a band with one salon in it. The group
 * observes the row as a whole and staggers its children from there, so the cards you
 * cannot see yet are already drawn when you reach them.
 */
function SalonRail({ matches, label }: { matches: Match[]; label: string }) {
  return (
    <RevealGroup className="mt-7" stagger={0.06}>
      <Rail label={label}>
        {matches.map((match) => (
          <li key={match.salon.id} className={`${CARD_WIDTHS} ${CARD_FLEX}`}>
            <Reveal asChild>
              <SalonCard match={match} sizes={CARD_SIZES} />
            </Reveal>
          </li>
        ))}
      </Rail>
    </RevealGroup>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="bg-surface-soft ring-hairline-soft text-muted text-title mt-7 rounded-md px-6 py-8 text-center ring-1 ring-inset">
      {children}
    </p>
  );
}

function Empty() {
  return (
    <div className="bg-surface-soft ring-hairline-soft mt-7 rounded-md px-6 py-14 text-center ring-1 ring-inset">
      <p className="text-heading text-ink font-semibold">{copy.emptyTitle}</p>
      <p className="text-muted text-body-lg mt-2">{copy.emptyBody}</p>
    </div>
  );
}
