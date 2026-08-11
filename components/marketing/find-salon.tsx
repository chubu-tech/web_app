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
import { Reveal } from "./ui/reveal";
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
            eyebrow={searchCopy.eyebrow}
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
          eyebrow={searchCopy.eyebrow}
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
                  className="text-muted hover:text-ink text-body-sm font-medium underline decoration-current/30 underline-offset-4 transition-colors"
                >
                  {searchCopy.clear}
                </button>
              }
            >
              {found.matches.length === 0 ? (
                <Empty />
              ) : (
                <Grid matches={found.matches} />
              )}
            </Band>

            {/* Salons that could not be judged against every choice because a
                field is blank. Shown, not silently dropped — a missing
                opening-hours row is the salon's gap, not a reason to hide them. */}
            {found.unverified.length > 0 && (
              <Band title={copy.partialHeading} body={copy.partialBody}>
                <Grid matches={found.unverified.slice(0, PAGE)} />
              </Band>
            )}
          </>
        ) : (
          bands && (
            <>
              {/* Absent rather than empty when nothing clears the bar — an
                  empty "Recommended" would be worse than no section. */}
              {bands.recommended.length > 0 && (
                <Band
                  title={copy.recommendedTitle}
                  body={copy.recommendedBody}
                >
                  <Grid matches={bands.recommended} />
                </Band>
              )}

              <Band
                title={copy.nearbyTitle}
                body={origin ? copy.nearbyBody : copy.nearbyPrompt}
                action={
                  origin ? undefined : (
                    <button
                      type="button"
                      onClick={locate}
                      disabled={locating}
                      className="text-ink ring-hairline hover:ring-ink/40 inline-flex items-center gap-2 rounded-full px-4 py-2 text-body-sm font-medium ring-1 ring-inset transition-colors disabled:opacity-50"
                    >
                      <LocateFixed className="text-rausch size-4" aria-hidden />
                      {locating ? searchCopy.place.locating : copy.nearbyAction}
                    </button>
                  )
                }
              >
                {origin ? (
                  bands.nearby.length > 0 ? (
                    <Grid matches={bands.nearby} />
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
    <div className="mt-14 first:mt-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Eyebrow>{title}</Eyebrow>
          <p className="text-body mt-2 max-w-2xl text-ui">{body}</p>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function Grid({ matches }: { matches: Match[] }) {
  return (
    <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {matches.map((match, i) => (
        <li key={match.salon.id}>
          <Reveal delay={Math.min(i, 6) * 0.05}>
            <SalonCard match={match} />
          </Reveal>
        </li>
      ))}
    </ul>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-slab bg-paper/60 ring-hairline-soft text-muted mt-6 px-6 py-8 text-center text-ui ring-1 ring-inset">
      {children}
    </p>
  );
}

function Empty() {
  return (
    <div className="rounded-slab bg-paper/60 ring-hairline-soft mt-6 px-6 py-14 text-center ring-1 ring-inset">
      <p className="text-subheading font-semibold">{copy.emptyTitle}</p>
      <p className="text-muted mt-2 text-ui">{copy.emptyBody}</p>
    </div>
  );
}
